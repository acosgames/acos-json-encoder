export declare function initProtocols(_messageProtocols: ProtocolSchema): void;
export declare function protoEncode(data: ProtocolHeader, dictionary: string[] | null, protocol: any): ArrayBuffer;
export declare function protoDecode(data: any, dictionary: any): any;
