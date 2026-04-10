/**
 * protocol-withtypes.ts
 *
 * Protocol service that encodes/decodes JSON objects to/from bytes using a typed
 * protocol definition (e.g. protocol-test-types.ts).
 *
 * Protocol definition format
 * ──────────────────────────
 *   $object  – known-key object encoded with per-group bitflags (7 keys per byte,
 *              MSB of each byte signals another bitflag byte follows).
 *   $map     – unknown-key map:  [count:LEB] [ [keyLen:LEB][keyUTF8] [value] ] …
 *   $array   – typed element array:
 *                mode 0 (standard) : [0] [count:LEB] [value] …
 *                mode 1 (flexible) : [1] [opCount:LEB] [ [op] [params] [value] ] …
 *   $static  – non-shrinking array:
 *                mode 2 (by-index) : [2] [count:LEB] [ [idx:LEB] [value] ] …
 *                mode 3 (fill)     : [3] [count:LEB] [idx:LEB] [value]
 *                mode 4 (refresh)  : [4] [count:LEB] [value] …
 *
 * Primitive wire types
 * ────────────────────
 *   uint      – unsigned LEB128
 *   int       – signed SLEB128
 *   float     – 8-byte IEEE 754 float64
 *   string    – LEB128(byteLen) + UTF-8 bytes
 *   boolean   – 1 byte (0 = false, 1 = true)
 *   null      – 0 bytes
 *   undefined – 0 bytes
 *   object / array (or any unknown type) – fallback to serializeEX / deserializeEX
 *
 * Flexible-array op codes (mode 1)
 * ─────────────────────────────────
 *   1 resize   [newLen:LEB]
 *   2 set      [idx:LEB] [value]
 *   3 patch    [idx:LEB] [value]   (partial object; value is encoded via schema)
 *   4 setrange [idx:LEB] [n:LEB] [value×n]
 *   5 fill     [idx:LEB] [n:LEB] [value]
 *   6 replace  [n:LEB] [value×n]
 */

import { serializeEX, deserializeEX, createDefaultDict } from '../encoder/encoder';

// ─── Internal shared DataView buffer for float64 ─────────────────────────────
const _dvBuf = new ArrayBuffer(8);
const _dv    = new DataView(_dvBuf);
const _textEncoder = new TextEncoder();
const _textDecoder = new TextDecoder();

// Frozen empty dict used for serializeEX / deserializeEX fallback calls.
const _emptyDict: EncoderDict = { count: 0, keys: {}, order: [], frozen: true };

// ─── String dictionary ────────────────────────────────────────────────────────
// Up to 255 entries.  Index 0-126 encodes as a single byte; 127-254 as 2 bytes.

let _stringDictionary: string[] = [];
let _stringDictionaryLookup = new Map<string, number>();

/**
 * Register a shared string dictionary for compact string encoding.
 *
 * Any string in the dictionary is encoded as 1–2 bytes instead of its full
 * UTF-8 representation.  Both encoder and decoder must use the same dictionary.
 *
 * Wire encoding for dictionary strings:
 *   index 0–126   → single byte: 0x80 | index
 *   index 127–254 → two bytes:   0xFF, index
 *
 * @param dict  Array of up to 255 strings (excess entries are silently ignored).
 */
export function setStringDictionaryWT(dict: string[]): void {
    _stringDictionary = dict.slice(0, 255);
    _stringDictionaryLookup.clear();
    _stringDictionary.forEach((s, i) => _stringDictionaryLookup.set(s, i));
}

// ─── LEB128 helpers ───────────────────────────────────────────────────────────

function writeLEB128(buffer: number[], value: number): void {
    // Supports 0 … 2^53 (JS safe-integer range)
    if (value < 0) value = 0;
    do {
        let byte = value & 0x7F;
        value = Math.floor(value / 128);
        if (value !== 0) byte |= 0x80;
        buffer.push(byte);
    } while (value !== 0);
}

