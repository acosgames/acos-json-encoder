import { createDefaultDict, serializeEX, deserializeEX } from "./encoder.js";
import { decodeString, encodeFloat64, decodeFloat64, encodeString, isObject, readLEB128, readSLEB128, writeLEB128, writeSLEB128 } from "./helper.js";
import { compileSchema } from "./schema-compiler.js";

function deepCloneNode(node: CompiledNode): CompiledNode {
    switch (node.kind) {
        case 'any':
        case 'primitive':
            return { ...node };
        case 'object':
            return { kind: 'object', mapping: { ...node.mapping }, fields: node.fields.map(f => ({ key: f.key, node: deepCloneNode(f.node) })) };
        case 'map':
             return { kind: 'map', mapping: { ...node.mapping }, fields: node.fields.map(f => ({ key: f.key, node: deepCloneNode(f.node) })) };
            // return { kind: 'map', valueNode: deepCloneNode(node.valueNode) };
        case 'array':
            return { kind: 'array', elementNode: deepCloneNode(node.elementNode) };
        case 'static':
            return { kind: 'static', elementNode: deepCloneNode(node.elementNode) };
        case 'custom':
            return { kind: 'custom', node: deepCloneNode(node.node) };
        case 'enum':
            return { kind: 'enum', values: [...node.values] };
        case 'variants':
            return { kind: 'variants', variants: node.variants.map(v => ({ name: v.name, node: deepCloneNode(v.node) })) };
    }
}

let registeredProtocols: Protocol[] = [{ type: 'default', index: 0, schema: compileSchema({}) } as Protocol]; // 1-based indexing; position 0 is reserved for fallback
let protocolMap: { [key: string]: number } = {};

export function setDefaultDictionary(dictionaryList: string[]): void {
    const dict = createDefaultDict(dictionaryList);
    dict.frozen = true;
    registeredProtocols[0].dictionary = dict;
}

// ─── Named extension registry ────────────────────────────────────────────────

const extensionRegistry: Record<string, Record<string, Record<string, any>>> = {};

/**
 * Define a named extension for a registered protocol.
 * The extension is stored but not applied until `applyExtension` is called.
 *
 * @param baseType  The protocol type name (must already be registered).
 * @param name      An identifier for this extension (e.g. 'chess', 'poker').
 * @param overrides Schema overrides — same syntax as `registerProtocol` payload.
 */
export function registerExtension(baseType: string, name: string, overrides: Record<string, any>): void {
    if (!extensionRegistry[baseType]) extensionRegistry[baseType] = {};
    extensionRegistry[baseType][name] = overrides;
}

/**
 * Switch a protocol to a named extension.
 * Always resets to the original base schema first, then applies the
 * extension — so switching extensions never accumulates stale overrides.
 *
 * @param baseType  The protocol type name.
 * @param name      The extension name previously registered with `registerExtension`.
 */
export function applyExtension(baseType: string, name: string): void {
    const protocol = getProtocol(baseType);
    if (!protocol.originalSchema) throw new Error(`Protocol '${baseType}' has no original schema.`);
    const exts = extensionRegistry[baseType];
    if (!exts || !exts[name]) throw new Error(`Extension '${name}' not registered for protocol '${baseType}'.`);
    protocol.schema = deepCloneNode(protocol.originalSchema);
    extendNode(protocol.schema, exts[name]);
}

/**
 * Disable the active extension for a protocol, reverting it to the base schema.
 */
export function disableExtension(baseType: string): void {
    const protocol = getProtocol(baseType);
    if (!protocol.originalSchema) throw new Error(`Protocol '${baseType}' has no original schema.`);
    protocol.schema = deepCloneNode(protocol.originalSchema);
}

function extendNode(node: CompiledNode, overrides: Record<string, any>): void {
    if (node.kind !== 'object') return;
    for (const key of Object.keys(overrides)) {
        const existingIdx = node.mapping[key];
        if (existingIdx !== undefined) {
            const existingField = node.fields[existingIdx];
            const child = existingField.node;
            if (child.kind === 'custom') {
                // $slot field: replace with the compiled override schema
                node.fields[existingIdx] = { key, node: compileSchema(overrides[key]) };
            } else if (child.kind === 'enum' &&
                overrides[key] !== null &&
                typeof overrides[key] === 'object' &&
                '$enum' in overrides[key] &&
                Array.isArray(overrides[key]['$enum'])
            ) {
                // Append new enum values to the existing set
                child.values = [...child.values, ...overrides[key]['$enum']];
            } else if (
                overrides[key] !== null &&
                typeof overrides[key] === 'object' &&
                !Array.isArray(overrides[key])
            ) {
                if (child.kind === 'object') {
                    extendNode(child, overrides[key]);
                } else if (child.kind === 'static' || child.kind === 'array') {
                    // Unwrap $static/$array wrapper if present (e.g. { $static: { newKey: … } })
                    const wrapKey = child.kind === 'static' ? '$static' : '$array';
                    const inner = (wrapKey in overrides[key]) ? overrides[key][wrapKey] : overrides[key];
                    if (inner !== null && typeof inner === 'object' && !Array.isArray(inner)) {
                        extendNode(child.elementNode, inner);
                    }
                }
            }
            // else: leaf or unrecursable — skip silently
        } else {
            // New key not in the original schema — always append
            node.mapping[key] = node.fields.length;
            node.fields.push({ key, node: compileSchema(overrides[key]) });
        }
    }
}



