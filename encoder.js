const encoderVersion = "1.2";
console.log("ENCODER VERSION = " + encoderVersion);

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getBigUint64(view, position, littleEndian = false) {
    if ("getBigUint64" in DataView.prototype) {
        return view.getBigUint64(position, littleEndian);
    }

    const lsb = BigInt(
        view.getUint32(position + (littleEndian ? 0 : 4), littleEndian)
    );
    const gsb = BigInt(
        view.getUint32(position + (littleEndian ? 4 : 0), littleEndian)
    );
    return lsb + 4294967296n * gsb;
}

function setBigUint64(view, byteOffset, value, littleEndian) {
    if ("setBigUint64" in DataView.prototype) {
        view.setBigUint64(byteOffset, BigInt(value), littleEndian);
        return true;
    }

    let buff = bnToBuf(value);
    for (var i = 0; i < buff.length; i++) {
        view.setUint8(byteOffset + i, buff[i]);
    }
    return true;
}

function bnToBuf(bn) {
    var hex = BigInt(bn).toString(16);
    if (hex.length % 2) {
        hex = "0" + hex;
    }

    var len = hex.length / 2;
    var u8 = [];

    for (let x = 0; x < 8 - len; x++) {
        u8.push(0);
    }
    var i = 0;
    var j = 0;
    while (i < len) {
        u8.push(parseInt(hex.slice(j, j + 2), 16));
        i += 1;
        j += 2;
    }

    return u8;
}

const TYPE_OBJ = 254;
const TYPE_ARR = 253;
// const TYPE_BOOL = 253
const TYPE_DATE = 252;
const TYPE_DICT = 251;
const TYPE_STRING = 250;
const TYPE_INT8 = 249;
const TYPE_UINT8 = 248;
const TYPE_INT16 = 247;
const TYPE_UINT16 = 246;
const TYPE_INT32 = 245;
const TYPE_UINT32 = 244;
const TYPE_INT64 = 243;
const TYPE_UINT64 = 242;
const TYPE_FLOAT32 = 241;
const TYPE_FLOAT64 = 240;
const TYPE_ENDOBJ = 239;
const TYPE_ENDARR = 238;
const TYPE_FLOATSTR = 237;
const TYPE_NULL = 236;
const TYPE_ZERO = 235;
const TYPE_EMPTYSTRING = 234;
const TYPE_TRUE = 233;
const TYPE_FALSE = 232;
const TYPE_ONE = 231;
const TYPE_TWO = 230;
const TYPE_THREE = 229;
const TYPE_EMPTY_OBJ = 228;
const TYPE_EMPTY_ARR = 227;
const TYPE_OBJ_DELETE = 226;
const TYPE_STRING_DICT1 = 225;
const TYPE_STRING_DICT2 = 224;
const TYPE_ARR_DELTA = 223;
const TYPE_ARR_RESIZE = 222;
const TYPE_ARR_SETVALUE = 221;
const TYPE_ARR_NESTED = 220;
const TYPE_KEY_STATE = 219;
const TYPE_KEY_PLAYERS = 218;
const TYPE_KEY_TEAMS = 217;
const TYPE_KEY_ROOMS = 216;
const TYPE_KEY_EVENTS = 215;
// const TYPE_KEY_NEXT = 214;
// const TYPE_FOUR = 213;
// const TYPE_FIVE = 212;
// const TYPE_SIX = 211;
// const TYPE_SEVEN = 210;
// const TYPE_EIGHT = 209;
// const TYPE_NINE = 208;
// const TYPE_TEN = 207;
// const TYPE_ELEVEN = 206;
// const TYPE_TWELVE = 205;
// const TYPE_THIRTEEN = 204;
// const TYPE_KEY_STATE_EMPTY = 203;
// const TYPE_KEY_PLAYERS_EMPTY = 202;
// const TYPE_KEY_EVENTS_EMPTY = 201;
// const TYPE_KEY_TIMER_EMPTY = 200;
// const TYPE_KEY_NEXT_EMPTY = 199;
// const TYPE_KEY_TEAMS_EMPTY = 198;
// const TYPE_KEY_RULES = 197;
// const TYPE_KEY_RULES_EMPTY = 196;

