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
export declare function setStringDictionaryWT(dict: string[]): void;
type PrimitiveKind = 'uint' | 'int' | 'float' | 'string' | 'boolean' | 'null' | 'undefined' | 'object' | 'array';
interface CompiledField {
    key: string;
    node: CompiledNode;
}
type CompiledNode = {
    kind: 'primitive';
    type: PrimitiveKind;
} | {
    kind: 'object';
    fields: CompiledField[];
} | {
    kind: 'map';
    valueNode: CompiledNode;
} | {
    kind: 'array';
    elementNode: CompiledNode;
} | {
    kind: 'static';
    elementNode: CompiledNode;
};
interface DecodeRef {
    view: DataView;
    pos: number;
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
export declare function compileSchema(schema: any): CompiledNode;
export declare function encodeNode(value: any, node: CompiledNode, buffer: number[]): void;
export declare function decodeNode(ref: DecodeRef, node: CompiledNode): any;
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
export declare function registerProtocolWT(protocolOrTypeName: any, payloadSchema?: any): void;
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
export declare function protoEncodeWT(data: {
    type: string;
    payload: any;
} | any): ArrayBuffer;
/**
 * Decode bytes produced by `protoEncodeWT` back to `{ type, payload }`.
 *
 * @param data   ArrayBuffer or ArrayBufferView (e.g. Uint8Array, Buffer).
 * @returns      Object with a `type` string and a `payload` object.
 * @throws       Error if the type index is non-zero but unregistered.
 */
export declare function protoDecodeWT(data: ArrayBuffer | ArrayBufferView): {
    type: string;
    payload: any;
};
export {};
//# sourceMappingURL=protocol-withtypes.d.ts.map