function writeSLEB128(buffer: number[], value: number): void {
    // Supports 32-bit signed integers (sufficient for game state).
    value |= 0; // clamp to int32
    let more = true;
    while (more) {
        let byte = value & 0x7F;
        value >>= 7; // arithmetic right-shift
        if ((value === 0 && !(byte & 0x40)) || (value === -1 && (byte & 0x40))) {
            more = false;
        } else {
            byte |= 0x80;
        }
        buffer.push(byte);
    }
}

function readLEB128(ref: DecodeRef): number {
    let value = 0;
    let shift = 0;
    while (true) {
        const byte = ref.view.getUint8(ref.pos++);
        value += (byte & 0x7F) * Math.pow(2, shift);
        shift += 7;
        if (!(byte & 0x80)) break;
    }
    return value;
}

function readSLEB128(ref: DecodeRef): number {
    let value = 0;
    let shift = 0;
    let byte: number;
    do {
        byte = ref.view.getUint8(ref.pos++);
        value += (byte & 0x7F) * Math.pow(2, shift);
        shift += 7;
    } while (byte & 0x80);
    if (shift < 53 && (byte & 0x40)) value -= Math.pow(2, shift);
    return value;
}

// ─── Schema types ─────────────────────────────────────────────────────────────

type PrimitiveKind =
    | 'uint' | 'int' | 'float' | 'string' | 'boolean'
    | 'null' | 'undefined' | 'object' | 'array';

interface CompiledField {
    key: string;
    node: CompiledNode;
}

type CompiledNode =
    | { kind: 'primitive'; type: PrimitiveKind }
    | { kind: 'object';    fields: CompiledField[] }
    | { kind: 'map';       valueNode: CompiledNode }
    | { kind: 'array';     elementNode: CompiledNode }
    | { kind: 'static';    elementNode: CompiledNode };

interface DecodeRef {
    view: DataView;
    pos: number;
}

// ─── Schema compiler ──────────────────────────────────────────────────────────

function compileFields(schema: Record<string, any>): CompiledField[] {
    return Object.keys(schema).map(key => ({ key, node: compileSchema(schema[key]) }));
}

function compileElementSchema(schema: any): CompiledNode {
    if (typeof schema === 'string') return { kind: 'primitive', type: schema as PrimitiveKind };
    return compileSchema(schema);
}

/**
 * Compile a raw protocol schema node into a typed CompiledNode tree.
 *
 * A schema node is one of:
 *   "uint" | "int" | "float" | "string" | "boolean" | "null" | "object" | …
 *     → primitive
 *   { $object: { key: schemaNode, … } }
 *     → object  (empty $object falls back to primitive 'object')
 *   { $map: { key: schemaNode, … } }
 *     → map     (empty $map uses primitive 'object' for values)
 *   { $array: schemaNode | record }
 *     → array
 *   { $static: schemaNode | record }
 *     → static
 *   { key: schemaNode, … }   (plain record, implicit $object)
 *     → object  (empty record falls back to primitive 'object')
 */
export function compileSchema(schema: any): CompiledNode {
    if (typeof schema === 'string') {
        return { kind: 'primitive', type: schema as PrimitiveKind };
    }

    if (typeof schema !== 'object' || schema === null) {
        return { kind: 'primitive', type: 'object' };
    }

    if ('$object' in schema) {
        const inner = schema['$object'];
        if (!inner || Object.keys(inner).length === 0) {
            return { kind: 'primitive', type: 'object' };
        }
        return { kind: 'object', fields: compileFields(inner) };
    }

    if ('$map' in schema) {
        const inner = schema['$map'];
        const valueNode: CompiledNode = (inner && Object.keys(inner).length > 0)
            ? compileSchema(inner)
            : { kind: 'primitive', type: 'object' };
        return { kind: 'map', valueNode };
    }

    if ('$array' in schema) {
        return { kind: 'array', elementNode: compileElementSchema(schema['$array']) };
    }

    if ('$static' in schema) {
        return { kind: 'static', elementNode: compileElementSchema(schema['$static']) };
    }

    // Plain record → implicit $object
    const keys = Object.keys(schema);
    if (keys.length === 0) {
        return { kind: 'primitive', type: 'object' };
    }
    return { kind: 'object', fields: compileFields(schema) };
}

// ─── Encoder ──────────────────────────────────────────────────────────────────