function describeNode(node: CompiledNode): any {
    switch (node.kind) {
        case 'any':       return 'any';
        case 'primitive': return node.type;
        case 'object': {
            const out: Record<string, any> = {};
            for (const f of node.fields) out[f.key] = describeNode(f.node);
            return out;
        }
        case 'array':  return { $array:  describeNode(node.elementNode) };
        case 'static': return { $static: describeNode(node.elementNode) };
        case 'map': {
            const out: Record<string, any> = {};
            for (const f of node.fields) out[f.key] = describeNode(f.node);
            return { $map: out };
        }
        case 'custom': return describeNode(node.node);
        case 'enum':   return { $enum: node.values };
        case 'variants': {
            const out: Record<string, any> = {};
            for (const v of node.variants) out[v.name] = describeNode(v.node);
            return { $variants: out };
        }
    }
}

export function getProtocolSchema(type: string): any {
    const protocol = getProtocol(type);
    if (!protocol || protocol.index === 0) return null;
    return describeNode(protocol.schema);
}

export function registerProtocol(protocol: any, dictionaryList?: string[]) {

    if (!protocol.type || typeof protocol.type !== 'string') {
        throw new Error("Protocol must have a 'type' key with string value. Name of the protocol.");
    }

    if (protocol.type in protocolMap) {
        throw new Error(`Protocol with type '${protocol.type}' is already registered.`);
    }

    let dictionary: EncoderDict | undefined = undefined;
    // if (Array.isArray(dictionaryList) && dictionaryList.length > 0) {
    dictionary = dictionaryList || protocol.dictionary || createDefaultDict([]);
    if (dictionary)
        dictionary.frozen = true;
    // }

    const schema = compileSchema(protocol.payload);
    const index = registeredProtocols.length;
    protocolMap[protocol.type] = index;

    registeredProtocols.push({ type: protocol.type, index, schema, originalSchema: deepCloneNode(schema), dictionary });
}

function getProtocolById(index: number): Protocol {
    if (index < 0 || index >= registeredProtocols.length) {
        throw new Error(`Protocol index ${index} is out of range.`);
    }
    return registeredProtocols[index];
}
function getProtocol(type: string): Protocol {
    if (type === undefined || typeof type !== 'string') {
        throw new Error("Protocol 'type' must be a string.");
    }
    let index = protocolMap[type];
    if (index === undefined) {
        index = 0;
        // throw new Error(`Protocol with type '${type}' is not registered.`);
    }
    return registeredProtocols[index];
}

export function protoEncode(payload: any): ArrayBuffer {

    let protocol = getProtocol(payload?.type);
    let buffer: number[] = [protocol.index];

    if (protocol.index === 0) {
        // Fallback: encode with generic serialiser using the default dictionary
        // (frozen so no dynamic entries are added that the decoder couldn't resolve).
        const fallbackDict = registeredProtocols[0].dictionary ?? (() => { const d = createDefaultDict([]); d.frozen = true; return d; })();
        serializeEX(payload, buffer, fallbackDict, {});
        return new Uint8Array(buffer).buffer;
    }
    encodeNode(payload.payload, protocol, protocol.schema, buffer);

    return new Uint8Array(buffer).buffer;
}

export function encodeNode(value: any, protocol: Protocol, node: CompiledNode, buffer: number[], cache: any = {}, path?: string): void {
    switch (node.kind) {
        case 'any': return serializeEX(value, buffer, protocol.dictionary, cache);
        case 'primitive': {
            // let before = buffer.length;

            encodePrimitive(value, protocol, node.type, buffer, cache, path);
            // console.log("Encoded primitive", node.type, "value:", value, "bytes:", buffer.length - before);
            return;
        }
        case 'object': return encodeObject(value, protocol, node.mapping, node.fields, buffer, cache);
        case 'map': return encodeMap(value, protocol, node, buffer, cache);
        case 'array': return encodeArray(value, protocol, node.elementNode, buffer, cache);
        case 'static': return encodeStaticArray(value, protocol, node.elementNode, buffer, cache);
        case 'custom': return encodeNode(value, protocol, node.node, buffer, cache);
        case 'enum': {
            const idx = node.values.indexOf(value);
            writeLEB128(buffer, idx >= 0 ? idx : node.values.length);
            return;
        }
        case 'variants': {
            const name = value?.type;
            const vidx = name !== undefined ? node.variants.findIndex(v => v.name === name) : -1;
            if (vidx < 0) throw new Error(`[protocol] Unknown variant type: ${name}`);
            writeLEB128(buffer, vidx);
            encodeNode(value.payload, protocol, node.variants[vidx].node, buffer, cache);
            return;
        }
    }
}