var dvbuff = new ArrayBuffer(16);
var dv = new DataView(dvbuff);

var defaultDict = null;

function createDefaultDict(storedDict) {
    if (storedDict) {
        defaultDict = {
            count: storedDict.length,
            keys: {},
            order: storedDict,
        };
        createDictKeys(defaultDict);
    }

    return defaultDict;
}

function isObject(obj) {
    var type = typeof obj;
    return type === "function" || type === "object";
}

function serialize(json, dict) {
    let buffer = [];
    dict = dict || { count: defaultOrder.length, keys: {}, order: [] };

    let cache = {};

    serializeEX(json, buffer, dict, cache);

    let arrBuffer = Uint8Array.from(buffer);
    // for (var i = 0; i < buffer.length; i++) {
    //     arrBuffer[i] = buffer[i];
    // }

    return arrBuffer.buffer;
}

function serializeEX(json, buffer, dict, cache) {
    buffer = buffer || [];
    dict = dict || { count: defaultOrder.length, keys: {}, order: [] };

    if (typeof json === "undefined" || json == null) {
        buffer.push(TYPE_NULL);
        return;
    }
    let isString = typeof json === "string" || json instanceof String;

    if (json instanceof Date) {
        buffer.push(TYPE_DATE);
        let epoch = json.getTime();
        // console.log('epoch', epoch);

        setBigUint64(dv, 0, BigInt(epoch));
        // dv.setBigUint64(0, BigInt(epoch));
        buffer.push(dv.getUint8(0));
        buffer.push(dv.getUint8(1));
        buffer.push(dv.getUint8(2));
        buffer.push(dv.getUint8(3));
        buffer.push(dv.getUint8(4));
        buffer.push(dv.getUint8(5));
        buffer.push(dv.getUint8(6));
        buffer.push(dv.getUint8(7));
        return;
    }

    if (Array.isArray(json)) {
        if (json.length == 0) {
            buffer.push(TYPE_EMPTY_ARR);
            return;
        }
        buffer.push(TYPE_ARR);
        serializeArr(json, buffer, dict, cache);
        buffer.push(TYPE_ENDARR);
        return;
    }

    if (isObject(json)) {
        if (Object.keys(json).length == 0) {
            buffer.push(TYPE_EMPTY_OBJ);
            return;
        }

        let keys = Object.keys(json);
        if (keys.length <= 15) {
            buffer.push(128 | keys.length);
            serializeObj(json, buffer, dict, cache);
            return;
        }

        buffer.push(TYPE_OBJ);
        buffer.push(keys.length);
        serializeObj(json, buffer, dict, cache);
        // buffer.push(TYPE_ENDOBJ);
        return;
    }

    if (isString) {
        if (json.length == 0) {
            buffer.push(TYPE_EMPTYSTRING);
            return;
        }

        let exists = mapKey(json, buffer, dict, cache, true);
        if (exists) {
            return;
        }

        if (json in cache) {
            let pos = cache[json];
            // console.log("Found cache for:", json, "at", pos);
            if (pos <= 255) {
                buffer.push(TYPE_STRING_DICT1);
                dv.setUint8(0, pos);
                buffer.push(dv.getUint8(0));
            } else {
                buffer.push(TYPE_STRING_DICT2);
                dv.setUint16(0, pos);
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
            }

            return;
        }
        let maxLengthEncoding = 31;

        if (json.length <= maxLengthEncoding) {
            buffer.push(0xa0 | json.length); // set bits (1010 0000) to mark as a string with 5bit length
        } else {
            buffer.push(TYPE_STRING);
            let pos = buffer.length;
            cache[json] = pos;
        }

        let encoded = encoder.encode(json);
        for (let i = 0; i < encoded.byteLength; i++) {
            // console.log(json + '[' + i + ']', encoded[i]);
            buffer.push(encoded[i]);
        }

        if (json.length > maxLengthEncoding) buffer.push(0);
        return;
    }

    if (typeof json === "boolean") {
        if (json == false) {
            buffer.push(TYPE_FALSE);
            return;
        }
        buffer.push(TYPE_TRUE);
        return;
    }

    if (typeof json === "number") {
        if (Number.isInteger(json)) {
            if (json >= 0 && json <= 127) {
                buffer.push(json); // 8th bit should remain 0, to mark as an unsigned 7bit number
            } else if (json <= 0 && json >= -63) {
                buffer.push(json | 0xc0);
            }

            // if (json == 0) {
            //     buffer.push(TYPE_ZERO);
            //     return;
            // } else if (json == 1) {
            //     buffer.push(TYPE_ONE);
            //     return;
            // } else if (json == 2) {
            //     buffer.push(TYPE_TWO);
            //     return;
            // } else if (json == 3) {
            //     buffer.push(TYPE_THREE);
            //     return;
            // } else if (json == 4) {
            //     buffer.push(TYPE_FOUR);
            //     return;
            // } else if (json == 5) {
            //     buffer.push(TYPE_FIVE);
            //     return;
            // } else if (json == 6) {
            //     buffer.push(TYPE_SIX);
            //     return;
            // } else if (json == 7) {
            //     buffer.push(TYPE_SEVEN);
            //     return;
            // } else if (json == 8) {
            //     buffer.push(TYPE_EIGHT);
            //     return;
            // } else if (json == 9) {
            //     buffer.push(TYPE_NINE);
            //     return;
            // } else if (json == 10) {
            //     buffer.push(TYPE_TEN);
            //     return;
            // } else if (json == 11) {
            //     buffer.push(TYPE_ELEVEN);
            //     return;
            // } else if (json == 12) {
            //     buffer.push(TYPE_TWELVE);
            //     return;
            // } else if (json == 13) {
            //     buffer.push(TYPE_THIRTEEN);
            //     return;
            // }
            else if (json >= -128 && json < 0) {
                buffer.push(TYPE_INT8);
                dv.setInt8(0, json);
                buffer.push(dv.getUint8(0));
            } else if (json >= 0 && json <= 255) {
                buffer.push(TYPE_UINT8);
                dv.setUint8(0, json);
                buffer.push(dv.getUint8(0));
            } else if (json >= -32768 && json < 0) {
                buffer.push(TYPE_INT16);
                dv.setInt16(0, json);
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
            } else if (json >= 0 && json <= 65535) {
                buffer.push(TYPE_UINT16);
                dv.setUint16(0, json);
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
            } else if (json >= -2147483648 && json < 0) {
                buffer.push(TYPE_INT32);
                dv.setInt32(0, json);
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
                buffer.push(dv.getUint8(2));
                buffer.push(dv.getUint8(3));
            } else if (json >= 0 && json <= 4294967295) {
                buffer.push(TYPE_UINT32);
                dv.setUint32(0, json);
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
                buffer.push(dv.getUint8(2));
                buffer.push(dv.getUint8(3));
            } else if (json < -2147483648) {
                buffer.push(TYPE_INT64);

                json = -json;
                setBigUint64(dv, 0, json);
                // dv.setBigInt64(0, BigInt(json));
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
                buffer.push(dv.getUint8(2));
                buffer.push(dv.getUint8(3));
                buffer.push(dv.getUint8(4));
                buffer.push(dv.getUint8(5));
                buffer.push(dv.getUint8(6));
                buffer.push(dv.getUint8(7));
            } else if (json > 4294967295) {
                buffer.push(TYPE_UINT64);

                setBigUint64(dv, 0, json);
                // dv.setBigUint64(0, BigInt(json));
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
                buffer.push(dv.getUint8(2));
                buffer.push(dv.getUint8(3));
                buffer.push(dv.getUint8(4));
                buffer.push(dv.getUint8(5));
                buffer.push(dv.getUint8(6));
                buffer.push(dv.getUint8(7));
            }
            return;
        } else {
            // if (json >= -3.4e38 && json <= 3.4e38) {
            // buffer.push(TYPE_FLOAT32);
            // dv.setFloat32(0, json);
            // buffer.push(dv.getUint8(0));
            // buffer.push(dv.getUint8(1));
            // buffer.push(dv.getUint8(2));
            // buffer.push(dv.getUint8(3));
            // }
            // else {
            let str = "" + json;
            if (str.length < 6) {
                buffer.push(TYPE_FLOATSTR);
                let encoded = encoder.encode(json);
                for (var i = 0; i < encoded.byteLength; i++) {
                    // console.log(json + '[' + i + ']', encoded[i]);
                    buffer.push(encoded[i]);
                }
                buffer.push(0);
            } else {
                buffer.push(TYPE_FLOAT64);
                dv.setFloat64(0, json);
                buffer.push(dv.getUint8(0));
                buffer.push(dv.getUint8(1));
                buffer.push(dv.getUint8(2));
                buffer.push(dv.getUint8(3));
                buffer.push(dv.getUint8(4));
                buffer.push(dv.getUint8(5));
                buffer.push(dv.getUint8(6));
                buffer.push(dv.getUint8(7));
            }

            // }
            return;
        }
    }
}