/**
 * String wire format
 * ──────────────────
 *   0x00               = empty string ""
 *   0x01–0x7E          = raw string; byte value = UTF-8 byte length (1–126 bytes follow)
 *   0x7F [len:LEB128] [bytes] = raw string with explicit length (len ≥ 127 bytes)
 *   0x80–0xFE          = dictionary lookup; index = (byte − 0x80), indices 0–126
 *   0xFF [idx:uint8]   = dictionary lookup; index from next byte, indices 0–254
 *
 * The format for raw strings of length 0–126 is identical to the previous
 * LEB128-prefixed encoding, so no migration is needed for typical protocol data.
 */
function encodeStringWT(value: string, buffer: number[]): void {
    if (value === '') {
        buffer.push(0x00);
        return;
    }

    // Dictionary lookup
    if (_stringDictionaryLookup.size > 0) {
        const idx = _stringDictionaryLookup.get(value);
        if (idx !== undefined) {
            if (idx <= 126) {
                buffer.push(0x80 | idx); // single byte 0x80–0xFE
            } else {
                buffer.push(0xFF);       // extended dict marker
                buffer.push(idx);        // uint8 index (127–254)
            }
            return;
        }
    }

    // Raw string
    const bytes = _textEncoder.encode(value);
    if (bytes.length <= 0x7E) {
        buffer.push(bytes.length);       // 0x01–0x7E
    } else {
        buffer.push(0x7F);               // escape: explicit LEB128 length follows
        writeLEB128(buffer, bytes.length);
    }
    for (const b of bytes) buffer.push(b);
}

function decodeStringWT(ref: DecodeRef): string {
    const first = ref.view.getUint8(ref.pos++);

    if (first === 0x00) return '';

    if (first >= 0x80) {
        // Dictionary string
        const idx = first === 0xFF
            ? ref.view.getUint8(ref.pos++)   // extended: next byte is index
            : first - 0x80;                  // compact: index embedded in byte
        if (idx >= _stringDictionary.length) {
            throw new RangeError(`[protocol-withtypes] Dict index ${idx} out of range (dict size: ${_stringDictionary.length})`);
        }
        return _stringDictionary[idx];
    }

    // Raw string
    const len = first === 0x7F ? readLEB128(ref) : first; // 0x01–0x7E = literal length
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = ref.view.getUint8(ref.pos++);
    return _textDecoder.decode(arr);
}

export function encodeNode(value: any, node: CompiledNode, buffer: number[]): void {
    switch (node.kind) {
        case 'primitive': return encodePrimitive(value, node.type, buffer);
        case 'object':    return encodeObject(value, node.fields, buffer);
        case 'map':       return encodeMap(value, node.valueNode, buffer);
        case 'array':     return encodeArray(value, node.elementNode, buffer);
        case 'static':    return encodeStaticArray(value, node.elementNode, buffer);
    }
}

function encodePrimitive(value: any, type: PrimitiveKind, buffer: number[]): void {
    switch (type) {
        case 'uint':
            writeLEB128(buffer, value == null ? 0 : Math.max(0, Math.floor(value)));
            return;
        case 'int':
            writeSLEB128(buffer, value == null ? 0 : value);
            return;
        case 'float':
            _dv.setFloat64(0, value ?? 0);
            for (let i = 0; i < 8; i++) buffer.push(_dv.getUint8(i));
            return;
        case 'string': {
            encodeStringWT(value == null ? '' : String(value), buffer);
            return;
        }
        case 'boolean':
            buffer.push(value ? 1 : 0);
            return;
        case 'null':
        case 'undefined':
            // no bytes written; the schema declares the type
            return;
        default:
            // 'object', 'array', or any unrecognised type → encoder fallback
            serializeEX(value, buffer, _emptyDict, {});
            return;
    }
}

/**
 * Encode a known-field object using multi-byte bitflags.
 *
 * Each bitflag byte uses bits 0–6 to mark the presence of the next 7 fields
 * (in schema-definition order).  Bit 7 (MSB) is set on every byte except the
 * last, allowing decoders to stop reading bitflag bytes without knowing the
 * schema size in advance.
 *
 * Only fields that are present (key exists in the value object) are written;
 * absent fields contribute a 0 bit and no bytes.
 */
