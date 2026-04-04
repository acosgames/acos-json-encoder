interface ProtocolTypes {
    [messageType: string]: number;
}
interface ProtocolSchemas {
    [messageType: string]: any;
}
export declare function initProtocols(_messageTypes: ProtocolTypes, _messageProtocols: ProtocolSchemas): void;
export declare function protoEncode(data: any, dictionary: any, protocol: any): ArrayBuffer;
export declare function protoDecode(data: any, dictionary: any): any;
export {};
