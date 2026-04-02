type EncoderDict = {
    count: number;
    keys: {
        [key: string]: number;
    };
    order: string[];
    frozen?: boolean;
};
declare function createDefaultDict(storedDict?: string[]): EncoderDict;
declare function serialize(json: any, dict?: EncoderDict): ArrayBuffer;
declare function serializeEX(json: any, buffer: number[], dict: EncoderDict, cache: {
    [key: string]: number;
}): void;
declare function deserialize(buffer: any, pos: number, dict: any): any;
declare function deserializeEX(ref: {
    buffer: any;
    pos: number;
    dict: any;
}): any;
declare function encode(json: any, storedDict?: string[]): ArrayBuffer;
declare function decode(raw: any, storedDict?: string[]): any;
export { encode, decode, serialize, deserialize, serializeEX, deserializeEX, createDefaultDict };