function encodeObject(value: any, fields: CompiledField[], buffer: number[]): void {
    if (fields.length === 0) {
        // No schema keys → fall back to generic serialisation
        serializeEX(value, buffer, _emptyDict, {});
        return;
    }

    const numGroups = Math.ceil(fields.length / 7);
    const bitflags  = new Array<number>(numGroups).fill(0);
    const isObj = value !== null && value !== undefined &&
                  typeof value === 'object' && !Array.isArray(value);

    for (let i = 0; i < fields.length; i++) {
        if (isObj && fields[i].key in value) {
            bitflags[Math.floor(i / 7)] |= (1 << (i % 7));
        }
    }

    // Mark all bitflag bytes except the last with MSB=1 ("more follows")
    for (let i = 0; i < numGroups - 1; i++) bitflags[i] |= 0x80;
    for (const bf of bitflags) buffer.push(bf);

    for (let i = 0; i < fields.length; i++) {
        const groupIdx = Math.floor(i / 7);
        if (bitflags[groupIdx] & (1 << (i % 7))) {
            encodeNode(value[fields[i].key], fields[i].node, buffer);
        }
    }
}

/**
 * Encode a $map: [count:LEB] [ [keyLen:LEB][UTF-8 key] [value] ] …
 */
function encodeMap(value: any, valueNode: CompiledNode, buffer: number[]): void {
    if (!value || typeof value !== 'object') {
        writeLEB128(buffer, 0);
        return;
    }
    const keys = Object.keys(value);
    writeLEB128(buffer, keys.length);
    for (const key of keys) {
        const keyBytes = _textEncoder.encode(key);
        writeLEB128(buffer, keyBytes.length);
        for (const b of keyBytes) buffer.push(b);
        encodeNode(value[key], valueNode, buffer);
    }
}

/**
 * Encode a $array.
 *
 * If the value is an array whose first element has an `op` property, the array
 * is treated as a sequence of delta operations (mode 1 / flexible).
 * Otherwise it is treated as a plain standard array (mode 0).
 *
 * Flexible op object shape (mirrors existing ArrayChange types):
 *   { op: 'resize',   value: number }
 *   { op: 'set',      index: number, value: any }
 *   { op: 'patch',    index: number, value: any }
 *   { op: 'setrange', index: number, values: any[] }
 *   { op: 'fill',     index: number, count: number, value: any }
 *   { op: 'replace',  values: any[] }
 */
function encodeArray(value: any, elementNode: CompiledNode, buffer: number[]): void {
    if (!Array.isArray(value)) {
        buffer.push(0); // mode 0
        writeLEB128(buffer, 0);
        return;
    }

    const isDelta = value.length > 0 &&
                    value[0] !== null &&
                    typeof value[0] === 'object' &&
                    'op' in value[0];

    if (isDelta) {
        buffer.push(1); // mode 1: flexible / delta
        writeLEB128(buffer, value.length);
        for (const op of value) encodeArrayOp(op, elementNode, buffer);
    } else {
        buffer.push(0); // mode 0: standard
        writeLEB128(buffer, value.length);
        for (const item of value) encodeNode(item, elementNode, buffer);
    }
}

// Flexible-array op codes
const AROP_RESIZE   = 1;
const AROP_SET      = 2;
const AROP_PATCH    = 3;
const AROP_SETRANGE = 4;
const AROP_FILL     = 5;
const AROP_REPLACE  = 6;

function encodeArrayOp(op: any, elementNode: CompiledNode, buffer: number[]): void {
    switch (op.op) {
        case 'resize':
            buffer.push(AROP_RESIZE);
            writeLEB128(buffer, op.value);
            return;
        case 'set':
            buffer.push(AROP_SET);
            writeLEB128(buffer, op.index);
            encodeNode(op.value, elementNode, buffer);
            return;
        case 'patch':
            buffer.push(AROP_PATCH);
            writeLEB128(buffer, op.index);
            encodeNode(op.value, elementNode, buffer);
            return;
        case 'setrange':
            buffer.push(AROP_SETRANGE);
            writeLEB128(buffer, op.index);
            writeLEB128(buffer, op.values.length);
            for (const v of op.values) encodeNode(v, elementNode, buffer);
            return;
        case 'fill':
            buffer.push(AROP_FILL);
            writeLEB128(buffer, op.index);
            writeLEB128(buffer, op.count ?? op.length ?? 1);
            encodeNode(op.value, elementNode, buffer);
            return;
        case 'replace':
            buffer.push(AROP_REPLACE);
            writeLEB128(buffer, op.values.length);
            for (const v of op.values) encodeNode(v, elementNode, buffer);
            return;
    }
}