function mapKey(key, buffer, dict, cache, skip) {
    let id = dict.count || 0;
    if (key in dict.keys) {
        id = dict.keys[key];
    } else {
        if (skip) {
            return false;
        }
        if (dict.frozen || dict.count >= 255) {
            serializeEX(key, buffer, dict, cache);
            return false;
        }

        id = dict.count;
        dict.count += 1;
        dict.keys[key] = id;
        dict.order.push(key);
    }

    buffer.push(TYPE_DICT);
    buffer.push(id);

    return true;
}

function mapDeletionKey(value, buffer, dict, cache) {
    // let skey = key.substr(1, key.length - 1);
    // if (!(skey in dict.keys)) {
    //     mapKey(key, buffer, dict, cache);
    //     return false;
    // }

    // let id = dict.keys[skey];
    // buffer.push(TYPE_DEL_DICTKEY);
    // buffer.push(id);
    if (!Array.isArray(value)) return;

    buffer.push(TYPE_OBJ_DELETE);

    for (var i = 0; i < value.length; i++) {
        serializeEX(value[i], buffer, dict, cache);
    }

    buffer.push(TYPE_ENDARR);

    return true;
}

function mapArrayDelta(arr, buffer, dict, cache) {
    if (!Array.isArray(arr)) {
        serializeEX(arr, buffer, dict, cache);
        console.error(" -- Invalid Array Delta: " + typeof arr);
        return;
    }

    for (var i = 0; i < arr.length; i++) {
        let change = arr[i];
        let index = change.index;
        let type = change.type;
        let value = change.value;

        if (type == "resize") {
            buffer.push(TYPE_ARR_RESIZE);
            buffer.push(value);
            continue;
        }

        if (type == "setvalue") {
            buffer.push(TYPE_ARR_SETVALUE);
            buffer.push(index);

            serializeEX(value, buffer, dict, cache);
            continue;
        }

        if (type == "nested") {
            buffer.push(TYPE_ARR_NESTED);
            buffer.push(index);

            mapArrayDelta(value, buffer, dict, cache);
        }
    }

    buffer.push(TYPE_ENDARR);

    return true;
}

