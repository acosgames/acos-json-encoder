import { createDefaultDict, serializeEX, deserializeEX } from "./encoder";
import { decodeString, encodeFloat64, decodeFloat64, encodeString, isObject, readLEB128, readSLEB128, writeLEB128, writeSLEB128 } from "./helper";
import { compileSchema } from "./schema-compiler";

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
    }
}

let registeredProtocols: Protocol[] = [{ type: 'default', index: 0, schema: compileSchema({}) } as Protocol]; // 1-based indexing; position 0 is reserved for fallback
let protocolMap: { [key: string]: number } = {};

export function setDefaultDictionary(dictionaryList: string[]): void {
    const dict = createDefaultDict(dictionaryList);
    dict.frozen = true;
    registeredProtocols[0].dictionary = dict;
}

/**
 * Extend an already-registered protocol by replacing or adding field schemas.
 *
 * `overrides` is a plain schema object whose keys map to the fields you want
 * to replace (or add) in the top-level payload object of `baseType`, using
 * the same schema syntax accepted by registerProtocol.
 *
 * Example:
 *   extendProtocol('gameupdate', {
 *     state:   { $object: { '#cells': { $array: { index: 'uint', value: 'string' } } } },
 *     players: { $static: MyPlayer },
 *   });
 */
export function revertProtocol(baseType: string): void {
    const protocol = getProtocol(baseType);
    if (!protocol.originalSchema) {
        throw new Error(`Protocol '${baseType}' has no saved original schema to revert to.`);
    }
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
                // $custom field: replace with the compiled override schema
                node.fields[existingIdx] = { key, node: compileSchema(overrides[key]) };
            } else if (
                overrides[key] !== null &&
                typeof overrides[key] === 'object' &&
                !Array.isArray(overrides[key])
            ) {
                if (child.kind === 'object') {
                    extendNode(child, overrides[key]);
                } else if (child.kind === 'static' || child.kind === 'array') {
                    // Recurse into the element schema (e.g. players/$static/Player)
                    extendNode(child.elementNode, overrides[key]);
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

export function extendProtocol(baseType: string, overrides: Record<string, any>): void {
    const protocol = getProtocol(baseType);
    const node = protocol.schema;
    // if (node.kind !== 'object') {
    //     throw new Error(`Protocol '${baseType}' payload schema is not an object and cannot be extended.`);
    // }
    extendNode(node, overrides);
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

export function encodeNode(value: any, protocol: Protocol, node: CompiledNode, buffer: number[], cache: any = {}): void {
    switch (node.kind) {
        case 'any': return serializeEX(value, buffer, protocol.dictionary, cache);
        case 'primitive': {
            let before = buffer.length;

            encodePrimitive(value, protocol, node.type, buffer, cache);
            console.log("Encoded primitive", node.type, "value:", value, "bytes:", buffer.length - before);
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
    }
}

function encodePrimitive(value: any, protocol: Protocol, type: PrimitiveKind, buffer: number[], cache: any = {}): void {
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

    // Collect extra keys (not defined in schema)
    const extras: string[] = [];
    if (isObj) {
        for (const key in value) {
            if (mapping[key] === undefined) extras.push(key);
        }
    }

    let maxIndex = -1;
    for (let key in value) {
        const idx = mapping[key];
        if (idx !== undefined) {
            maxIndex = Math.max(maxIndex, idx);
        } else {
            extras.push(key);
        }
    }

    // Schema groups always cover the full field list so encoder/decoder agree on boundaries
    const schemaGroups = Math.ceil((maxIndex + 1) / 7);

    // Extra groups encode the extras count using 7 bits each (same MSB continuation scheme)
    // let extraGroups = 0;
    // if (extras.length > 0) {
    //     let n = extras.length;
    //     do { extraGroups++; n >>>= 7; } while (n > 0);
    // }

    let extraGroups = Math.ceil(extras.length / 0x7F);

    const numGroups = schemaGroups + extraGroups;
    const bitflags = new Array<number>(numGroups).fill(0);

    for (let i = 0; i < fields.length; i++) {
        if (isObj && fields[i].key in value) {
            bitflags[Math.floor(i / 7)] |= (1 << (i % 7));
        }
    }

    // Pack extras count into extra bitflag groups (7 bits per group)
    let n = extras.length;
    for (let g = 0; g < extraGroups; g++) {
        if (g === extraGroups - 1) {
            bitflags[schemaGroups + g] = extras.length % 0x7F;
        } else {
            bitflags[schemaGroups + g] = 0x7F;
        }
    }

    // Mark all bitflag bytes except the last with MSB=1 ("more follows")
    for (let i = 0; i < numGroups - 1; i++) bitflags[i] |= 0x80;
    for (const bf of bitflags) buffer.push(bf);

    for (let i = 0; i < fields.length; i++) {
        const groupIdx = Math.floor(i / 7);
        if (bitflags[groupIdx] & (1 << (i % 7))) {
            encodeNode(value[fields[i].key], protocol, fields[i].node, buffer, cache);
        }
    }

    // Encode extra key-value pairs after schema fields
    for (const key of extras) {
        encodeString(key, buffer, protocol.dictionary, cache);
        serializeEX(value[key], buffer, protocol.dictionary, cache);
    }
}

/**
 * Encode a $map: [count:LEB] [ [keyLen:LEB][UTF-8 key] [value] ] …
 */
function encodeMap(value: any, protocol: Protocol, valueNode: CompiledNode, buffer: number[], cache: any = {}): void {
    if (!value || typeof value !== 'object') {
        writeLEB128(buffer, 0);
        return;
    }
    const keys = Object.keys(value);
    writeLEB128(buffer, keys.length);
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
 *   { op: 'patch',    index: number, value: any }
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
const AROP_PATCH = 3;
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
        case 'patch':
            buffer.push(AROP_PATCH);
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
 * Input shape → wire mode:
 *   Plain array (no op property on first element) → mode 4 (refresh/replace-all)
 *   Array of { op: 'set'|'patch', index, value }  → mode 2 (by-index updates)
 *   Single { op: 'fill', index, count, value }     → mode 3 (fill)
 */
function encodeStaticArray(value: any, protocol: Protocol, elementNode: CompiledNode, buffer: number[], cache: any = {}): void {
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
            encodeNode(fillVal, protocol, elementNode, buffer, cache);
        } else {
            // Mode 2: sparse by-index updates
            buffer.push(2);
            const setOps = value.filter((op: any) => op.op === 'set' || op.op === 'patch');
            writeLEB128(buffer, setOps.length);
            for (const op of setOps) {
                writeLEB128(buffer, op.index);
                encodeNode(op.value, protocol, elementNode, buffer, cache);
            }
        }
    } else {
        // Mode 4: full refresh
        buffer.push(4);
        writeLEB128(buffer, value.length);
        for (const item of value) encodeNode(item, protocol, elementNode, buffer, cache);
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
    }
}

function decodePrimitive(ref: DecodeRef, protocol: Protocol, type: PrimitiveKind): any {
    switch (type) {
        case 'uint': return readLEB128(ref);
        case 'int': return readSLEB128(ref);
        case 'float': {
            const v = ref.view.getFloat64(ref.pos);
            ref.pos += 8;
            return v;
        }
        case 'string':
            return decodeString(ref);
        case 'float':
            return decodeFloat64(ref);
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

    // Extra key-value pairs: bitflag groups beyond the schema groups encode the count
    const schemaGroups = Math.ceil(fields.length / 7);
    if (bitflags.length > schemaGroups) {
        let extrasCount = 0;
        for (let g = schemaGroups; g < bitflags.length; g++) {
            extrasCount += bitflags[g] & 0x7F;
        }
        for (let i = 0; i < extrasCount; i++) {
            const key = decodeString(ref);
            const exRef = { buffer: ref.view, pos: ref.pos, dict: ref.dictionary };
            result[key] = deserializeEX(exRef);
            ref.pos = exRef.pos;
        }
    }

    return result;
}

/**
 * Decode a $map: [count:LEB] [ [keyLen:LEB][UTF-8 key] [value] ] …
 */
function decodeMap(ref: DecodeRef, protocol: Protocol, valueNode: CompiledNode): any {
    const count = readLEB128(ref);
    const result: any = {};
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
        case AROP_PATCH:
            return { op: 'patch', index: readLEB128(ref), value: decodeNode(ref, protocol, elementNode) };
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
 * Decode a $static array.  Reads the mode byte then dispatches accordingly.
 *
 * Returns:
 *   mode 2 → [ { op:'set', index, value }, … ]
 *   mode 3 → [ { op:'fill', index, count, value } ]
 *   mode 4 → plain array (full snapshot)
 */
function decodeStaticArray(ref: DecodeRef, protocol: Protocol, elementNode: CompiledNode): any {
    const mode = ref.view.getUint8(ref.pos++);

    switch (mode) {
        case 2: {
            const count = readLEB128(ref);
            const result: any[] = [];
            for (let i = 0; i < count; i++) {
                const index = readLEB128(ref);
                const value = decodeNode(ref, protocol, elementNode);
                result.push({ op: 'set', index, value });
            }
            return result;
        }
        case 3: {
            const count = readLEB128(ref);
            const index = readLEB128(ref);
            const value = decodeNode(ref, protocol, elementNode);
            return [{ op: 'fill', index, count, value }];
        }
        case 4: {
            const count = readLEB128(ref);
            const result: any[] = [];
            for (let i = 0; i < count; i++) result.push(decodeNode(ref, protocol, elementNode));
            return result;
        }
        default:
            throw new Error(`[protocol-withtypes] Unknown $static mode: ${mode}`);
    }
}
