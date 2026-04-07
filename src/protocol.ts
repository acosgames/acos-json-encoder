import { delta } from "./delta/delta";
import { createDefaultDict, decode, deserialize, deserializeEX, encode, serialize, serializeEX } from "./encoder";
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
    } else {
        buffer.push((n & 0x7F) | 0x80, n >> 7);
    }
}

function readVarUint(ref) {
    const b = ref.buffer.getUint8(ref.pos++);
    if (b & 0x80) {
        return (b & 0x7F) | (ref.buffer.getUint8(ref.pos++) << 7);
    }
    return b;
}

interface SortedSchemaEntry {
    byte: number;
    payloadKey: string;  // key in the output JSON (without leading #)
    lookupKey: string;   // actual key to look up in the input payload
    isDelta: boolean;
    protoEntry: any;
}

function precomputeProtocol(protocol: any): void {
    if (protocol.$sortedSchema !== undefined) return; // already done

    const sorted: SortedSchemaEntry[] = [];
    for (const key in protocol) {
        if (key[0] === '$') continue; // skip existing meta-properties
        const entry = protocol[key];
        const isDelta = key[0] === '#';
        const payloadKey = isDelta ? key.slice(1) : key;
        const byte: number | undefined = (typeof entry === 'number') ? entry : entry?.$byte;
        if (byte === undefined) continue;
        sorted.push({ byte, payloadKey, lookupKey: key, isDelta, protoEntry: entry });
    }

    sorted.sort((a, b) => a.byte - b.byte);

    protocol.$sortedSchema = sorted;
    protocol.$schemaKeySet = new Set<string>(sorted.map(e => e.lookupKey));

    // Recurse into nested sub-protocols
    for (const e of sorted) {
        if (e.protoEntry?.$object) precomputeProtocol(e.protoEntry.$object);
        if (e.protoEntry?.$array) precomputeProtocol(e.protoEntry.$array);
    }
}






let indexToMessageType: string[] = []

let messageProtocolByteMap: { [key: string]: any } = {};


function mapByteToProtocol(protocol: Protocol, target = {}) {

    for (let $key in protocol) {
        const isDelta = $key[0] === '#';
        const baseKey = isDelta ? $key.slice(1) : $key;

        if (protocol[$key]?.$byte) {
            let byte = protocol[$key].$byte;

            if (protocol[$key]?.$object) {
                target[byte] = { $key: baseKey, $object: {} };
                mapByteToProtocol(protocol[$key].$object, target[byte].$object);
            } else if (protocol[$key]?.$array) {
                target[byte] = { $key: baseKey, $array: {}, $isDelta: isDelta };
                mapByteToProtocol(protocol[$key].$array, target[byte].$array);
            } else {
                target[byte] = { $key: baseKey };
            }
        }
        else {
            let byte = protocol[$key];
            target[byte] = isDelta ? { $key: baseKey, $isDelta: true } : baseKey;
        }
    }
    return target;
}



let messageProtocols: ProtocolSchema = {};

export function initProtocols(_messageProtocols: ProtocolSchema) {

    messageProtocols = _messageProtocols;

    for (let key in messageProtocols) {
        const value = messageProtocols[key].schema;
        indexToMessageType[value] = key;
    }

    //reverse the mapping of the message protocol, example PROTOCOL_GAME maps keys to byte, now reversing maps bytes to keys
    for (let key in messageProtocols) {
        let byteMap = {};
        messageProtocolByteMap[key] = mapByteToProtocol(messageProtocols[key].protocol, byteMap);
        precomputeProtocol(messageProtocols[key].protocol);
    }
}