function serializeObj(json, buffer, dict, cache) {
    for (var key in json) {
        let value = json[key];
        if (key == "$") {
            mapDeletionKey(value, buffer, dict, cache);
            continue;
        } else if (key[0] == "#") {
            let startPos = buffer.length;
            let skey = key.substring(1);
            if (!(skey in dict.keys)) {
                mapKey(skey, buffer, dict, cache);
            } else {
                let id = dict.keys[skey];
                buffer.push(TYPE_DICT);
                buffer.push(id);
            }

            if (!Array.isArray(value)) {
                serializeEX(value, buffer, dict, cache);
                let dist = buffer.length - startPos;
                continue;
            }

            buffer.push(TYPE_ARR_DELTA);
            mapArrayDelta(value, buffer, dict, cache);
            let dist = buffer.length - startPos;
            continue;
        } else {
            if (key == "state") {
                buffer.push(TYPE_KEY_STATE);
                buffer.push(Object.keys(value).length);
                serializeObj(value, buffer, dict, cache);
                // buffer.push(TYPE_ENDOBJ);
                continue;
            } else if (key == "players") {
                buffer.push(TYPE_KEY_PLAYERS);
                buffer.push(Object.keys(value).length);
                serializeObj(value, buffer, dict, cache);
                // buffer.push(TYPE_ENDOBJ);
                continue;
            } else if (key == "teams") {
                buffer.push(TYPE_KEY_TEAMS);
                buffer.push(Object.keys(value).length);
                serializeObj(value, buffer, dict, cache);
                // buffer.push(TYPE_ENDOBJ);
                continue;
            } else if (key == "room") {
                buffer.push(TYPE_KEY_ROOMS);
                buffer.push(Object.keys(value).length);
                serializeObj(value, buffer, dict, cache);
                // buffer.push(TYPE_ENDOBJ);
                continue;
            }

            let startPos = buffer.length;
            mapKey(key, buffer, dict, cache);
            serializeEX(value, buffer, dict, cache);
            let dist = buffer.length - startPos;
        }
    }
}