/**
 * Encode a $static array.
 *
 * Input shape → wire mode:
 *   Plain array (no op property on first element) → mode 4 (refresh/replace-all)
 *   Array of { op: 'set'|'patch', index, value }  → mode 2 (by-index updates)
 *   Single { op: 'fill', index, count, value }     → mode 3 (fill)
 */
function encodeStaticArray(value: any, elementNode: CompiledNode, buffer: number[]): void {
    if (!Array.isArray(value)) {
        buffer.push(4); // mode 4: empty refresh
        writeLEB128(buffer, 0);
        return;
    }

    const isOps = value.length > 0 &&
                  value[0] !== null &&
                  typeof value[0] === 'object' &&
                  'op' in value[0];

    if (isOps) {
        if (value.length === 1 && value[0].op === 'fill') {
            // Mode 3: fill a range with a single value
            const { index = 0, count = 1, value: fillVal } = value[0];
            buffer.push(3);
            writeLEB128(buffer, count);
            writeLEB128(buffer, index);
            encodeNode(fillVal, elementNode, buffer);
        } else {
            // Mode 2: sparse by-index updates
            buffer.push(2);
            const setOps = value.filter((op: any) => op.op === 'set' || op.op === 'patch');
            writeLEB128(buffer, setOps.length);
            for (const op of setOps) {
                writeLEB128(buffer, op.index);
                encodeNode(op.value, elementNode, buffer);
            }
        }
    } else {
        // Mode 4: full refresh
        buffer.push(4);
        writeLEB128(buffer, value.length);
        for (const item of value) encodeNode(item, elementNode, buffer);
    }
}

// ─── Decoder ──────────────────────────────────────────────────────────────────

export function decodeNode(ref: DecodeRef, node: CompiledNode): any {
    switch (node.kind) {
        case 'primitive': return decodePrimitive(ref, node.type);
        case 'object':    return decodeObject(ref, node.fields);
        case 'map':       return decodeMap(ref, node.valueNode);
        case 'array':     return decodeArray(ref, node.elementNode);
        case 'static':    return decodeStaticArray(ref, node.elementNode);
    }
}

function decodePrimitive(ref: DecodeRef, type: PrimitiveKind): any {
    switch (type) {
        case 'uint': return readLEB128(ref);
        case 'int':  return readSLEB128(ref);
        case 'float': {
            const v = ref.view.getFloat64(ref.pos);
            ref.pos += 8;
            return v;
        }
        case 'string':
            return decodeStringWT(ref);
        case 'boolean':
            return ref.view.getUint8(ref.pos++) !== 0;
        case 'null':
            return null;
        case 'undefined':
            return undefined;
        default: {
            // 'object', 'array', or unknown → encoder fallback
            const exRef = { buffer: ref.view, pos: ref.pos, dict: _emptyDict };
            const result = deserializeEX(exRef);
            ref.pos = exRef.pos;
            return result;
        }
    }
}

/**
 * Decode a bitflag-encoded $object.
 *
 * Reads bitflag bytes until one with MSB=0 is encountered, then uses the
 * accumulated bits to determine which fields are present, and decodes them
 * in schema-definition order.
 */
function decodeObject(ref: DecodeRef, fields: CompiledField[]): any {
    const result: any = {};

    // Read bitflag bytes; stop when MSB is clear (last byte)
    const bitflags: number[] = [];
    while (true) {
        const bf = ref.view.getUint8(ref.pos++);
        bitflags.push(bf & 0x7F); // strip the MSB before storing
        if (!(bf & 0x80)) break;
    }

    for (let i = 0; i < fields.length; i++) {
        const groupIdx = Math.floor(i / 7);
        if (groupIdx < bitflags.length && (bitflags[groupIdx] & (1 << (i % 7)))) {
            result[fields[i].key] = decodeNode(ref, fields[i].node);
        }
    }

    return result;
}

