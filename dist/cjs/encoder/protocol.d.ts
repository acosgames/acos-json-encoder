export declare function setDefaultDictionary(dictionaryList: string[]): void;
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
export declare function revertProtocol(baseType: string): void;
export declare function extendProtocol(baseType: string, overrides: Record<string, any>): void;
export declare function getProtocolSchema(type: string): any;
export declare function registerProtocol(protocol: any, dictionaryList?: string[]): void;
export declare function protoEncode(payload: any): ArrayBuffer;
export declare function encodeNode(value: any, protocol: Protocol, node: CompiledNode, buffer: number[], cache?: any): void;
export declare function protoDecode(data: ArrayBuffer | Uint8Array, dictionaryList?: EncoderDict): {
    type: string;
    payload: any;
};
export declare function decodeNode(ref: DecodeRef, protocol: Protocol, node: CompiledNode): any;
//# sourceMappingURL=protocol.d.ts.map