function serializeArr(json, buffer, dict, cache) {
    for (var i = 0; i < json.length; i++) {
        let value = json[i];
        serializeEX(value, buffer, dict, cache);
    }
}

function deserialize(buffer, pos, dict) {
    var ref = {
        buffer,
        pos,
        dict,
    };
    return deserializeEX(ref);
}

function deserializeEX(ref) {
    let json;
    let arr, i;
    let data;
    let type = ref.buffer.getUint8(ref.pos++);

    //string type of less than 31 characters
    if (type >> 5 == 5) {
        let len = type & 0x1f; //filter out the (101) left most bits
        let arr = [];
        for (let i = 0; i < len && ref.pos < ref.buffer.byteLength; i++) {
            let val = ref.buffer.getUint8(ref.pos++);
            arr.push(val);
        }
        data = new Uint8Array(arr);
        json = decoder.decode(data);
        return json;
    } else if (type >> 7 == 0) {
        json = type & 0x7f;
        return json;
    } else if (type >> 6 == 0xc0) {
        json = type & 0x3f;
        return json;
        // else if (json <= 0 && json >= -63) {
        //     buffer.push(json | 0xc0);
        // }
    } else if (type >> 4 == 8) {
        json = type & 0xf; //extract the length
        // ref.objLen = json;
        // ref.objPos = 0;
        ref.pos--;
        json = deserializeObj({}, ref);
        // ref.objLen = 0;
        // ref.objPos = 0;
        return json;
    }

    switch (type) {
        case TYPE_EMPTY_OBJ:
            json = {};
            break;
        case TYPE_EMPTY_ARR:
            json = [];
            break;
        case TYPE_DICT:
            let id = ref.buffer.getUint8(ref.pos++);
            json = ref.dict.order[id];
            break;
        case TYPE_NULL:
            json = null;
            break;
        // case TYPE_ZERO:
        //     json = 0;
        //     break;
        // case TYPE_ONE:
        //     json = 1;
        //     break;
        // case TYPE_TWO:
        //     json = 2;
        //     break;
        // case TYPE_THREE:
        //     json = 3;
        //     break;
        // case TYPE_FOUR:
        //     json = 4;
        //     break;
        // case TYPE_FIVE:
        //     json = 5;
        //     break;
        // case TYPE_SIX:
        //     json = 6;
        //     break;
        // case TYPE_SEVEN:
        //     json = 7;
        //     break;
        // case TYPE_EIGHT:
        //     json = 8;
        //     break;
        // case TYPE_NINE:
        //     json = 9;
        //     break;
        // case TYPE_TEN:
        //     json = 10;
        //     break;
        // case TYPE_ELEVEN:
        //     json = 11;
        //     break;
        // case TYPE_TWELVE:
        //     json = 12;
        //     break;
        // case TYPE_THIRTEEN:
        //     json = 13;
        //     break;

        case TYPE_OBJ:
            json = deserializeObj({}, ref);
            break;
        case TYPE_ARR_DELTA:
            let startPos = ref.pos;
            json = deserializeArrDelta([], ref);
            let dist = ref.pos - startPos;
            // console.log("ArrDelta Length: ", dist);
            break;
        case TYPE_ARR_NESTED:
            json = deserializeArrDelta([], ref);
            break;
        case TYPE_ARR:
            json = deserializeArr([], ref);
            break;
        case TYPE_EMPTYSTRING:
            json = "";
            break;
        //the string exists in the buffer already less than 255 indices away
        case TYPE_STRING_DICT1:
            arr = [];
            let position = ref.buffer.getUint8(ref.pos);
            for (; position < ref.buffer.byteLength; position++) {
                let val = ref.buffer.getUint8(position);
                if (val == 0) {
                    break;
                }
                arr.push(val);
            }
            ref.pos++; //skip null terminated
            data = new Uint8Array(arr);
            json = decoder.decode(data);
            break;
        //the string exists in the buffer already less than 65,536 indices away
        case TYPE_STRING_DICT2:
            arr = [];
            let position2 = ref.buffer.getUint16(ref.pos);
            for (; position2 < ref.buffer.byteLength; position2++) {
                let val = ref.buffer.getUint8(position2);
                if (val == 0) {
                    break;
                }
                arr.push(val);
            }
            ref.pos += 2; //skip null terminated
            data = new Uint8Array(arr);
            json = decoder.decode(data);
            break;
        case TYPE_STRING:
            arr = [];
            for (; ref.pos < ref.buffer.byteLength; ref.pos++) {
                let val = ref.buffer.getUint8(ref.pos);
                if (val == 0) {
                    break;
                }
                arr.push(val);
            }
            ref.pos++; //skip null terminated
            data = new Uint8Array(arr);
            json = decoder.decode(data);
            // console.log('string: ', json);
            break;
        case TYPE_TRUE:
            json = true;
            break;
        case TYPE_FALSE:
            json = false;
            break;
        case TYPE_DATE:
            json = getBigUint64(ref.buffer, ref.pos);
            // json = ref.buffer.getBigUint64(ref.pos);
            json = new Date(Number(json));
            ref.pos += 8;
            break;
        case TYPE_INT8:
            json = ref.buffer.getInt8(ref.pos);
            ref.pos++;
            break;
        case TYPE_UINT8:
            json = ref.buffer.getUint8(ref.pos);
            ref.pos++;
            break;
        case TYPE_INT16:
            json = ref.buffer.getInt16(ref.pos);
            ref.pos += 2;
            break;
        case TYPE_UINT16:
            json = ref.buffer.getUint16(ref.pos);
            ref.pos += 2;
            break;
        case TYPE_INT32:
            json = ref.buffer.getInt32(ref.pos);
            ref.pos += 4;
            break;
        case TYPE_UINT32:
            json = ref.buffer.getUint32(ref.pos);
            ref.pos += 4;
            break;
        case TYPE_INT64:
            json = getBigUint64(ref.buffer, ref.pos);
            json = -json;
            // json = getBigInt64(ref.buffer, ref.pos);
            // json = ref.buffer.getBigInt64(ref.pos);
            json = Number(json);
            ref.pos += 8;
            break;
        case TYPE_UINT64:
            json = getBigUint64(ref.buffer, ref.pos);
            // json = ref.buffer.getBigUint64(ref.pos);
            json = Number(json);
            ref.pos += 8;
            break;
        // case TYPE_FLOAT32:
        //     json = ref.buffer.getFloat32(ref.pos);
        //     ref.pos += 4;
        //     break;
        case TYPE_FLOATSTR:
            arr = [];
            for (; ref.pos < ref.buffer.byteLength; ref.pos++) {
                let val = ref.buffer.getUint8(ref.pos);
                if (val == 0) {
                    break;
                }
                arr.push(val);
            }
            ref.pos++; //skip null terminated
            data = new Uint8Array(arr);
            json = decoder.decode(data);
            json = parseFloat(json);
            break;
        case TYPE_FLOAT64:
            json = ref.buffer.getFloat64(ref.pos);
            ref.pos += 8;
            break;
    }

    return json;
}