/**
 * Decode a $map: [count:LEB] [ [keyLen:LEB][UTF-8 key] [value] ] …
 */
function decodeMap(ref: DecodeRef, valueNode: CompiledNode): any {
    const count = readLEB128(ref);
    const result: any = {};
    for (let i = 0; i < count; i++) {
        const keyLen = readLEB128(ref);
        const keyArr = new Uint8Array(keyLen);
        for (let j = 0; j < keyLen; j++) keyArr[j] = ref.view.getUint8(ref.pos++);
        const key = _textDecoder.decode(keyArr);
        result[key] = decodeNode(ref, valueNode);
    }
    return result;
}

/**
 * Decode a $array.  Reads the mode byte then dispatches accordingly.
 */
function decodeArray(ref: DecodeRef, elementNode: CompiledNode): any {
    const mode  = ref.view.getUint8(ref.pos++);
    const count = readLEB128(ref);

    if (mode === 0) {
        // Standard
        const result: any[] = [];
        for (let i = 0; i < count; i++) result.push(decodeNode(ref, elementNode));
        return result;
    }

    // Mode 1: flexible ops
    const result: any[] = [];
    for (let i = 0; i < count; i++) result.push(decodeArrayOp(ref, elementNode));
    return result;
}

function decodeArrayOp(ref: DecodeRef, elementNode: CompiledNode): any {
    const opCode = ref.view.getUint8(ref.pos++);
    switch (opCode) {
        case AROP_RESIZE:
            return { op: 'resize', value: readLEB128(ref) };
        case AROP_SET:
            return { op: 'set', index: readLEB128(ref), value: decodeNode(ref, elementNode) };
        case AROP_PATCH:
            return { op: 'patch', index: readLEB128(ref), value: decodeNode(ref, elementNode) };
        case AROP_SETRANGE: {
            const index  = readLEB128(ref);
            const n      = readLEB128(ref);
            const values: any[] = [];
            for (let i = 0; i < n; i++) values.push(decodeNode(ref, elementNode));
            return { op: 'setrange', index, values };
        }
        case AROP_FILL: {
            const index = readLEB128(ref);
            const count = readLEB128(ref);
            const value = decodeNode(ref, elementNode);
            return { op: 'fill', index, count, value };
        }
        case AROP_REPLACE: {
            const n = readLEB128(ref);
            const values: any[] = [];
            for (let i = 0; i < n; i++) values.push(decodeNode(ref, elementNode));
            return { op: 'replace', values };
        }
        default:
            throw new Error(`[protocol-withtypes] Unknown $array op code: ${opCode}`);
    }
}

/**
 * Decode a $static array.  Reads the mode byte then dispatches accordingly.
 *
 * Returns:
 *   mode 2 → [ { op:'set', index, value }, … ]
 *   mode 3 → [ { op:'fill', index, count, value } ]
 *   mode 4 → plain array (full snapshot)
 */
function decodeStaticArray(ref: DecodeRef, elementNode: CompiledNode): any {
    const mode = ref.view.getUint8(ref.pos++);

    switch (mode) {
        case 2: {
            const count = readLEB128(ref);
            const result: any[] = [];
            for (let i = 0; i < count; i++) {
                const index = readLEB128(ref);
                const value = decodeNode(ref, elementNode);
                result.push({ op: 'set', index, value });
            }
            return result;
        }
        case 3: {
            const count = readLEB128(ref);
            const index = readLEB128(ref);
            const value = decodeNode(ref, elementNode);
            return [{ op: 'fill', index, count, value }];
        }
        case 4: {
            const count = readLEB128(ref);
            const result: any[] = [];
            for (let i = 0; i < count; i++) result.push(decodeNode(ref, elementNode));
            return result;
        }
        default:
            throw new Error(`[protocol-withtypes] Unknown $static mode: ${mode}`);
    }
}

