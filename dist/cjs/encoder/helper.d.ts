export declare function writeLEB128(buffer: number[], value: number): void;
export declare function writeSLEB128(buffer: number[], value: number): void;
export declare function readLEB128(ref: DecodeRef): number;
export declare function readSLEB128(ref: DecodeRef): number;
export declare function encodeFloat64(value: number, buffer: number[]): void;
export declare function decodeFloat64(ref: DecodeRef): number;
export declare function encodeString(value: string, buffer: number[], dictionary: EncoderDict | undefined, cache?: any): void;
export declare function decodeString(ref: DecodeRef): string;
export declare function isObject(value: any): boolean;
export declare function areEqual(a: any, b: any): boolean;
//# sourceMappingURL=helper.d.ts.map