function deserializeObj(json, ref) {
    json = json || {};

    let objLen = ref.buffer.getUint8(ref.pos++);

    if (objLen >> 4 == 8) {
        objLen = objLen & 0xf;
    }
    // if (type == TYPE_ENDOBJ) {
    //     return json;
    // }

    // if (ref.objPos >= ref.objLen) {
    //     return json;
    // }

    // ref.objPos++;
    // if (
    //     type != TYPE_DICT &&
    //     type != TYPE_STRING &&
    //     type != TYPE_OBJ_DELETE &&
    //     type != TYPE_STRING_DICT1 &&
    //     type != TYPE_STRING_DICT2
    // ) {
    //     throw "E_INVALIDOBJ";
    // }

    for (let x = 0; x < objLen; x++) {
        let type = ref.buffer.getUint8(ref.pos++);

        if (type == TYPE_KEY_STATE) {
            json["state"] = deserializeObj({}, ref);
            continue;
        } else if (type == TYPE_KEY_PLAYERS) {
            json["players"] = deserializeObj({}, ref);
            continue;
        } else if (type == TYPE_KEY_TEAMS) {
            json["teams"] = deserializeObj({}, ref);
            continue;
        } else if (type == TYPE_KEY_ROOMS) {
            json["rooms"] = deserializeObj({}, ref);
            continue;
        } else if (type == TYPE_KEY_EVENTS) {
            json["events"] = deserializeObj({}, ref);
            continue;
        }

        if (type == TYPE_OBJ_DELETE) {
            json["$"] = deserializeArr([], ref);
            continue;
        }

        if (type == TYPE_DICT) {
            let id = ref.buffer.getUint8(ref.pos++);
            let key = ref.dict.order[id];

            let isArrDelta = ref.buffer.getUint8(ref.pos) == TYPE_ARR_DELTA;
            let value = deserializeEX(ref);

            if (isArrDelta) {
                key = "#" + key;
            }

            json[key] = value;

            continue;
        }

        //strings greater than 31 bytes or in cache
        if (
            type == TYPE_STRING ||
            type == TYPE_STRING_DICT1 ||
            type == TYPE_STRING_DICT2
        ) {
            ref.pos--;
            let key = deserializeEX(ref);
            let isArrDelta = ref.buffer.getUint8(ref.pos) == TYPE_ARR_DELTA;
            let value = deserializeEX(ref);

            if (isArrDelta) {
                key = "#" + key;
            }

            json[key] = value;
            continue;
        }

        //strings less than 31 bytes
        if (type >> 5 == 5) {
            let len = type & 0x1f; //filter out the (101) left most bits
            let arr = [];
            for (let i = 0; i < len && ref.pos < ref.buffer.byteLength; i++) {
                let val = ref.buffer.getUint8(ref.pos++);
                arr.push(val);
            }
            data = new Uint8Array(arr);
            let key = decoder.decode(data);

            let isArrDelta = ref.buffer.getUint8(ref.pos) == TYPE_ARR_DELTA;
            let value = deserializeEX(ref);

            if (isArrDelta) {
                key = "#" + key;
            }
            json[key] = value;
            continue;
        }
    }

    return json;
    // throw "E_INVALIDOBJ";
}

