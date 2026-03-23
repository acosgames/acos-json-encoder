declare function createDefaultDict(storedDict: any): any;
declare function serialize(json: any, dict: any): ArrayBuffer;
declare function deserialize(buffer: any, pos: any, dict: any): any;
declare function encode(json: any, storedDict: any): ArrayBuffer;
declare function decode(raw: any, storedDict: any): any;
export { encode, decode, serialize, deserialize, createDefaultDict };
