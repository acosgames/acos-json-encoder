"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeLEB128 = encodeLEB128;
exports.decodeLEB128 = decodeLEB128;
exports.encodeSLEB128 = encodeSLEB128;
exports.decodeSLEB128 = decodeSLEB128;
exports.initProtocols = initProtocols;
exports.protoEncode = protoEncode;
exports.protoDecode = protoDecode;
var encoder_1 = require("../encoder/encoder");
// import ACOSDictionary from "./acos-dictionary.json" with  { type: "json" };
// let dictionary = createDefaultDict(ACOSDictionary);
/**
 * Buffer Format
 *
 * [ type (1 byte) ] [ payload (variable length) ]
 *
 * Dynamic Mapping Format
 *
 * [ Data Type vs Cached Type Index (1 byte) ]  [ Data Payload (variable length) ]
 *
 *
 */
function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}
function writeVarUint(buffer, n) {
    if (n < 0x80) {
        buffer.push(n);
    }
    else {
        buffer.push((n & 0x7F) | 0x80, n >> 7);
    }
}
function readVarUint(ref) {
    var b = ref.buffer.getUint8(ref.pos++);
    if (b & 0x80) {
        return (b & 0x7F) | (ref.buffer.getUint8(ref.pos++) << 7);
    }
    return b;
}
// ---------------------------------------------------------------------------
// LEB128  (unsigned and signed)
// ---------------------------------------------------------------------------
/**
 * Encode an unsigned integer as LEB128 and return the bytes.
 * Supports values from 0 up to 2^53 (JS safe-integer range).
 */
function encodeLEB128(buffer, value) {
    if (!Number.isInteger(value) || value < 0) {
        throw new RangeError('encodeLEB128 requires a non-negative integer');
    }
    do {
        var byte = value & 0x7F;
        value = Math.floor(value / 128); // logical right-shift safe for >32-bit
        if (value !== 0)
            byte |= 0x80;
        buffer.push(byte);
    } while (value !== 0);
    return buffer;
}
/**
 * Decode an unsigned LEB128 value from `bytes` starting at `offset` (default 0).
 * Returns the decoded value and the number of bytes consumed.
 */
function decodeLEB128(bytes, offset) {
    if (offset === void 0) { offset = 0; }
    var value = 0;
    var shift = 0;
    var bytesRead = 0;
    while (true) {
        var byte = bytes[offset + bytesRead];
        if (byte === undefined)
            throw new RangeError('decodeLEB128: unexpected end of input');
        bytesRead++;
        value += (byte & 0x7F) * Math.pow(2, shift); // avoid bit-shift truncation above 32 bits
        shift += 7;
        if (!(byte & 0x80))
            break;
    }
    return { value: value, bytesRead: bytesRead };
}
/**
 * Encode a signed integer as SLEB128 and return the bytes.
 * Supports the full JS safe-integer range (±2^53).
 */
function encodeSLEB128(buffer, value) {
    if (!Number.isInteger(value))
        throw new RangeError('encodeSLEB128 requires an integer');
    var more = true;
    while (more) {
        var byte = value & 0x7F;
        value >>= 7; // arithmetic shift (works up to 32 bits; extended below)
        // Handle values outside the 32-bit arithmetic-shift range manually
        if (value === 0 && !(byte & 0x40)) {
            more = false;
        }
        else if (value === -1 && (byte & 0x40)) {
            more = false;
        }
        else {
            byte |= 0x80;
        }
        buffer.push(byte);
    }
    return buffer;
}
/**
 * Decode a signed SLEB128 value from `bytes` starting at `offset` (default 0).
 * Returns the decoded value and the number of bytes consumed.
 */