function deserializeArrDelta(json, ref) {
    json = json || [];

    if (ref.pos >= ref.buffer.byteLength) {
        throw "E_INDEXOUTOFBOUNDS";
    }

    let type = ref.buffer.getUint8(ref.pos++);
    let index;
    let value;
    switch (type) {
        case TYPE_ENDARR:
            return json;
            break;
        case TYPE_ARR_RESIZE:
            value = ref.buffer.getUint8(ref.pos++);
            json.push({ value, type: "resize" });
            break;
        case TYPE_ARR_SETVALUE:
            index = ref.buffer.getUint8(ref.pos++);
            value = deserializeEX(ref);
            json.push({ index, type: "setvalue", value });
            break;
        case TYPE_ARR_NESTED:
            index = ref.buffer.getUint8(ref.pos++);
            value = deserializeArrDelta([], ref);
            json.push({ index, type: "nested", value });
            break;
        default:
            break;
    }

    let result = deserializeArrDelta(json, ref);
    return result;
}

function deserializeArr(json, ref) {
    json = json || [];

    if (ref.pos >= ref.buffer.byteLength) {
        throw "E_INDEXOUTOFBOUNDS";
    }

    let type = ref.buffer.getUint8(ref.pos++);
    if (type == TYPE_ENDARR) {
        return json;
    }
    ref.pos--; //move cursor back to get next value

    let value = deserializeEX(ref);
    json.push(value);

    return deserializeArr(json, ref);
}

