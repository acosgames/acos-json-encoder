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


type Resize    = { op: 'resize';   value: number };
type SetElem   = { op: 'set';      index: number; value: any };
type SetRange  = { op: 'setrange'; index: number; values: any[] };
type Fill      = { op: 'fill';     index: number; length: number; value: any };
type PatchElem = { op: 'patch';    index: number; value: any };
type Replace   = { op: 'replace';  values: any[] };
type ArrayChange = Resize | SetElem | SetRange | Fill | PatchElem | Replace;