function decodeSLEB128(bytes, offset) {
    if (offset === void 0) { offset = 0; }
    var value = 0;
    var shift = 0;
    var bytesRead = 0;
    var byte;
    do {
        byte = bytes[offset + bytesRead];
        if (byte === undefined)
            throw new RangeError('decodeSLEB128: unexpected end of input');
        bytesRead++;
        value += (byte & 0x7F) * Math.pow(2, shift);
        shift += 7;
    } while (byte & 0x80);
    // Sign-extend if the sign bit of the last group is set
    if (shift < 53 && (byte & 0x40)) {
        value -= Math.pow(2, shift);
    }
    return { value: value, bytesRead: bytesRead };
}
function precomputeProtocol(protocol) {
    var _a, _b;
    if (protocol.$sortedSchema !== undefined)
        return; // already done
    var sorted = [];
    for (var key in protocol) {
        if (key[0] === '$')
            continue; // skip existing meta-properties
        var entry = protocol[key];
        var isDelta = key[0] === '#';
        var payloadKey = isDelta ? key.slice(1) : key;
        var byte = (typeof entry === 'number') ? entry : entry === null || entry === void 0 ? void 0 : entry.$byte;
        if (byte === undefined)
            continue;
        sorted.push({ byte: byte, payloadKey: payloadKey, lookupKey: key, isDelta: isDelta, protoEntry: entry });
    }
    sorted.sort(function (a, b) { return a.byte - b.byte; });
    protocol.$sortedSchema = sorted;
    protocol.$schemaKeySet = new Set(sorted.map(function (e) { return e.lookupKey; }));
    // Recurse into nested sub-protocols
    for (var _i = 0, sorted_1 = sorted; _i < sorted_1.length; _i++) {
        var e = sorted_1[_i];
        if ((_a = e.protoEntry) === null || _a === void 0 ? void 0 : _a.$object)
            precomputeProtocol(e.protoEntry.$object);
        if ((_b = e.protoEntry) === null || _b === void 0 ? void 0 : _b.$array)
            precomputeProtocol(e.protoEntry.$array);
    }
}
var indexToMessageType = [];
var messageProtocolByteMap = {};
function mapByteToProtocol(protocol, target) {
    var _a, _b, _c;
    if (target === void 0) { target = {}; }
    for (var $key in protocol) {
        var isDelta = $key[0] === '#';
        var baseKey = isDelta ? $key.slice(1) : $key;
        if ((_a = protocol[$key]) === null || _a === void 0 ? void 0 : _a.$byte) {
            var byte = protocol[$key].$byte;
            if ((_b = protocol[$key]) === null || _b === void 0 ? void 0 : _b.$object) {
                target[byte] = { $key: baseKey, $object: {} };
                mapByteToProtocol(protocol[$key].$object, target[byte].$object);
            }
            else if ((_c = protocol[$key]) === null || _c === void 0 ? void 0 : _c.$array) {
                target[byte] = { $key: baseKey, $array: {}, $isDelta: isDelta };
                mapByteToProtocol(protocol[$key].$array, target[byte].$array);
            }
            else {
                target[byte] = { $key: baseKey };
            }
        }
        else {
            var byte = protocol[$key];
            target[byte] = isDelta ? { $key: baseKey, $isDelta: true } : baseKey;
        }
    }
    return target;
}
var messageProtocols = {};
function initProtocols(_messageProtocols) {
    messageProtocols = _messageProtocols;
    for (var key in messageProtocols) {
        var value = messageProtocols[key].schema;
        indexToMessageType[value] = key;
    }
    //reverse the mapping of the message protocol, example PROTOCOL_GAME maps keys to byte, now reversing maps bytes to keys
    for (var key in messageProtocols) {
        var byteMap = {};
        messageProtocolByteMap[key] = mapByteToProtocol(messageProtocols[key].protocol, byteMap);
        precomputeProtocol(messageProtocols[key].protocol);
    }
}
function recurseProtocolEncode(payload, buffer, dictionary, protocol, cache) {
    var _a;
    if (cache === void 0) { cache = {}; }
    // Arrays: write length then recurse each item via $array schema
    if (Array.isArray(payload)) {
        if (protocol.$array) {
            writeVarUint(buffer, payload.length);
            for (var _i = 0, payload_1 = payload; _i < payload_1.length; _i++) {
                var item = payload_1[_i];
                recurseProtocolEncode(item, buffer, dictionary, protocol.$array, cache);
            }
        }
        else {
            (0, encoder_1.serializeEX)(payload, buffer, dictionary, cache);
        }
        return;
    }
    // Primitives: serialise with encoder and return immediately
    if (!isObject(payload)) {
        (0, encoder_1.serializeEX)(payload, buffer, dictionary, cache);
        return;
    }
    // No protocol defined for this object — fall back to generic serialisation
    if (!protocol.$sortedSchema) {
        (0, encoder_1.serializeEX)(payload, buffer, dictionary, cache);
        return;
    }
    var sortedSchema = protocol.$sortedSchema;
    // Reserve one byte for the presence mask
    var reservedPos = buffer.length;
    buffer.push(0);
    var mask = 0;
    for (var i = 0; i < sortedSchema.length; i++) {
        var e = sortedSchema[i];
        var p = e.protoEntry;
        if (e.isDelta) {
            // Schema-declared always-delta entry (e.g. "#players": 6):
            // present only when '#key' appears in payload
            if (!('#' + e.payloadKey in payload))
                continue;
            mask |= (1 << (e.byte - 1));
            encodeArrayDelta(payload['#' + e.payloadKey], buffer, dictionary, (_a = p === null || p === void 0 ? void 0 : p.$array) !== null && _a !== void 0 ? _a : null, cache);
            continue;
        }
        var normalPresent = e.payloadKey in payload;
        if (!normalPresent) {
            // Delta form via '#key': only valid for $array fields without a dedicated isDelta entry
            if ((p === null || p === void 0 ? void 0 : p.$array) && ('#' + e.payloadKey in payload)) {
                mask |= (1 << (e.byte - 1));
                buffer.push(1); // discriminator: delta array
                encodeArrayDelta(payload['#' + e.payloadKey], buffer, dictionary, p.$array, cache);
            }
            continue;
        }
        mask |= (1 << (e.byte - 1));
        var val = payload[e.payloadKey];
        if (typeof p === 'object') {
            if (p.$object) {
                recurseProtocolEncode(val, buffer, dictionary, p.$object, cache);
            }
            else if (p.$array) {
                buffer.push(0); // discriminator: normal array
                writeVarUint(buffer, val.length);
                for (var j = 0; j < val.length; j++) {
                    recurseProtocolEncode(val[j], buffer, dictionary, p.$array, cache);
                }
            }
            else {
                (0, encoder_1.serializeEX)(val, buffer, dictionary, cache);
            }
        }
        else {
            (0, encoder_1.serializeEX)(val, buffer, dictionary, cache);
        }
    }
    buffer[reservedPos] = mask;
}
// Delta wire format (mirrors delta.ts ArrayChange ops):
//   repeated: [op: u8] until op === DELTA_END (0)
//   0            → end of delta
//   1 (resize)   → [value: VarUint]
//   2 (set)      → [index: u8] [value]
//   3 (patch)    → [index: u8] [sub_type: u8] [value]
//                    sub_type 0: object patch (serializeEX / recurseProtocolEncode)
//                    sub_type 1: nested array delta (recursive encodeArrayDelta)
//   4 (setrange) → [index: u8] [count: VarUint] [value₀] … [valueN]
//   5 (fill)     → [index: u8] [length: VarUint] [value]
//   6 (replace)  → [count: VarUint] [value₀] … [valueN]
var DELTA_END = 0;
var DELTA_RESIZE = 1;
var DELTA_SET = 2;
var DELTA_PATCH = 3;
var DELTA_SETRANGE = 4;
var DELTA_FILL = 5;
var DELTA_REPLACE = 6;
function encodeElem(value, buffer, dictionary, arrayProtocol, cache) {
    if (arrayProtocol) {
        recurseProtocolEncode(value, buffer, dictionary, arrayProtocol, cache);
    }
    else {
        (0, encoder_1.serializeEX)(value, buffer, dictionary, cache);
    }
}
function encodeArrayDelta(arr, buffer, dictionary, arrayProtocol, cache) {
    for (var i = 0; i < arr.length; i++) {
        var d = arr[i];
        switch (d.op) {
            case 'resize':
                buffer.push(DELTA_RESIZE);
                writeVarUint(buffer, d.value);
                break;
            case 'set':
                buffer.push(DELTA_SET);
                buffer.push(d.index);
                encodeElem(d.value, buffer, dictionary, arrayProtocol, cache);
                break;
            case 'patch':
                buffer.push(DELTA_PATCH);
                buffer.push(d.index);
                if (Array.isArray(d.value)) {
                    buffer.push(1); // sub_type: nested array delta
                    encodeArrayDelta(d.value, buffer, dictionary, null, cache);
                }
                else {
                    buffer.push(0); // sub_type: object patch
                    if (arrayProtocol) {
                        recurseProtocolEncode(d.value, buffer, dictionary, arrayProtocol, cache);
                    }
                    else {
                        (0, encoder_1.serializeEX)(d.value, buffer, dictionary, cache);
                    }
                }
                break;
            case 'setrange':
                buffer.push(DELTA_SETRANGE);
                buffer.push(d.index);
                writeVarUint(buffer, d.values.length);
                for (var j = 0; j < d.values.length; j++) {
                    encodeElem(d.values[j], buffer, dictionary, arrayProtocol, cache);
                }
                break;
            case 'fill':
                buffer.push(DELTA_FILL);
                buffer.push(d.index);
                writeVarUint(buffer, d.length);
                encodeElem(d.value, buffer, dictionary, arrayProtocol, cache);
                break;
            case 'replace':
                buffer.push(DELTA_REPLACE);
                writeVarUint(buffer, d.values.length);
                for (var j = 0; j < d.values.length; j++) {
                    encodeElem(d.values[j], buffer, dictionary, arrayProtocol, cache);
                }
                break;
        }
    }
    buffer.push(DELTA_END);
}
function protocolEncode(payload, buffer, dictionary, protocol) {
    var cache = {};
    // Encode the protocol section into a temporary buffer so we can prefix its length.
    // The 2-byte (uint16 BE) length lets the decoder skip the protocol section and get
    // straight to the ENCODER-serialised payload.
    // let protocolBuffer = [];
    recurseProtocolEncode(payload, buffer, dictionary, protocol, cache);
    // Full ENCODER payload — used by the decoder.
    // ENCODER.serializeEX(payload, protocolBuffer, dictionary, cache);
    var arrBuffer = new Uint8Array(buffer);
    return arrBuffer.buffer;
}
// Decode the payload section of a custom-encoded gameupdate message.
// pos points to the first byte after the type byte.
function protocolDecode(view, pos, dictionary, protocol) {
    // Read and skip the 2-byte protocol-section length.
    // Decode the ENCODER-serialised payload that follows.
    var ref = { buffer: view, pos: pos, dict: dictionary };
    var json = {};
    json = recurseProtocolDecode(ref, json, dictionary, protocol);
    return json;
}
function recurseProtocolDecode(ref, json, dictionary, protocol) {
    var _a;
    var mask = ref.buffer.getUint8(ref.pos++);
    for (var bit = 0; bit < 8; bit++) {
        if (!(mask & (1 << bit)))
            continue;
        var protoEntry = protocol[bit + 1];
        if (protoEntry === undefined)
            continue;
        var key = typeof protoEntry === 'string' ? protoEntry : protoEntry.$key;
        if (protoEntry.$isDelta) {
            // Schema-declared always-delta entry — decode directly as array delta
            json['#' + key] = [];
            decodeArrayDelta(ref, json['#' + key], dictionary, (_a = protoEntry.$array) !== null && _a !== void 0 ? _a : null);
        }
        else if (typeof protoEntry === 'string') {
            json[key] = (0, encoder_1.deserializeEX)(ref);
        }
        else if (protoEntry.$object) {
            json[key] = recurseProtocolDecode(ref, {}, dictionary, protoEntry.$object);
        }
        else if (protoEntry.$array) {
            // Discriminator: 0 = normal array, 1 = delta array
            var discriminator = ref.buffer.getUint8(ref.pos++);
            if (discriminator === 1) {
                json['#' + key] = [];
                decodeArrayDelta(ref, json['#' + key], dictionary, protoEntry.$array);
            }
            else {
                var arrayLen = readVarUint(ref);
                json[key] = [];
                for (var j = 0; j < arrayLen; j++) {
                    json[key].push(recurseProtocolDecode(ref, {}, dictionary, protoEntry.$array));
                }
            }
        }
        else {
            json[key] = (0, encoder_1.deserializeEX)(ref);
        }
    }
    return json;
}
function decodeElem(ref, dictionary, arrayProtocol) {
    return arrayProtocol
        ? recurseProtocolDecode(ref, {}, dictionary, arrayProtocol)
        : (0, encoder_1.deserializeEX)(ref);
}
function decodeArrayDelta(ref, arr, dictionary, arrayProtocol) {
    while (true) {
        var op = ref.buffer.getUint8(ref.pos++);
        if (op === DELTA_END)
            break;
        switch (op) {
            case DELTA_RESIZE: {
                var value = readVarUint(ref);
                arr.push({ op: 'resize', value: value });
                break;
            }
            case DELTA_SET: {
                var index = ref.buffer.getUint8(ref.pos++);
                var value = decodeElem(ref, dictionary, arrayProtocol);
                arr.push({ op: 'set', index: index, value: value });
                break;
            }
            case DELTA_PATCH: {
                var index = ref.buffer.getUint8(ref.pos++);
                var subType = ref.buffer.getUint8(ref.pos++);
                if (subType === 1) {
                    var value = [];
                    decodeArrayDelta(ref, value, dictionary, null);
                    arr.push({ op: 'patch', index: index, value: value });
                }
                else {
                    var value = arrayProtocol
                        ? recurseProtocolDecode(ref, {}, dictionary, arrayProtocol)
                        : (0, encoder_1.deserializeEX)(ref);
                    arr.push({ op: 'patch', index: index, value: value });
                }
                break;
            }
            case DELTA_SETRANGE: {
                var index = ref.buffer.getUint8(ref.pos++);
                var count = readVarUint(ref);
                var values = [];
                for (var j = 0; j < count; j++)
                    values.push(decodeElem(ref, dictionary, arrayProtocol));
                arr.push({ op: 'setrange', index: index, values: values });
                break;
            }
            case DELTA_FILL: {
                var index = ref.buffer.getUint8(ref.pos++);
                var length_1 = readVarUint(ref);
                var value = decodeElem(ref, dictionary, arrayProtocol);
                arr.push({ op: 'fill', index: index, length: length_1, value: value });
                break;
            }
            case DELTA_REPLACE: {
                var count = readVarUint(ref);
                var values = [];
                for (var j = 0; j < count; j++)
                    values.push(decodeElem(ref, dictionary, arrayProtocol));
                arr.push({ op: 'replace', values: values });
                break;
            }
        }
    }
}
function protoEncode(data, dictionary) {
    if (dictionary === void 0) { dictionary = undefined; }
    if (!(data === null || data === void 0 ? void 0 : data.type)) {
        throw new Error("Data must have a 'type' property for encoding");
    }
    // if (!data?.payload) {
    //     throw new Error("Data must have a 'payload' property for encoding");
    // }
    var dict = (0, encoder_1.createDefaultDict)(dictionary);
    dict.frozen = true;
    var buffer = [];
    var schemaId = 0;
    if (!(data.type in messageProtocols)) {
        console.warn("Unknown message type for protocol encoding:", data.type);
        console.warn("Defaulting to 0 (no schema) for this message. This may cause larger payloads and should be fixed by adding the message type and protocol to the encoder.");
    }
    else
        schemaId = messageProtocols[data.type].schema;
    buffer.push(schemaId); // default to 0 if type is unknown
    if (schemaId > 0 && messageProtocols[data.type]) {
        return protocolEncode(data.payload, buffer, dict, messageProtocols[data.type].protocol);
    }
    var payload = (0, encoder_1.serializeEX)(data, buffer, dict, {});
    return new Uint8Array(buffer).buffer;
    // return ENCODER.encode(data);
}
function protoDecode(data, dictionary) {
    if (dictionary === void 0) { dictionary = undefined; }
    var dict = (0, encoder_1.createDefaultDict)(dictionary);
    dict.frozen = true;
    // Custom-encoded messages (e.g. gameupdate) arrive as an ArrayBuffer / typed array
    // with a message-type byte at position 0.
    var buffer = null;
    if (data instanceof ArrayBuffer) {
        buffer = new DataView(data);
    }
    else if (ArrayBuffer.isView(data)) {
        buffer = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }
    var pos = 0;
    if (buffer) {
        var typeByte = buffer.getUint8(pos++);
        if (typeByte > 0) {
            var typeName = indexToMessageType[typeByte];
            if (typeName && messageProtocols[typeName]) {
                var payload = protocolDecode(buffer, pos, dict, messageProtocolByteMap[typeName]);
                return { type: typeName, payload: payload };
            }
        }
    }
    // Standard path: ENCODER.encode(data) was used, so ENCODER.decode reverses it.
    var ref = {
        buffer: buffer,
        pos: pos,
        dict: dict,
    };
    return (0, encoder_1.deserializeEX)(ref);
}
