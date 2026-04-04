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






let indexToMessageType: string[] = []

let messageProtocolByteMap: { [key: string]: any } = {};


function mapByteToProtocol(protocol:Protocol, target = {}) {

    for (let $key in protocol) {

        if (protocol[$key]?.$byte) {
            let byte = protocol[$key].$byte;

            if (protocol[$key]?.$object) {
                target[byte] = { $key, $object: {} };
                mapByteToProtocol(protocol[$key].$object, target[byte].$object);
            } else if (protocol[$key]?.$array) {
                target[byte] = { $key, $array: {} };
                mapByteToProtocol(protocol[$key].$array, target[byte].$array);
            } else {
                // $byte only (e.g. state: { $byte: 6 }) — value is ENCODER-serialised
                target[byte] = { $key };
            }
        }
        else {
            let byte = protocol[$key];
            target[byte] = $key;
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
    }
}


function recurseProtocolEncode(payload, buffer, dictionary: EncoderDict, protocol, cache = {}) {
    // Arrays: write length then recurse each item via $array schema
    if (Array.isArray(payload)) {
        if (protocol.$array) {
            writeVarUint(buffer, payload.length);
            for (let item of payload) {
                recurseProtocolEncode(item, buffer, dictionary, protocol.$array, cache);
            }
        } else {
            serializeEX(payload, buffer, dictionary, cache);
        }
        return;
    }

    // Primitives: serialise with ENCODER and return immediately
    if (!isObject(payload)) {
        serializeEX(payload, buffer, dictionary, cache);
        return;
    }

    // Pass 1: count schema entries and non-schema keys (fast, no serialization).
    let schemaCount = 0;
    let nonSchemaCount = 0;
    for (let key in payload) {
        if (key[0] === '#') {
            const protoEntry = protocol[key.substring(1)];
            if (protoEntry?.$array) {
                const deltas = payload[key];
                if (Array.isArray(deltas)) {
                    for (let i = 0; i < deltas.length; i++) {
                        if (deltas[i].type === 'setvalue') schemaCount++;
                    }
                }
            } else {
                nonSchemaCount++;
            }
        } else if (protocol[key] !== undefined) {
            schemaCount++;
        } else {
            nonSchemaCount++;
        }
    }

    // Pass 2: write schema entries.
    writeVarUint(buffer, schemaCount);
    for (let key in payload) {
        if (key[0] === '#') {
            const protoEntry = protocol[key.substring(1)];
            if (protoEntry?.$array) {
                const deltas = payload[key];
                if (Array.isArray(deltas)) {
                    for (let i = 0; i < deltas.length; i++) {
                        const delta = deltas[i];
                        if (delta.type === 'setvalue') {
                            // High bit (0x80) flags this byte as a setvalue delta; low 7 bits are the proto byte.
                            buffer.push(protoEntry.$byte | 0x80);
                            buffer.push(delta.index);
                            recurseProtocolEncode(delta.value, buffer, dictionary, protoEntry.$array, cache);
                        }
                    }
                }
            }
        } else if (protocol[key] !== undefined) {
            const protoEntry = protocol[key];
            const byte = typeof protoEntry === 'number' ? protoEntry : protoEntry.$byte;
            buffer.push(byte);
            if (typeof protoEntry === 'object') {
                if (protoEntry.$object) {
                    recurseProtocolEncode(payload[key], buffer, dictionary, protoEntry.$object, cache);
                } else if (protoEntry.$array) {
                    recurseProtocolEncode(payload[key], buffer, dictionary, protoEntry, cache);
                } else {
                    serializeEX(payload[key], buffer, dictionary, cache);
                }
            } else {
                serializeEX(payload[key], buffer, dictionary, cache);
            }
        }
    }

    // Pass 3: write non-schema entries.
    writeVarUint(buffer, nonSchemaCount);
    for (let key in payload) {
        if (key[0] === '#') {
            if (!protocol[key.substring(1)]?.$array) {
                serializeEX(key, buffer, dictionary, cache);
                serializeEX(payload[key], buffer, dictionary, cache);
            }
        } else if (protocol[key] === undefined) {
            serializeEX(key, buffer, dictionary, cache);
            serializeEX(payload[key], buffer, dictionary, cache);
        }
    }
}

function protocolEncode(payload, buffer, dictionary: EncoderDict, protocol) {

    let cache = {};

    // Encode the protocol section into a temporary buffer so we can prefix its length.
    // The 2-byte (uint16 BE) length lets the decoder skip the protocol section and get
    // straight to the ENCODER-serialised payload.
    // let protocolBuffer = [];
    recurseProtocolEncode(payload, buffer,  dictionary, protocol, cache);

    // Full ENCODER payload — used by the decoder.
    // ENCODER.serializeEX(payload, protocolBuffer, dictionary, cache);

    let arrBuffer = Uint8Array.from(buffer);
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
    let schemaCount = readVarUint(ref);

    for (let i = 0; i < schemaCount; i++) {
        let byte = ref.buffer.getUint8(ref.pos++);
        let isDelta = (byte & 0x80) !== 0;
        let protoByte = byte & 0x7F;
        let protoEntry = protocol[protoByte];

        if (protoEntry === undefined) {
            console.error('Unknown protocol byte:', protoByte, 'at pos:', ref.pos - 1);
            break;
        }

        let key = typeof protoEntry === 'string' ? protoEntry : protoEntry.$key;

        if (isDelta) {
            // setvalue delta: [index: uint8][value encoded with $array schema]
            let index = ref.buffer.getUint8(ref.pos++);
            let value = recurseProtocolDecode(ref, {}, dictionary, protoEntry.$array);
            let deltaKey = '#' + key;
            if (!json[deltaKey]) json[deltaKey] = [];
            json[deltaKey].push({ index, type: 'setvalue', value });
        } else if (typeof protoEntry === 'object') {
            if (protoEntry.$object) {
                json[key] = recurseProtocolDecode(ref, {}, dictionary, protoEntry.$object);
            } else if (protoEntry.$array) {
                let arrayLen = readVarUint(ref);
                json[key] = [];
                for (let j = 0; j < arrayLen; j++) {
                    json[key].push(recurseProtocolDecode(ref, {}, dictionary, protoEntry.$array));
                }
            } else {
                // $key only entry (e.g. state: { $byte: 6 }) — value is ENCODER-serialised
                json[key] = deserializeEX(ref);
            }
        } else {
            // Plain string entry — value is ENCODER-serialised
            json[key] = deserializeEX(ref);
        }
    }

    // Non-schema keys: [count] [key_str][value] ...
    let nonSchemaCount = readVarUint(ref);
    for (let i = 0; i < nonSchemaCount; i++) {
        let key = deserializeEX(ref);
        json[key] = deserializeEX(ref);
    }

    return json;
}


export function protoEncode(data: ProtocolHeader, dictionary: string[] | null, protocol) {

    if (!data?.type) {
        throw new Error("Data must have a 'type' property for encoding");
    }
    if (!data?.payload) {
        throw new Error("Data must have a 'payload' property for encoding");
    }

    let dict = createDefaultDict(dictionary);
    dict.frozen = true;

     let buffer = []

    buffer.push(messageProtocols[data.type]?.schema || 0); // default to 0 if type is unknown
    if (messageProtocols[data.type]) {
        return protocolEncode(data.payload, buffer, dict, messageProtocols[data.type].protocol);
    }
    
    let payload = serialize(data, dict);
    return payload;
    // return ENCODER.encode(data);
}

export function protoDecode(data, dictionary) {

    let dict = createDefaultDict(dictionary);
    dict.frozen = true;


    // Custom-encoded messages (e.g. gameupdate) arrive as an ArrayBuffer / typed array
    // with a message-type byte at position 0.
    let view = null;
    if (data instanceof ArrayBuffer) {
        view = new DataView(data);
    } else if (ArrayBuffer.isView(data)) {
        view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }

    if (view) {
        let pos = 0;
        let typeByte = view.getUint8(pos++);
        let typeName = indexToMessageType[typeByte];
        if (typeName && messageProtocols[typeName]) {
            let payload = protocolDecode(view, pos, dict, messageProtocolByteMap[typeName]);
            return { type: typeName, payload };
        }
    }

    // Standard path: ENCODER.encode(data) was used, so ENCODER.decode reverses it.
    return deserialize(view, 0, dict);
}