function recurseProtocolEncode(payload, buffer, dictionary: EncoderDict, protocol, cache = {}) {
    // Arrays: write length then recurse each item via $array schema
    if (Array.isArray(payload)) {
        if (protocol.$array) {
            writeVarUint(buffer, payload.length);
            for (const item of payload) {
                recurseProtocolEncode(item, buffer, dictionary, protocol.$array, cache);
            }
        } else {
            serializeEX(payload, buffer, dictionary, cache);
        }
        return;
    }

    // Primitives: serialise with encoder and return immediately
    if (!isObject(payload)) {
        serializeEX(payload, buffer, dictionary, cache);
        return;
    }

    // No protocol defined for this object — fall back to generic serialisation
    if (!protocol.$sortedSchema) {
        serializeEX(payload, buffer, dictionary, cache);
        return;
    }

    const sortedSchema: SortedSchemaEntry[] = protocol.$sortedSchema;

    // Reserve one byte for the presence mask
    const reservedPos = buffer.length;
    buffer.push(0);

    let mask = 0;

    for (let i = 0; i < sortedSchema.length; i++) {
        const e = sortedSchema[i];
        const p = e.protoEntry;

        if (e.isDelta) {
            // Schema-declared always-delta entry (e.g. "#players": 6):
            // present only when '#key' appears in payload
            if (!('#' + e.payloadKey in payload)) continue;
            mask |= (1 << (e.byte - 1));
            encodeArrayDelta(payload['#' + e.payloadKey], buffer, dictionary, p?.$array ?? null, cache);
            continue;
        }

        const normalPresent = e.payloadKey in payload;

        if (!normalPresent) {
            // Delta form via '#key': only valid for $array fields without a dedicated isDelta entry
            if (p?.$array && ('#' + e.payloadKey in payload)) {
                mask |= (1 << (e.byte - 1));
                buffer.push(1); // discriminator: delta array
                encodeArrayDelta(payload['#' + e.payloadKey], buffer, dictionary, p.$array, cache);
            }
            continue;
        }

        mask |= (1 << (e.byte - 1));
        const val = payload[e.payloadKey];
        if (typeof p === 'object') {
            if (p.$object) {
                recurseProtocolEncode(val, buffer, dictionary, p.$object, cache);
            } else if (p.$array) {
                buffer.push(0); // discriminator: normal array
                writeVarUint(buffer, val.length);
                for (let j = 0; j < val.length; j++) {
                    recurseProtocolEncode(val[j], buffer, dictionary, p.$array, cache);
                }
            } else {
                serializeEX(val, buffer, dictionary, cache);
            }
        } else {
            serializeEX(val, buffer, dictionary, cache);
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
const DELTA_END      = 0;
const DELTA_RESIZE   = 1;
const DELTA_SET      = 2;
const DELTA_PATCH    = 3;
const DELTA_SETRANGE = 4;
const DELTA_FILL     = 5;
const DELTA_REPLACE  = 6;

function encodeElem(value: any, buffer: number[], dictionary: EncoderDict, arrayProtocol: any, cache: any) {
    if (arrayProtocol) {
        recurseProtocolEncode(value, buffer, dictionary, arrayProtocol, cache);
    } else {
        serializeEX(value, buffer, dictionary, cache);
    }
}

function encodeArrayDelta(arr: any[], buffer: number[], dictionary: EncoderDict, arrayProtocol: any, cache: any) {
    for (let i = 0; i < arr.length; i++) {
        const d = arr[i];
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
                } else {
                    buffer.push(0); // sub_type: object patch
                    if (arrayProtocol) {
                        recurseProtocolEncode(d.value, buffer, dictionary, arrayProtocol, cache);
                    } else {
                        serializeEX(d.value, buffer, dictionary, cache);
                    }
                }
                break;
            case 'setrange':
                buffer.push(DELTA_SETRANGE);
                buffer.push(d.index);
                writeVarUint(buffer, d.values.length);
                for (let j = 0; j < d.values.length; j++) {
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
                for (let j = 0; j < d.values.length; j++) {
                    encodeElem(d.values[j], buffer, dictionary, arrayProtocol, cache);
                }
                break;
        }
    }
    buffer.push(DELTA_END);
}

function protocolEncode(payload, buffer, dictionary: EncoderDict, protocol) {

    let cache = {};

    // Encode the protocol section into a temporary buffer so we can prefix its length.
    // The 2-byte (uint16 BE) length lets the decoder skip the protocol section and get
    // straight to the ENCODER-serialised payload.
    // let protocolBuffer = [];
    recurseProtocolEncode(payload, buffer, dictionary, protocol, cache);

    // Full ENCODER payload — used by the decoder.
    // ENCODER.serializeEX(payload, protocolBuffer, dictionary, cache);

    let arrBuffer = new Uint8Array(buffer);
    return arrBuffer.buffer;
}



// Decode the payload section of a custom-encoded gameupdate message.
// pos points to the first byte after the type byte.
function protocolDecode(view, pos, dictionary, protocol) {
    // Read and skip the 2-byte protocol-section length.

    // Decode the ENCODER-serialised payload that follows.
    let ref = { buffer: view, pos, dict: dictionary };
    let json = {};
    json = recurseProtocolDecode(ref, json, dictionary, protocol);

    return json;
}



function recurseProtocolDecode(ref, json, dictionary, protocol) {
    const mask = ref.buffer.getUint8(ref.pos++);

    for (let bit = 0; bit < 8; bit++) {
        if (!(mask & (1 << bit))) continue;
        const protoEntry = protocol[bit + 1];
        if (protoEntry === undefined) continue;

        const key = typeof protoEntry === 'string' ? protoEntry : protoEntry.$key;

        if (protoEntry.$isDelta) {
            // Schema-declared always-delta entry — decode directly as array delta
            json['#' + key] = [];
            decodeArrayDelta(ref, json['#' + key], dictionary, protoEntry.$array ?? null);
        } else if (typeof protoEntry === 'string') {
            json[key] = deserializeEX(ref);
        } else if (protoEntry.$object) {
            json[key] = recurseProtocolDecode(ref, {}, dictionary, protoEntry.$object);
        } else if (protoEntry.$array) {
            // Discriminator: 0 = normal array, 1 = delta array
            const discriminator = ref.buffer.getUint8(ref.pos++);
            if (discriminator === 1) {
                json['#' + key] = [];
                decodeArrayDelta(ref, json['#' + key], dictionary, protoEntry.$array);
            } else {
                const arrayLen = readVarUint(ref);
                json[key] = [];
                for (let j = 0; j < arrayLen; j++) {
                    json[key].push(recurseProtocolDecode(ref, {}, dictionary, protoEntry.$array));
                }
            }
        } else {
            json[key] = deserializeEX(ref);
        }
    }

    return json;
}

function decodeElem(ref, dictionary, arrayProtocol: any): any {
    return arrayProtocol
        ? recurseProtocolDecode(ref, {}, dictionary, arrayProtocol)
        : deserializeEX(ref);
}

function decodeArrayDelta(ref, arr: any[], dictionary, arrayProtocol: any) {
    while (true) {
        const op = ref.buffer.getUint8(ref.pos++);
        if (op === DELTA_END) break;
        switch (op) {
            case DELTA_RESIZE: {
                const value = readVarUint(ref);
                arr.push({ op: 'resize', value });
                break;
            }
            case DELTA_SET: {
                const index = ref.buffer.getUint8(ref.pos++);
                const value = decodeElem(ref, dictionary, arrayProtocol);
                arr.push({ op: 'set', index, value });
                break;
            }
            case DELTA_PATCH: {
                const index = ref.buffer.getUint8(ref.pos++);
                const subType = ref.buffer.getUint8(ref.pos++);
                if (subType === 1) {
                    const value: any[] = [];
                    decodeArrayDelta(ref, value, dictionary, null);
                    arr.push({ op: 'patch', index, value });
                } else {
                    const value = arrayProtocol
                        ? recurseProtocolDecode(ref, {}, dictionary, arrayProtocol)
                        : deserializeEX(ref);
                    arr.push({ op: 'patch', index, value });
                }
                break;
            }
            case DELTA_SETRANGE: {
                const index = ref.buffer.getUint8(ref.pos++);
                const count = readVarUint(ref);
                const values: any[] = [];
                for (let j = 0; j < count; j++) values.push(decodeElem(ref, dictionary, arrayProtocol));
                arr.push({ op: 'setrange', index, values });
                break;
            }
            case DELTA_FILL: {
                const index = ref.buffer.getUint8(ref.pos++);
                const length = readVarUint(ref);
                const value = decodeElem(ref, dictionary, arrayProtocol);
                arr.push({ op: 'fill', index, length, value });
                break;
            }
            case DELTA_REPLACE: {
                const count = readVarUint(ref);
                const values: any[] = [];
                for (let j = 0; j < count; j++) values.push(decodeElem(ref, dictionary, arrayProtocol));
                arr.push({ op: 'replace', values });
                break;
            }
        }
    }
}

export function protoEncode(data: any, dictionary: string[] | null | undefined = undefined) {

    if (!data?.type) {
        throw new Error("Data must have a 'type' property for encoding");
    }
    // if (!data?.payload) {
    //     throw new Error("Data must have a 'payload' property for encoding");
    // }

    let dict = createDefaultDict(dictionary);
    dict.frozen = true;

    let buffer = []

    let schemaId = 0;
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

    let payload = serializeEX(data, buffer, dict, {});
    return new Uint8Array(buffer).buffer;
    // return ENCODER.encode(data);
}

export function protoDecode(data: any, dictionary: string[] | undefined | null = undefined) {

    let dict = createDefaultDict(dictionary);
    dict.frozen = true;


    // Custom-encoded messages (e.g. gameupdate) arrive as an ArrayBuffer / typed array
    // with a message-type byte at position 0.
    let buffer = null;
    if (data instanceof ArrayBuffer) {
        buffer = new DataView(data);
    } else if (ArrayBuffer.isView(data)) {
        buffer = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }

    let pos = 0;
    if (buffer) {
        let typeByte = buffer.getUint8(pos++);
        if (typeByte > 0) {
            let typeName = indexToMessageType[typeByte];
            if (typeName && messageProtocols[typeName]) {
                let payload = protocolDecode(buffer, pos, dict, messageProtocolByteMap[typeName]);
                return { type: typeName, payload };
            }
        }
    }

    // Standard path: ENCODER.encode(data) was used, so ENCODER.decode reverses it.
    var ref = {
        buffer,
        pos,
        dict,
    };
    return deserializeEX(ref);
}