function encodePrimitive(value: any, protocol: Protocol, type: PrimitiveKind, buffer: number[], cache: any = {}, path?: string): void {
    const at = path ? ` at '${path}'` : '';
    if (value != null) {
        switch (type) {
            case 'uint':
            case 'int':
            case 'float':
                if (typeof value !== 'number')
                    throw new TypeError(`Protocol type mismatch${at}: expected '${type}' (number) but got ${typeof value} (${JSON.stringify(value)})`);
                if ((type === 'uint' || type === 'int') && !Number.isInteger(value))
                    throw new TypeError(`Protocol type mismatch${at}: expected '${type}' (integer) but got non-integer number (${value})`);
                if (type === 'uint' && value < 0)
                    throw new TypeError(`Protocol type mismatch${at}: expected 'uint' (non-negative) but got negative value (${value})`);
                break;
            case 'string':
                if (typeof value !== 'string')
                    throw new TypeError(`Protocol type mismatch${at}: expected 'string' but got ${typeof value} (${JSON.stringify(value)})`);
                break;
            case 'boolean':
                if (typeof value !== 'boolean')
                    throw new TypeError(`Protocol type mismatch${at}: expected 'boolean' but got ${typeof value} (${JSON.stringify(value)})`);
                break;
        }
    }
    switch (type) {
        case 'uint':
            writeLEB128(buffer, value == null ? 0 : Math.max(0, Math.floor(value)));
            return;
        case 'int':
            writeSLEB128(buffer, value == null ? 0 : value);
            return;
        case 'float':
            encodeFloat64(value == null ? 0 : value, buffer);
            return;
        case 'string':
            encodeString(value == null ? '' : String(value), buffer, protocol.dictionary, cache);
            return;
        case 'boolean':
            buffer.push(value ? 1 : 0);
            return;
        case 'null':
        case 'undefined':
            // no bytes written; the schema declares the type
            return;
        default:
            // 'object', 'array', or any unrecognised type → encoder fallback
            serializeEX(value, buffer, protocol.dictionary, cache);
            return;
    }
}


/**
 * Encode the value of a `$deleted` extra: bitflag bytes marking which schema
 * fields are deleted (MSB-continuation, same scheme as the object presence
 * bitflags) followed by a LEB128 count of non-schema keys and their UTF-8
 * string encodings.
 */
