type EncoderDict = {
    count: number;
    keys: { [key: string]: number };
    order: string[];
    frozen?: boolean;
}

type Dictionary = string[];


interface ProtocolTypes {
    [messageType: string]: number;
}

interface ProtocolHeader {
    type: number;
    payload: Protocol;
}

interface Protocol {
    $byte?: number;
    $object?: Protocol;
    $array?: Protocol;
    [key: string]: any;
}

interface ProtocolSchema {
    [messageType: string]: {
        schema: number;
        protocol: Protocol;
    };
}

