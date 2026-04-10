"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDefaultDictionary = setDefaultDictionary;
exports.revertProtocol = revertProtocol;
exports.extendProtocol = extendProtocol;
exports.getProtocolSchema = getProtocolSchema;
exports.registerProtocol = registerProtocol;
exports.protoEncode = protoEncode;
exports.encodeNode = encodeNode;
exports.protoDecode = protoDecode;
exports.decodeNode = decodeNode;
const encoder_1 = require("./encoder");
const helper_1 = require("./helper");
const schema_compiler_1 = require("./schema-compiler");
function deepCloneNode(node) {
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
let registeredProtocols = [{ type: 'default', index: 0, schema: (0, schema_compiler_1.compileSchema)({}) }]; // 1-based indexing; position 0 is reserved for fallback
let protocolMap = {};
function setDefaultDictionary(dictionaryList) {
    const dict = (0, encoder_1.createDefaultDict)(dictionaryList);
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
function revertProtocol(baseType) {
    const protocol = getProtocol(baseType);
    if (!protocol.originalSchema) {
        throw new Error(`Protocol '${baseType}' has no saved original schema to revert to.`);
    }
    protocol.schema = deepCloneNode(protocol.originalSchema);
}
function extendNode(node, overrides) {
    if (node.kind !== 'object')
        return;
    for (const key of Object.keys(overrides)) {
        const existingIdx = node.mapping[key];
        if (existingIdx !== undefined) {
            const existingField = node.fields[existingIdx];
            const child = existingField.node;
            if (child.kind === 'custom') {
                // $custom field: replace with the compiled override schema
                node.fields[existingIdx] = { key, node: (0, schema_compiler_1.compileSchema)(overrides[key]) };
            }
            else if (overrides[key] !== null &&
                typeof overrides[key] === 'object' &&
                !Array.isArray(overrides[key])) {
                if (child.kind === 'object') {
                    extendNode(child, overrides[key]);
                }
                else if (child.kind === 'static' || child.kind === 'array') {
                    // Recurse into the element schema (e.g. players/$static/Player)
                    extendNode(child.elementNode, overrides[key]);
                }
            }
            // else: leaf or unrecursable — skip silently
        }
        else {
            // New key not in the original schema — always append
            node.mapping[key] = node.fields.length;
            node.fields.push({ key, node: (0, schema_compiler_1.compileSchema)(overrides[key]) });
        }
    }
}
function extendProtocol(baseType, overrides) {
    const protocol = getProtocol(baseType);
    const node = protocol.schema;
    // if (node.kind !== 'object') {
    //     throw new Error(`Protocol '${baseType}' payload schema is not an object and cannot be extended.`);
    // }
    extendNode(node, overrides);
}
function describeNode(node) {
    switch (node.kind) {
        case 'any': return 'any';
        case 'primitive': return node.type;
        case 'object': {
            const out = {};
            for (const f of node.fields)
                out[f.key] = describeNode(f.node);
            return out;
        }
        case 'array': return { $array: describeNode(node.elementNode) };
        case 'static': return { $static: describeNode(node.elementNode) };
        case 'map': {
            const out = {};
            for (const f of node.fields)
                out[f.key] = describeNode(f.node);
            return { $map: out };
        }
        case 'custom': return describeNode(node.node);
        case 'enum': return { $enum: node.values };
    }
}
function getProtocolSchema(type) {
    const protocol = getProtocol(type);
    if (!protocol || protocol.index === 0)
        return null;
    return describeNode(protocol.schema);
}
function registerProtocol(protocol, dictionaryList) {
    if (!protocol.type || typeof protocol.type !== 'string') {
        throw new Error("Protocol must have a 'type' key with string value. Name of the protocol.");
    }
    if (protocol.type in protocolMap) {
        throw new Error(`Protocol with type '${protocol.type}' is already registered.`);
    }
    let dictionary = undefined;
    // if (Array.isArray(dictionaryList) && dictionaryList.length > 0) {
    dictionary = dictionaryList || protocol.dictionary || (0, encoder_1.createDefaultDict)([]);
    if (dictionary)
        dictionary.frozen = true;
    // }
    const schema = (0, schema_compiler_1.compileSchema)(protocol.payload);
    const index = registeredProtocols.length;
    protocolMap[protocol.type] = index;
    registeredProtocols.push({ type: protocol.type, index, schema, originalSchema: deepCloneNode(schema), dictionary });
}
function getProtocolById(index) {
    if (index < 0 || index >= registeredProtocols.length) {
        throw new Error(`Protocol index ${index} is out of range.`);
    }
    return registeredProtocols[index];
}
function getProtocol(type) {
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
function protoEncode(payload) {
    let protocol = getProtocol(payload?.type);
    let buffer = [protocol.index];
    if (protocol.index === 0) {
        // Fallback: encode with generic serialiser using the default dictionary
        // (frozen so no dynamic entries are added that the decoder couldn't resolve).
        const fallbackDict = registeredProtocols[0].dictionary ?? (() => { const d = (0, encoder_1.createDefaultDict)([]); d.frozen = true; return d; })();
        (0, encoder_1.serializeEX)(payload, buffer, fallbackDict, {});
        return new Uint8Array(buffer).buffer;
    }
    encodeNode(payload.payload, protocol, protocol.schema, buffer);
    return new Uint8Array(buffer).buffer;
}
function encodeNode(value, protocol, node, buffer, cache = {}) {
    switch (node.kind) {
        case 'any': return (0, encoder_1.serializeEX)(value, buffer, protocol.dictionary, cache);
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
            (0, helper_1.writeLEB128)(buffer, idx >= 0 ? idx : node.values.length);
            return;
        }
    }
}
function encodePrimitive(value, protocol, type, buffer, cache = {}) {
    switch (type) {
        case 'uint':
            (0, helper_1.writeLEB128)(buffer, value == null ? 0 : Math.max(0, Math.floor(value)));
            return;
        case 'int':
            (0, helper_1.writeSLEB128)(buffer, value == null ? 0 : value);
            return;
        case 'float':
            (0, helper_1.encodeFloat64)(value == null ? 0 : value, buffer);
            return;
        case 'string':
            (0, helper_1.encodeString)(value == null ? '' : String(value), buffer, protocol.dictionary, cache);
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
            (0, encoder_1.serializeEX)(value, buffer, protocol.dictionary, cache);
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
function encodeObject(value, protocol, mapping, fields, buffer, cache = {}) {
    if (fields.length === 0) {
        // No schema keys → fall back to generic serialisation
        (0, encoder_1.serializeEX)(value, buffer, protocol.dictionary, cache);
        return;
    }
    const isObj = (0, helper_1.isObject)(value);
    // Collect extra keys (not defined in schema)
    const extras = [];
    if (isObj) {
        for (const key in value) {
            if (mapping[key] === undefined)
                extras.push(key);
        }
    }
    let maxIndex = -1;
    for (let key in value) {
        const idx = mapping[key];
        if (idx !== undefined) {
            maxIndex = Math.max(maxIndex, idx);
        }
        else {
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
    const bitflags = new Array(numGroups).fill(0);
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
        }
        else {
            bitflags[schemaGroups + g] = 0x7F;
        }
    }
    // Mark all bitflag bytes except the last with MSB=1 ("more follows")
    for (let i = 0; i < numGroups - 1; i++)
        bitflags[i] |= 0x80;
    for (const bf of bitflags)
        buffer.push(bf);
    for (let i = 0; i < fields.length; i++) {
        const groupIdx = Math.floor(i / 7);
        if (bitflags[groupIdx] & (1 << (i % 7))) {
            encodeNode(value[fields[i].key], protocol, fields[i].node, buffer, cache);
        }
    }
    // Encode extra key-value pairs after schema fields
    for (const key of extras) {
        (0, helper_1.encodeString)(key, buffer, protocol.dictionary, cache);
        (0, encoder_1.serializeEX)(value[key], buffer, protocol.dictionary, cache);
    }
}
/**
 * Encode a $map: [count:LEB] [ [keyLen:LEB][UTF-8 key] [value] ] …
 */
function encodeMap(value, protocol, valueNode, buffer, cache = {}) {
    if (!value || typeof value !== 'object') {
        (0, helper_1.writeLEB128)(buffer, 0);
        return;
    }
    const keys = Object.keys(value);
    (0, helper_1.writeLEB128)(buffer, keys.length);
    for (const key of keys) {
        (0, helper_1.encodeString)(key, buffer, protocol.dictionary, cache);
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
function encodeArray(value, protocol, elementNode, buffer, cache = {}) {
    if (!Array.isArray(value)) {
        buffer.push(0); // mode 0
        (0, helper_1.writeLEB128)(buffer, 0);
        return;
    }
    const isDelta = value.length > 0 &&
        value[0] !== null &&
        typeof value[0] === 'object' &&
        'op' in value[0];
    if (isDelta) {
        buffer.push(1); // mode 1: flexible / delta
        (0, helper_1.writeLEB128)(buffer, value.length);
        for (const op of value)
            encodeArrayOp(op, protocol, elementNode, buffer, cache);
    }
    else {
        buffer.push(0); // mode 0: standard
        (0, helper_1.writeLEB128)(buffer, value.length);
        for (const item of value)
            encodeNode(item, protocol, elementNode, buffer, cache);
    }
}
// Flexible-array op codes
const AROP_RESIZE = 1;
const AROP_SET = 2;
const AROP_PATCH = 3;
const AROP_SETRANGE = 4;
const AROP_FILL = 5;
const AROP_REPLACE = 6;
function encodeArrayOp(op, protocol, elementNode, buffer, cache = {}) {
    switch (op.op) {
        case 'resize':
            buffer.push(AROP_RESIZE);
            (0, helper_1.writeLEB128)(buffer, op.value);
            return;
        case 'set':
            buffer.push(AROP_SET);
            (0, helper_1.writeLEB128)(buffer, op.index);
            encodeNode(op.value, protocol, elementNode, buffer, cache);
            return;
        case 'patch':
            buffer.push(AROP_PATCH);
            (0, helper_1.writeLEB128)(buffer, op.index);
            encodeNode(op.value, protocol, elementNode, buffer, cache);
            return;
        case 'setrange':
            buffer.push(AROP_SETRANGE);
            (0, helper_1.writeLEB128)(buffer, op.index);
            (0, helper_1.writeLEB128)(buffer, op.values.length);
            for (const v of op.values)
                encodeNode(v, protocol, elementNode, buffer, cache);
            return;
        case 'fill':
            buffer.push(AROP_FILL);
            (0, helper_1.writeLEB128)(buffer, op.index);
            (0, helper_1.writeLEB128)(buffer, op.count ?? op.length ?? 1);
            encodeNode(op.value, protocol, elementNode, buffer, cache);
            return;
        case 'replace':
            buffer.push(AROP_REPLACE);
            (0, helper_1.writeLEB128)(buffer, op.values.length);
            for (const v of op.values)
                encodeNode(v, protocol, elementNode, buffer, cache);
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
function encodeStaticArray(value, protocol, elementNode, buffer, cache = {}) {
    if (!Array.isArray(value)) {
        buffer.push(4); // mode 4: empty refresh
        (0, helper_1.writeLEB128)(buffer, 0);
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
            (0, helper_1.writeLEB128)(buffer, count);
            (0, helper_1.writeLEB128)(buffer, index);
            encodeNode(fillVal, protocol, elementNode, buffer, cache);
        }
        else {
            // Mode 2: sparse by-index updates
            buffer.push(2);
            const setOps = value.filter((op) => op.op === 'set' || op.op === 'patch');
            (0, helper_1.writeLEB128)(buffer, setOps.length);
            for (const op of setOps) {
                (0, helper_1.writeLEB128)(buffer, op.index);
                encodeNode(op.value, protocol, elementNode, buffer, cache);
            }
        }
    }
    else {
        // Mode 4: full refresh
        buffer.push(4);
        (0, helper_1.writeLEB128)(buffer, value.length);
        for (const item of value)
            encodeNode(item, protocol, elementNode, buffer, cache);
    }
}
function protoDecode(data, dictionaryList) {
    let view;
    if (data instanceof ArrayBuffer) {
        view = new DataView(data);
    }
    else {
        view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }
    const ref = { view, pos: 0, dictionary: undefined };
    const typeIndex = ref.view.getUint8(ref.pos++);
    const protocol = getProtocolById(typeIndex);
    if (typeIndex === 0) {
        // Fallback: encoded with generic serialiser — use same default dictionary
        const fallbackDict = registeredProtocols[0].dictionary ?? (() => { const d = (0, encoder_1.createDefaultDict)([]); d.frozen = true; return d; })();
        const exRef = { buffer: view, pos: ref.pos, dict: fallbackDict };
        return (0, encoder_1.deserializeEX)(exRef);
    }
    if (!protocol) {
        throw new Error(`[protocol-withtypes] Unknown type index: ${typeIndex}`);
    }
    ref.dictionary = dictionaryList || protocol.dictionary;
    const payload = decodeNode(ref, protocol, protocol.schema);
    return { type: protocol.type, payload };
}
// ─── Decoder ──────────────────────────────────────────────────────────────────
function decodeNode(ref, protocol, node) {
    switch (node.kind) {
        case 'any': {
            let exRef = { buffer: ref.view, pos: ref.pos, dict: ref.dictionary };
            let value = (0, encoder_1.deserializeEX)(exRef);
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
            const idx = (0, helper_1.readLEB128)(ref);
            return idx < node.values.length ? node.values[idx] : undefined;
        }
    }
}
function decodePrimitive(ref, protocol, type) {
    switch (type) {
        case 'uint': return (0, helper_1.readLEB128)(ref);
        case 'int': return (0, helper_1.readSLEB128)(ref);
        case 'float': {
            const v = ref.view.getFloat64(ref.pos);
            ref.pos += 8;
            return v;
        }
        case 'string':
            return (0, helper_1.decodeString)(ref);
        case 'float':
            return (0, helper_1.decodeFloat64)(ref);
        case 'boolean':
            return ref.view.getUint8(ref.pos++) !== 0;
        case 'null':
            return null;
        case 'undefined':
            return undefined;
        default: {
            // 'object', 'array', or unknown → encoder fallback
            const exRef = { buffer: ref.view, pos: ref.pos, dict: ref.dictionary };
            const result = (0, encoder_1.deserializeEX)(exRef);
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
function decodeObject(ref, protocol, fields) {
    const result = {};
    // Read bitflag bytes; stop when MSB is clear (last byte)
    const bitflags = [];
    while (true) {
        const bf = ref.view.getUint8(ref.pos++);
        bitflags.push(bf & 0x7F); // strip the MSB before storing
        if (!(bf & 0x80))
            break;
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
            const key = (0, helper_1.decodeString)(ref);
            const exRef = { buffer: ref.view, pos: ref.pos, dict: ref.dictionary };
            result[key] = (0, encoder_1.deserializeEX)(exRef);
            ref.pos = exRef.pos;
        }
    }
    return result;
}
/**
 * Decode a $map: [count:LEB] [ [keyLen:LEB][UTF-8 key] [value] ] …
 */
function decodeMap(ref, protocol, valueNode) {
    const count = (0, helper_1.readLEB128)(ref);
    const result = {};
    for (let i = 0; i < count; i++) {
        const key = (0, helper_1.decodeString)(ref);
        result[key] = decodeNode(ref, protocol, valueNode);
    }
    return result;
}
/**
 * Decode a $array.  Reads the mode byte then dispatches accordingly.
 */
function decodeArray(ref, protocol, elementNode) {
    const mode = ref.view.getUint8(ref.pos++);
    const count = (0, helper_1.readLEB128)(ref);
    if (mode === 0) {
        // Standard
        const result = [];
        for (let i = 0; i < count; i++)
            result.push(decodeNode(ref, protocol, elementNode));
        return result;
    }
    // Mode 1: flexible ops
    const result = [];
    for (let i = 0; i < count; i++)
        result.push(decodeArrayOp(ref, protocol, elementNode));
    return result;
}
function decodeArrayOp(ref, protocol, elementNode) {
    const opCode = ref.view.getUint8(ref.pos++);
    switch (opCode) {
        case AROP_RESIZE:
            return { op: 'resize', value: (0, helper_1.readLEB128)(ref) };
        case AROP_SET:
            return { op: 'set', index: (0, helper_1.readLEB128)(ref), value: decodeNode(ref, protocol, elementNode) };
        case AROP_PATCH:
            return { op: 'patch', index: (0, helper_1.readLEB128)(ref), value: decodeNode(ref, protocol, elementNode) };
        case AROP_SETRANGE: {
            const index = (0, helper_1.readLEB128)(ref);
            const n = (0, helper_1.readLEB128)(ref);
            const values = [];
            for (let i = 0; i < n; i++)
                values.push(decodeNode(ref, protocol, elementNode));
            return { op: 'setrange', index, values };
        }
        case AROP_FILL: {
            const index = (0, helper_1.readLEB128)(ref);
            const count = (0, helper_1.readLEB128)(ref);
            const value = decodeNode(ref, protocol, elementNode);
            return { op: 'fill', index, count, value };
        }
        case AROP_REPLACE: {
            const n = (0, helper_1.readLEB128)(ref);
            const values = [];
            for (let i = 0; i < n; i++)
                values.push(decodeNode(ref, protocol, elementNode));
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
function decodeStaticArray(ref, protocol, elementNode) {
    const mode = ref.view.getUint8(ref.pos++);
    switch (mode) {
        case 2: {
            const count = (0, helper_1.readLEB128)(ref);
            const result = [];
            for (let i = 0; i < count; i++) {
                const index = (0, helper_1.readLEB128)(ref);
                const value = decodeNode(ref, protocol, elementNode);
                result.push({ op: 'set', index, value });
            }
            return result;
        }
        case 3: {
            const count = (0, helper_1.readLEB128)(ref);
            const index = (0, helper_1.readLEB128)(ref);
            const value = decodeNode(ref, protocol, elementNode);
            return [{ op: 'fill', index, count, value }];
        }
        case 4: {
            const count = (0, helper_1.readLEB128)(ref);
            const result = [];
            for (let i = 0; i < count; i++)
                result.push(decodeNode(ref, protocol, elementNode));
            return result;
        }
        default:
            throw new Error(`[protocol-withtypes] Unknown $static mode: ${mode}`);
    }
}
//# sourceMappingURL=protocol.js.map