// ─── Protocol registry ────────────────────────────────────────────────────────

interface RegisteredProtocol {
    /** 1-based sequential index written as the first byte of every message. */
    typeIndex: number;
    /** Compiled schema for the message payload. */
    payloadNode: CompiledNode;
}

const _protocols        = new Map<string, RegisteredProtocol>();
const _typeIndexToName  = new Map<number, string>();
let   _nextTypeIndex    = 1;

/**
 * Register a protocol definition.
 *
 * Accepts two calling conventions:
 *
 *   1. registerProtocolWT({ type: "NAME", payload: { … } })
 *      The type name and payload schema are taken from the object's `type` and
 *      `payload` properties.  This matches the wire-message envelope format.
 *
 *   2. registerProtocolWT("NAME", payloadSchema)
 *      Registers `payloadSchema` directly as the payload schema for `"NAME"`.
 *      Use this when importing a bare schema object (e.g. protocol-test-types.ts)
 *      that does not carry a `type`/`payload` envelope.
 *
 * Calling with the same type name twice is a no-op.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerProtocolWT(protocolOrTypeName: any, payloadSchema?: any): void {
    let typeName: string;
    let schema: any;

    if (typeof protocolOrTypeName === 'string') {
        typeName = protocolOrTypeName;
        schema   = payloadSchema;
    } else {
        typeName = protocolOrTypeName?.type;
        schema   = protocolOrTypeName?.payload ?? protocolOrTypeName;
    }

    if (!typeName) throw new Error('[protocol-withtypes] Protocol must have a "type" string field');
    if (_protocols.has(typeName)) return;

    const typeIndex   = _nextTypeIndex++;
    const payloadNode = compileSchema(schema);

    _protocols.set(typeName, { typeIndex, payloadNode });
    _typeIndexToName.set(typeIndex, typeName);
}

/**
 * Encode a `{ type, payload }` message to an ArrayBuffer.
 *
 * Wire format:
 *   [typeIndex: uint8] [payload encoded per registered schema]
 *
 * If the message type is not registered, typeIndex 0 is written and the full
 * object is serialised with the generic fallback encoder.
 *
 * @param data   Object with `type` string and `payload` object.
 * @returns      ArrayBuffer containing the encoded bytes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function protoEncodeWT(data: { type: string; payload: any } | any): ArrayBuffer {
    const proto  = _protocols.get(data?.type);
    const buffer: number[] = [];

    if (!proto) {
        buffer.push(0); // typeIndex 0 = unknown / fallback
        const dict = createDefaultDict();
        dict.frozen = true;
        serializeEX(data, buffer, dict, {});
        return new Uint8Array(buffer).buffer;
    }

    buffer.push(proto.typeIndex);
    encodeNode(data.payload, proto.payloadNode, buffer);
    return new Uint8Array(buffer).buffer;
}

/**
 * Decode bytes produced by `protoEncodeWT` back to `{ type, payload }`.
 *
 * @param data   ArrayBuffer or ArrayBufferView (e.g. Uint8Array, Buffer).
 * @returns      Object with a `type` string and a `payload` object.
 * @throws       Error if the type index is non-zero but unregistered.
 */
export function protoDecodeWT(data: ArrayBuffer | ArrayBufferView): { type: string; payload: any } {
    let view: DataView;
    if (data instanceof ArrayBuffer) {
        view = new DataView(data);
    } else {
        view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }

    const ref: DecodeRef = { view, pos: 0 };
    const typeIndex = ref.view.getUint8(ref.pos++);

    if (typeIndex === 0) {
        // Fallback: encoded with generic serialiser
        const dict = createDefaultDict();
        dict.frozen = true;
        const exRef = { buffer: view, pos: ref.pos, dict };
        return deserializeEX(exRef);
    }

    const typeName = _typeIndexToName.get(typeIndex);
    if (!typeName) {
        throw new Error(`[protocol-withtypes] Unknown type index: ${typeIndex}`);
    }

    const proto   = _protocols.get(typeName)!;
    const payload = decodeNode(ref, proto.payloadNode);
    return { type: typeName, payload };
}