function encodeDeletionValue(
    deletedKeys: string[],
    fields: CompiledField[],
    mapping: Record<string, number>,
    buffer: number[],
    protocol: Protocol,
    cache: any
): void {
    const numGroups = fields.length > 0 ? Math.ceil(fields.length / 7) : 1;
    const bitflags = new Array<number>(numGroups).fill(0);
    const extraDelKeys: string[] = [];

    for (const dk of deletedKeys) {
        const didx = mapping[dk];
        if (didx !== undefined) {
            bitflags[Math.floor(didx / 7)] |= (1 << (didx % 7));
        } else {
            extraDelKeys.push(dk);
        }
    }

    for (let i = 0; i < numGroups - 1; i++) bitflags[i] |= 0x80;
    for (const bf of bitflags) buffer.push(bf);

    writeLEB128(buffer, extraDelKeys.length);
    for (const k of extraDelKeys) encodeString(k, buffer, protocol.dictionary, cache);
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
function encodeObject(value: any, protocol: Protocol, mapping: Record<string, number>, fields: CompiledField[], buffer: number[], cache: any = {}): void {
    if (fields.length === 0) {
        // No schema keys → fall back to generic serialisation
        serializeEX(value, buffer, protocol.dictionary, cache);
        return;
    }

    const isObj = isObject(value);

    // Single pass: collect schema field presence, extras, and $deleted
    const extras: string[] = [];
    let maxIndex = -1;
    let deletedKeys: string[] | null = null;
    if (isObj) {
        for (const key in value) {
            const idx = mapping[key];
            if (idx !== undefined) {
                if (idx > maxIndex) maxIndex = idx;
            } else if (key === '$deleted') {
                const dk = value[key];
                if (Array.isArray(dk) && dk.length > 0) deletedKeys = dk;
            } else {
                extras.push(key);
            }
        }
    }

    // Short-encode: only write schema groups up to the highest present field.
    // Full-encode (all fields.length groups) is required when extras or deletions
    // follow, so the decoder can locate the boundary between schema and extra groups.
    const schemaGroups = (extras.length > 0 || deletedKeys)
        ? Math.ceil(fields.length / 7)
        : Math.max(1, Math.ceil((maxIndex + 1) / 7));

    // Extra groups use bits 0-5 for count (0-63 each), bit 6 of last group = has-deletions flag
    const extraGroups = extras.length > 0
        ? Math.ceil(extras.length / 63)
        : (deletedKeys ? 1 : 0);

    const numGroups = schemaGroups + extraGroups;
    const bitflags = new Array<number>(numGroups).fill(0);

    for (let i = 0; i < fields.length; i++) {
        if (isObj && fields[i].key in value) {
            bitflags[Math.floor(i / 7)] |= (1 << (i % 7));
        }
    }

    if (extraGroups > 0) {
        // Non-last extra groups: full count of 63
        for (let g = 0; g < extraGroups - 1; g++) {
            bitflags[schemaGroups + g] = 63; // bit 7 (continuation) added below
        }
        // Last extra group: bits 0-5 = count, bit 6 = has-deletions
        const lastGroupCount = extras.length > 0 ? extras.length - (extraGroups - 1) * 63 : 0;
        bitflags[schemaGroups + extraGroups - 1] = lastGroupCount | (deletedKeys ? 0x40 : 0);
    }

    // Mark all bitflag bytes except the last with MSB=1 ("more follows")
    for (let i = 0; i < numGroups - 1; i++) bitflags[i] |= 0x80;
    for (const bf of bitflags) buffer.push(bf);

    for (let i = 0; i < fields.length; i++) {
        const groupIdx = Math.floor(i / 7);
        if (bitflags[groupIdx] & (1 << (i % 7))) {
            encodeNode(value[fields[i].key], protocol, fields[i].node, buffer, cache, fields[i].key);
        }
    }

    // Encode regular extra key-value pairs after schema fields
    for (const key of extras) {
        encodeString(key, buffer, protocol.dictionary, cache);
        serializeEX(value[key], buffer, protocol.dictionary, cache);
    }

    // Deletion data follows extras directly — no key string needed, signalled by bit 6 above
    if (deletedKeys) {
        encodeDeletionValue(deletedKeys, fields, mapping, buffer, protocol, cache);
    }
}

/**
 * Encode a $map: [count:LEB] [ [keyLen:LEB][UTF-8 key] [value] ] …
 */
function encodeMap(value: any, protocol: Protocol, mapNode: CompiledNode, buffer: number[], cache: any = {}): void {
    if (!value || typeof value !== 'object') {
        writeLEB128(buffer, 0);
        return;
    }
    const keys = Object.keys(value);
    writeLEB128(buffer, keys.length);
    const valueNode: CompiledNode = (mapNode.kind === 'map')
        ? { kind: 'object', mapping: mapNode.mapping, fields: mapNode.fields }
        : mapNode;
    for (const key of keys) {
        encodeString(key, buffer, protocol.dictionary, cache);
        encodeNode(value[key], protocol, valueNode, buffer, cache);
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
 *   { op: 'setrange', index: number, values: any[] }
 *   { op: 'fill',     index: number, count: number, value: any }
 *   { op: 'replace',  values: any[] }
 */
function encodeArray(value: any, protocol: Protocol, elementNode: CompiledNode, buffer: number[], cache: any = {}): void {
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
        for (const op of value) encodeArrayOp(op, protocol, elementNode, buffer, cache);
    } else {
        buffer.push(0); // mode 0: standard
        writeLEB128(buffer, value.length);
        for (const item of value) encodeNode(item, protocol, elementNode, buffer, cache);
    }
}

// Flexible-array op codes
const AROP_RESIZE = 1;
const AROP_SET = 2;
const AROP_SETRANGE = 4;
const AROP_FILL = 5;
const AROP_REPLACE = 6;

function encodeArrayOp(op: any, protocol: Protocol, elementNode: CompiledNode, buffer: number[], cache: any = {}): void {
    switch (op.op) {
        case 'resize':
            buffer.push(AROP_RESIZE);
            writeLEB128(buffer, op.value);
            return;
        case 'set':
            buffer.push(AROP_SET);
            writeLEB128(buffer, op.index);
            encodeNode(op.value, protocol, elementNode, buffer, cache);
            return;
        case 'setrange':
            buffer.push(AROP_SETRANGE);
            writeLEB128(buffer, op.index);
            writeLEB128(buffer, op.values.length);
            for (const v of op.values) encodeNode(v, protocol, elementNode, buffer, cache);
            return;
        case 'fill':
            buffer.push(AROP_FILL);
            writeLEB128(buffer, op.index);
            writeLEB128(buffer, op.count ?? op.length ?? 1);
            encodeNode(op.value, protocol, elementNode, buffer, cache);
            return;
        case 'replace':
            buffer.push(AROP_REPLACE);
            writeLEB128(buffer, op.values.length);
            for (const v of op.values) encodeNode(v, protocol, elementNode, buffer, cache);
            return;
    }
}

/**
 * Encode a $static array.
 *
 * Wire format: [count:LEB] [(index:LEB)(value)]×count
 *
 * Input can be a plain array (indices 0…n-1 implied) or an array of ops:
 *   { op: 'set',      index, value }            → single (index, value) pair
 *   { op: 'fill',     index, count/length, value } → expanded to count pairs
 *   { op: 'setrange', index, values }           → expanded to values.length pairs
 */
function encodeStaticArray(value: any, protocol: Protocol, elementNode: CompiledNode, buffer: number[], cache: any = {}): void {
    if (!Array.isArray(value) || value.length === 0) {
        writeLEB128(buffer, 0);
        return;
    }

    const isOps = value[0] !== null && typeof value[0] === 'object' && 'op' in value[0];

    if (isOps) {
        // Expand all ops into (index, value) pairs
        const pairs: Array<{ index: number; value: any }> = [];
        for (const op of value) {
            if (op.op === 'set') {
                pairs.push({ index: op.index, value: op.value });
            } else if (op.op === 'fill') {
                const n = op.count ?? op.length ?? 1;
                for (let i = 0; i < n; i++) pairs.push({ index: (op.index ?? 0) + i, value: op.value });
            } else if (op.op === 'setrange') {
                for (let i = 0; i < op.values.length; i++) pairs.push({ index: op.index + i, value: op.values[i] });
            }
        }
        writeLEB128(buffer, pairs.length);
        for (const { index, value: v } of pairs) {
            writeLEB128(buffer, index);
            encodeNode(v, protocol, elementNode, buffer, cache);
        }
    } else {
        // Plain array: encode all elements with 0-based indices
        writeLEB128(buffer, value.length);
        for (let i = 0; i < value.length; i++) {
            writeLEB128(buffer, i);
            encodeNode(value[i], protocol, elementNode, buffer, cache);
        }
    }
}


export function protoDecode(data: ArrayBuffer | Uint8Array, dictionaryList?: EncoderDict): { type: string; payload: any } {
    let view: DataView;
    if (data instanceof ArrayBuffer) {
        view = new DataView(data);
    } else {
        view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }

    const ref: DecodeRef = { view, pos: 0, dictionary: undefined };
    const typeIndex = ref.view.getUint8(ref.pos++);

    const protocol = getProtocolById(typeIndex);

    if (typeIndex === 0) {
        // Fallback: encoded with generic serialiser — use same default dictionary
        const fallbackDict = registeredProtocols[0].dictionary ?? (() => { const d = createDefaultDict([]); d.frozen = true; return d; })();
        const exRef = { buffer: view, pos: ref.pos, dict: fallbackDict };
        return deserializeEX(exRef);
    }

    if (!protocol) {
        throw new Error(`[protocol-withtypes] Unknown type index: ${typeIndex}`);
    }

    ref.dictionary = dictionaryList || protocol.dictionary;

    const payload = decodeNode(ref, protocol, protocol.schema);
    return { type: protocol.type, payload };
}



// ─── Decoder ──────────────────────────────────────────────────────────────────

export function decodeNode(ref: DecodeRef, protocol: Protocol, node: CompiledNode): any {
    switch (node.kind) {
        case 'any': {
            let exRef = { buffer: ref.view, pos: ref.pos, dict: ref.dictionary };
            let value = deserializeEX(exRef);
            ref.pos = exRef.pos;
            return value;
        }
        case 'primitive': return decodePrimitive(ref, protocol, node.type);
        case 'object': return decodeObject(ref, protocol, node.fields);
        case 'map': return decodeMap(ref, protocol, node);
        case 'array': return decodeArray(ref, protocol, node.elementNode);
        case 'static': return decodeStaticArray(ref, protocol, node.elementNode);
        case 'custom': return decodeNode(ref, protocol, node.node);
        case 'enum': {
            const idx = readLEB128(ref);
            return idx < node.values.length ? node.values[idx] : undefined;
        }
        case 'variants': {
            const vidx = readLEB128(ref);
            if (vidx >= node.variants.length) throw new Error(`[protocol] Unknown variant index: ${vidx}`);
            const payload = decodeNode(ref, protocol, node.variants[vidx].node);
            return { type: node.variants[vidx].name, payload };
        }
    }
}

function decodePrimitive(ref: DecodeRef, protocol: Protocol, type: PrimitiveKind): any {
    switch (type) {
        case 'uint': return readLEB128(ref);
        case 'int': return readSLEB128(ref);
        case 'float':
            return decodeFloat64(ref);
        case 'string':
            return decodeString(ref);
        case 'boolean':
            return ref.view.getUint8(ref.pos++) !== 0;
        case 'null':
            return null;
        case 'undefined':
            return undefined;
        default: {
            // 'object', 'array', or unknown → encoder fallback
            const exRef = { buffer: ref.view, pos: ref.pos, dict: ref.dictionary };
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
function decodeObject(ref: DecodeRef, protocol: Protocol, fields: CompiledField[]): any {
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
            result[fields[i].key] = decodeNode(ref, protocol, fields[i].node);
        }
    }

    // Extra groups: bits 0-5 = count per group (0-63), bit 6 of last = has-deletions.
    // The encoder may send fewer schema groups than ceil(fields.length/7) when there
    // are no extras or deletions, so use min() to find the actual boundary.
    const schemaGroupsFull = Math.ceil(fields.length / 7);
    const actualSchemaGroups = Math.min(bitflags.length, schemaGroupsFull);
    const extraGroupCount = bitflags.length - actualSchemaGroups;
    let hasDeletions = false;
    let extrasCount = 0;
    if (extraGroupCount > 0) {
        extrasCount = (extraGroupCount - 1) * 63; // non-last groups each hold 63
        const lastExtraBits = bitflags[actualSchemaGroups + extraGroupCount - 1];
        extrasCount += lastExtraBits & 0x3F;  // bits 0-5
        hasDeletions = (lastExtraBits & 0x40) !== 0;  // bit 6
    }
    for (let i = 0; i < extrasCount; i++) {
        const key = decodeString(ref);
        const exRef = { buffer: ref.view, pos: ref.pos, dict: ref.dictionary };
        result[key] = deserializeEX(exRef);
        ref.pos = exRef.pos;
    }
    if (hasDeletions) {
        // Read deletion bitflags (MSB-continuation) → schema field names
        const deleted: string[] = [];
        const bits: number[] = [];
        while (true) {
            const bf = ref.view.getUint8(ref.pos++);
            bits.push(bf & 0x7F);
            if (!(bf & 0x80)) break;
        }
        for (let b = 0; b < fields.length; b++) {
            const g = Math.floor(b / 7);
            if (g < bits.length && (bits[g] & (1 << (b % 7)))) deleted.push(fields[b].key);
        }
        // Non-schema keys follow as LEB128 count + UTF-8 strings
        const extraDelCount = readLEB128(ref);
        for (let j = 0; j < extraDelCount; j++) deleted.push(decodeString(ref));
        result['$deleted'] = deleted;
    }

    return result;
}

/**
 * Decode a $map: [count:LEB] [ [keyLen:LEB][UTF-8 key] [value] ] …
 */
function decodeMap(ref: DecodeRef, protocol: Protocol, mapNode: CompiledNode): any {
    const count = readLEB128(ref);
    const result: any = {};
    const valueNode: CompiledNode = (mapNode.kind === 'map')
        ? { kind: 'object', mapping: mapNode.mapping, fields: mapNode.fields }
        : mapNode;
    for (let i = 0; i < count; i++) {
        const key = decodeString(ref)
        result[key] = decodeNode(ref, protocol, valueNode);
    }
    return result;
}

/**
 * Decode a $array.  Reads the mode byte then dispatches accordingly.
 */
function decodeArray(ref: DecodeRef, protocol: Protocol, elementNode: CompiledNode): any {
    const mode = ref.view.getUint8(ref.pos++);
    const count = readLEB128(ref);

    if (mode === 0) {
        // Standard
        const result: any[] = [];
        for (let i = 0; i < count; i++) result.push(decodeNode(ref, protocol, elementNode));
        return result;
    }

    // Mode 1: flexible ops
    const result: any[] = [];
    for (let i = 0; i < count; i++) result.push(decodeArrayOp(ref, protocol, elementNode));
    return result;
}

function decodeArrayOp(ref: DecodeRef, protocol: Protocol, elementNode: CompiledNode): any {
    const opCode = ref.view.getUint8(ref.pos++);
    switch (opCode) {
        case AROP_RESIZE:
            return { op: 'resize', value: readLEB128(ref) };
        case AROP_SET:
            return { op: 'set', index: readLEB128(ref), value: decodeNode(ref, protocol, elementNode) };
        case AROP_SETRANGE: {
            const index = readLEB128(ref);
            const n = readLEB128(ref);
            const values: any[] = [];
            for (let i = 0; i < n; i++) values.push(decodeNode(ref, protocol, elementNode));
            return { op: 'setrange', index, values };
        }
        case AROP_FILL: {
            const index = readLEB128(ref);
            const count = readLEB128(ref);
            const value = decodeNode(ref, protocol, elementNode);
            return { op: 'fill', index, count, value };
        }
        case AROP_REPLACE: {
            const n = readLEB128(ref);
            const values: any[] = [];
            for (let i = 0; i < n; i++) values.push(decodeNode(ref, protocol, elementNode));
            return { op: 'replace', values };
        }
        default:
            throw new Error(`[protocol-withtypes] Unknown $array op code: ${opCode}`);
    }
}

/**
 * Decode a $static array.
 *
 * Wire format: [count:LEB] [(index:LEB)(value)]×count
 * Always returns an array of { op:'set', index, value } update ops.
 */
function decodeStaticArray(ref: DecodeRef, protocol: Protocol, elementNode: CompiledNode): any {
    const count = readLEB128(ref);
    const result: any[] = [];
    for (let i = 0; i < count; i++) {
        const index = readLEB128(ref);
        const value = decodeNode(ref, protocol, elementNode);
        result.push({ op: 'set', index, value });
    }
    return result;
}

// ─── Debug / Profiling ────────────────────────────────────────────────────────
// Zero overhead in production: none of these functions are referenced from any
// production encode path.  Call protoEncodeDebug to get a byte-level report.

export interface ProfileEntry {
    key: string;
    bytes: number;
    children?: ProfileEntry[];
}

/** Follow the custom-node chain to the underlying structural node. */
function dbgResolve(node: CompiledNode): CompiledNode {
    while (node.kind === 'custom') node = node.node;
    return node;
}

function dbgEncodeNode(
    value: any, protocol: Protocol, node: CompiledNode,
    buffer: number[], cache: any, profile: ProfileEntry[]
): void {
    const resolved = dbgResolve(node);
    switch (resolved.kind) {
        case 'object':   return dbgEncodeObject(value, protocol, resolved, buffer, cache, profile);
        case 'array':    return dbgEncodeArray(value, protocol, resolved.elementNode, buffer, cache, profile);
        case 'static':   return dbgEncodeStaticArray(value, protocol, resolved.elementNode, buffer, cache, profile);
        case 'map':      return dbgEncodeMap(value, protocol, resolved, buffer, cache, profile);
        case 'variants': return dbgEncodeVariants(value, protocol, resolved, buffer, cache, profile);
        default:
            // Primitive, enum, any: use production encoder.
            encodeNode(value, protocol, node, buffer, cache);
    }
}

function dbgEncodeObject(
    value: any, protocol: Protocol,
    node: CompiledNode & { kind: 'object' },
    buffer: number[], cache: any, profile: ProfileEntry[]
): void {
    const { mapping, fields } = node;
    if (fields.length === 0) {
        const before = buffer.length;
        serializeEX(value, buffer, protocol.dictionary, cache);
        profile.push({ key: '<generic>', bytes: buffer.length - before });
        return;
    }

    const isObj = isObject(value);

    // ── Replicate encodeObject header logic (must match production exactly) ──
    const extras: string[] = [];
    let maxIndex = -1;
    let deletedKeys: string[] | null = null;
    if (isObj) {
        for (const key in value) {
            const idx = mapping[key];
            if (idx !== undefined) {
                if (idx > maxIndex) maxIndex = idx;
            } else if (key === '$deleted') {
                const dk = value[key];
                if (Array.isArray(dk) && dk.length > 0) deletedKeys = dk;
            } else {
                extras.push(key);
            }
        }
    }

    const schemaGroups = (extras.length > 0 || deletedKeys)
        ? Math.ceil(fields.length / 7)
        : Math.max(1, Math.ceil((maxIndex + 1) / 7));

    const extraGroups = extras.length > 0
        ? Math.ceil(extras.length / 63)
        : (deletedKeys ? 1 : 0);

    const numGroups = schemaGroups + extraGroups;
    const bitflags = new Array<number>(numGroups).fill(0);

    for (let i = 0; i < fields.length; i++) {
        if (isObj && fields[i].key in value) {
            bitflags[Math.floor(i / 7)] |= (1 << (i % 7));
        }
    }

    if (extraGroups > 0) {
        for (let g = 0; g < extraGroups - 1; g++) {
            bitflags[schemaGroups + g] = 63;
        }
        const lastGroupCount = extras.length > 0 ? extras.length - (extraGroups - 1) * 63 : 0;
        bitflags[schemaGroups + extraGroups - 1] = lastGroupCount | (deletedKeys ? 0x40 : 0);
    }

    for (let i = 0; i < numGroups - 1; i++) bitflags[i] |= 0x80;
    // ─────────────────────────────────────────────────────────────────────────

    // Header bytes (bitflags)
    const headerStart = buffer.length;
    for (const bf of bitflags) buffer.push(bf);
    profile.push({ key: '<header>', bytes: buffer.length - headerStart });

    // Per-field bytes
    for (let i = 0; i < fields.length; i++) {
        if (isObj && fields[i].key in value) {
            const before = buffer.length;
            const childProfile: ProfileEntry[] = [];
            dbgEncodeNode(value[fields[i].key], protocol, fields[i].node, buffer, cache, childProfile);
            profile.push({
                key: fields[i].key,
                bytes: buffer.length - before,
                children: childProfile.length > 0 ? childProfile : undefined,
            });
        }
    }

    // Extras bytes
    if (extras.length > 0) {
        const extrasStart = buffer.length;
        for (const key of extras) {
            encodeString(key, buffer, protocol.dictionary, cache);
            serializeEX(value[key], buffer, protocol.dictionary, cache);
        }
        profile.push({ key: '<extras>', bytes: buffer.length - extrasStart });
    }

    // Deletion bytes
    if (deletedKeys) {
        const delStart = buffer.length;
        encodeDeletionValue(deletedKeys, fields, mapping, buffer, protocol, cache);
        profile.push({ key: '<$deleted>', bytes: buffer.length - delStart });
    }
}

function dbgEncodeArray(
    value: any, protocol: Protocol, elementNode: CompiledNode,
    buffer: number[], cache: any, profile: ProfileEntry[]
): void {
    if (!Array.isArray(value)) {
        const s = buffer.length;
        buffer.push(0); writeLEB128(buffer, 0);
        profile.push({ key: '<header>', bytes: buffer.length - s });
        return;
    }

    const isDelta = value.length > 0 &&
        value[0] !== null && typeof value[0] === 'object' && 'op' in value[0];

    const headerStart = buffer.length;
    if (isDelta) {
        buffer.push(1);
        writeLEB128(buffer, value.length);
        profile.push({ key: '<header>', bytes: buffer.length - headerStart });
        for (let i = 0; i < value.length; i++) {
            const op = value[i];
            const before = buffer.length;
            const children: ProfileEntry[] = [];
            switch (op.op) {
                case 'resize':
                    buffer.push(AROP_RESIZE); writeLEB128(buffer, op.value);
                    break;
                case 'set':
                    buffer.push(AROP_SET); writeLEB128(buffer, op.index);
                    dbgEncodeNode(op.value, protocol, elementNode, buffer, cache, children);
                    break;
                case 'setrange': {
                    buffer.push(AROP_SETRANGE); writeLEB128(buffer, op.index); writeLEB128(buffer, op.values.length);
                    for (let j = 0; j < op.values.length; j++) {
                        const cb = buffer.length; const cc: ProfileEntry[] = [];
                        dbgEncodeNode(op.values[j], protocol, elementNode, buffer, cache, cc);
                        children.push({ key: `[${j}]`, bytes: buffer.length - cb, children: cc.length ? cc : undefined });
                    }
                    break;
                }
                case 'fill':
                    buffer.push(AROP_FILL); writeLEB128(buffer, op.index); writeLEB128(buffer, op.count ?? op.length ?? 1);
                    dbgEncodeNode(op.value, protocol, elementNode, buffer, cache, children);
                    break;
                case 'replace': {
                    buffer.push(AROP_REPLACE); writeLEB128(buffer, op.values.length);
                    for (let j = 0; j < op.values.length; j++) {
                        const cb = buffer.length; const cc: ProfileEntry[] = [];
                        dbgEncodeNode(op.values[j], protocol, elementNode, buffer, cache, cc);
                        children.push({ key: `[${j}]`, bytes: buffer.length - cb, children: cc.length ? cc : undefined });
                    }
                    break;
                }
            }
            profile.push({ key: `[${i}] ${op.op}`, bytes: buffer.length - before,
                children: children.length ? children : undefined });
        }
    } else {
        buffer.push(0);
        writeLEB128(buffer, value.length);
        profile.push({ key: '<header>', bytes: buffer.length - headerStart });
        for (let i = 0; i < value.length; i++) {
            const before = buffer.length;
            const children: ProfileEntry[] = [];
            dbgEncodeNode(value[i], protocol, elementNode, buffer, cache, children);
            profile.push({ key: `[${i}]`, bytes: buffer.length - before,
                children: children.length ? children : undefined });
        }
    }
}

function dbgEncodeStaticArray(
    value: any, protocol: Protocol, elementNode: CompiledNode,
    buffer: number[], cache: any, profile: ProfileEntry[]
): void {
    if (!Array.isArray(value) || value.length === 0) {
        const s = buffer.length;
        writeLEB128(buffer, 0);
        profile.push({ key: '<header>', bytes: buffer.length - s });
        return;
    }

    const isOps = value[0] !== null && typeof value[0] === 'object' && 'op' in value[0];

    if (isOps) {
        const pairs: Array<{ index: number; value: any }> = [];
        for (const op of value) {
            if (op.op === 'set') {
                pairs.push({ index: op.index, value: op.value });
            } else if (op.op === 'fill') {
                const n = op.count ?? op.length ?? 1;
                for (let i = 0; i < n; i++) pairs.push({ index: (op.index ?? 0) + i, value: op.value });
            } else if (op.op === 'setrange') {
                for (let i = 0; i < op.values.length; i++) pairs.push({ index: op.index + i, value: op.values[i] });
            }
        }
        const headerStart = buffer.length;
        writeLEB128(buffer, pairs.length);
        profile.push({ key: '<header>', bytes: buffer.length - headerStart });
        for (const { index, value: v } of pairs) {
            const before = buffer.length;
            writeLEB128(buffer, index);
            const children: ProfileEntry[] = [];
            dbgEncodeNode(v, protocol, elementNode, buffer, cache, children);
            profile.push({ key: `[${index}]`, bytes: buffer.length - before,
                children: children.length ? children : undefined });
        }
    } else {
        const headerStart = buffer.length;
        writeLEB128(buffer, value.length);
        profile.push({ key: '<header>', bytes: buffer.length - headerStart });
        for (let i = 0; i < value.length; i++) {
            const before = buffer.length;
            writeLEB128(buffer, i);
            const children: ProfileEntry[] = [];
            dbgEncodeNode(value[i], protocol, elementNode, buffer, cache, children);
            profile.push({ key: `[${i}]`, bytes: buffer.length - before,
                children: children.length ? children : undefined });
        }
    }
}

function dbgEncodeMap(
    value: any, protocol: Protocol,
    mapNode: CompiledNode & { kind: 'map' },
    buffer: number[], cache: any, profile: ProfileEntry[]
): void {
    if (!value || typeof value !== 'object') {
        const s = buffer.length;
        writeLEB128(buffer, 0);
        profile.push({ key: '<header>', bytes: buffer.length - s });
        return;
    }
    const keys = Object.keys(value);
    const headerStart = buffer.length;
    writeLEB128(buffer, keys.length);
    profile.push({ key: '<header>', bytes: buffer.length - headerStart });
    const valueNode: CompiledNode = { kind: 'object', mapping: mapNode.mapping, fields: mapNode.fields };
    for (const key of keys) {
        const before = buffer.length;
        encodeString(key, buffer, protocol.dictionary, cache);
        const children: ProfileEntry[] = [];
        dbgEncodeNode(value[key], protocol, valueNode, buffer, cache, children);
        profile.push({ key, bytes: buffer.length - before,
            children: children.length ? children : undefined });
    }
}

function dbgEncodeVariants(
    value: any, protocol: Protocol,
    node: CompiledNode & { kind: 'variants' },
    buffer: number[], cache: any, profile: ProfileEntry[]
): void {
    const name = value?.type;
    const idx = name !== undefined ? node.variants.findIndex(v => v.name === name) : -1;
    if (idx < 0) throw new Error(`[protocol] Unknown variant type: ${name}`);
    const typeStart = buffer.length;
    writeLEB128(buffer, idx);
    profile.push({ key: '<type>', bytes: buffer.length - typeStart });
    const payloadStart = buffer.length;
    const children: ProfileEntry[] = [];
    dbgEncodeNode(value.payload, protocol, node.variants[idx].node, buffer, cache, children);
    profile.push({ key: 'payload', bytes: buffer.length - payloadStart,
        children: children.length ? children : undefined });
}

function formatProfile(entries: ProfileEntry[], indent = 0): string {
    const pad = '  '.repeat(indent);
    return entries
        .map(e => {
            const line = `${pad}${e.key}: ${e.bytes}B`;
            return e.children?.length ? line + '\n' + formatProfile(e.children, indent + 1) : line;
        })
        .join('\n');
}

/**
 * Encode a protocol payload and return both the wire buffer and a byte-cost
 * report tree.  Intended for development/profiling only — never referenced
 * from the production encode path, so it has zero runtime overhead when not
 * called.
 */
export function protoEncodeDebug(payload: any): { buffer: ArrayBuffer; report: string } {
    const protocol = getProtocol(payload?.type);
    const buffer: number[] = [protocol.index];
    const profile: ProfileEntry[] = [];

    if (protocol.index === 0) {
        const fallbackDict = registeredProtocols[0].dictionary
            ?? (() => { const d = createDefaultDict([]); d.frozen = true; return d; })();
        serializeEX(payload, buffer, fallbackDict, {});
        return { buffer: new Uint8Array(buffer).buffer, report: `<fallback> ${buffer.length}B` };
    }

    dbgEncodeNode(payload.payload, protocol, protocol.schema, buffer, {}, profile);
    return {
        buffer: new Uint8Array(buffer).buffer,
        report: `total: ${buffer.length}B\n` + formatProfile(profile),
    };
}