function encode(json, storedDict) {
    try {
        // console.log("ENCODING: ", JSON.stringify(json, null, 2));
        let dict = createDefaultDict(storedDict);
        dict.frozen = true;
        // console.time('serialize');
        let encoded = serialize(json, dict);
        // console.timeEnd('serialize');
        //console.log('Encoded Size: ', encoded.byteLength, json)
        // let jsonStr = JSON.stringify(json);
        // let buffer = encoder.encode(jsonStr);
        // let deflated = pako.deflate(encoded);
        //console.log("encode json len: " + buffer.length);
        //console.log("encode byte len: ", deflated.length);
        return encoded;
    } catch (e) {
        console.error(e);
    }
    return null;
}

function decode(raw, storedDict) {
    try {
        let dict = createDefaultDict(storedDict);
        dict.frozen = true;
        let abuff = ArrayBuffer.isView(raw) ? raw : raw.buffer;
        var dataview;

        try {
            dataview = new DataView(raw);
        } catch (e) {
            var buf = new Uint8Array(raw).buffer;
            dataview = new DataView(buf);
        }
        // console.time('deserialize');
        let decoded = deserialize(dataview, 0, dict);
        // console.timeEnd('deserialize');
        // let inflated = pako.inflate(raw);
        // let jsonStr = decoder.decode(inflated);
        // let json = JSON.parse(jsonStr);
        //console.log("decode byte len: ", raw.byteLength);
        //console.log("decode json len: " + inflated.length);
        return decoded;
    } catch (e) {
        console.error(e);
        try {
            let jsonStr = raw.toString();
            let json = JSON.parse(jsonStr);
            return json;
        } catch (e) {
            console.error(e);
        }
    }
    return null;
}

function createDictKeys(dict) {
    for (var i = 0; i < dict.order.length; i++) {
        let key = dict.order[i];
        dict.keys[key] = i;
    }
}

module.exports = { encode, decode, serialize, deserialize, createDefaultDict };
