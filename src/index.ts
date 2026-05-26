export { encode, decode, serialize, deserialize, serializeEX, deserializeEX, createDefaultDict } from "./encoder/encoder.js";
export { registerProtocol, registerExtension, applyExtension, disableExtension, protoEncode, protoDecode, protoEncodeDebug, setDefaultDictionary, getProtocolSchema } from "./encoder/protocol.js";
export { delta, merge, hidden, unhidden } from "./delta/delta.js";