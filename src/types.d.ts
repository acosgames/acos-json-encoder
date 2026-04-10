
type Dictionary = string[];


interface ProtocolTypes {
    [messageType: string]: number;
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
type Replace   = { op: 'replace';  values: any[] };
type ArrayChange = Resize | SetElem | SetRange | Fill | Replace;




interface DecodeRef {
    view: DataView;
    pos: number;
}

type EncoderDict = {
    count: number;
    keys: { [key: string]: number };
    order: string[];
    frozen?: boolean;
}

type Protocol = {
    type: string;
    index: number;
    schema: CompiledNode;
    originalSchema?: CompiledNode;
    dictionary?: EncoderDict;
}

type PrimitiveKind =
    | 'uint' | 'int' | 'float' | 'string' | 'boolean'
    | 'null' | 'undefined' | 'object' | 'array';

interface CompiledField {
    key: string;
    node: CompiledNode;
}

interface CompiledFieldMap {
    [key: string]: number;
}
type CompiledNode =
    | { kind: 'any'; type: 'any' }
    | { kind: 'primitive'; type: PrimitiveKind }
    | { kind: 'object';    mapping: CompiledFieldMap; fields: CompiledField[] }
    | { kind: 'map';       mapping: CompiledFieldMap; fields: CompiledField[] }
    | { kind: 'array';     elementNode: CompiledNode }
    | { kind: 'static';    elementNode: CompiledNode }
    | { kind: 'custom';    node: CompiledNode }
    | { kind: 'enum';      values: (string | number)[] };


interface ProtocolNode {
    protocol: Protocol;
    schema: CompiledNode;
}

interface DecodeRef {
    view: DataView;
    pos: number;
    dictionary: EncoderDict | undefined;
}
