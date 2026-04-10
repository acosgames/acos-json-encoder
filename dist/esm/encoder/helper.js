const _dvBuf = new ArrayBuffer(8);
const _dv = new DataView(_dvBuf);
const _textEncoder = new TextEncoder();
const _textDecoder = new TextDecoder();
export function writeLEB128(buffer, value) {
    // Supports 0 … 2^53 (JS safe-integer range)
    if (value < 0)
        value = 0;
    do {
        let byte = value & 0x7F;
        value = Math.floor(value / 128);
        if (value !== 0)
            byte |= 0x80;
        buffer.push(byte);
    } while (value !== 0);
}
export function writeSLEB128(buffer, value) {
    // Supports 32-bit signed integers (sufficient for game state).
    value |= 0; // clamp to int32
    let more = true;
    while (more) {
        let byte = value & 0x7F;
        value >>= 7; // arithmetic right-shift
        if ((value === 0 && !(byte & 0x40)) || (value === -1 && (byte & 0x40))) {
            more = false;
        }
        else {
            byte |= 0x80;
        }
        buffer.push(byte);
    }
}
export function readLEB128(ref) {
    let value = 0;
    let shift = 0;
    while (true) {
        const byte = ref.view.getUint8(ref.pos++);
        value += (byte & 0x7F) * Math.pow(2, shift);
        shift += 7;
        if (!(byte & 0x80))
            break;
    }
    return value;
}
export function readSLEB128(ref) {
    let value = 0;
    let shift = 0;
    let byte;
    do {
        byte = ref.view.getUint8(ref.pos++);
        value += (byte & 0x7F) * Math.pow(2, shift);
        shift += 7;
    } while (byte & 0x80);
    if (shift < 53 && (byte & 0x40))
        value -= Math.pow(2, shift);
    return value;
}
export function encodeFloat64(value, buffer) {
    _dv.setFloat64(0, value, true);
    for (let i = 0; i < 8; i++) {
        buffer.push(_dv.getUint8(i));
    }
}
export function decodeFloat64(ref) {
    for (let i = 0; i < 8; i++) {
        _dv.setUint8(i, ref.view.getUint8(ref.pos++));
    }
    return _dv.getFloat64(0, true);
}
export function encodeString(value, buffer, dictionary, cache = {}) {
    if (value === '') {
        buffer.push(0x00);
        return;
    }
    // Cache back-reference: point to where we previously encoded this string.
    // Marker 0xFF 0x00 is safe — the existing dict encoding never emits 0xFF for
    // indices 0–126 (those use the compact 0x80|idx form).
    if (value in cache) {
        buffer.push(0xFF, 0x00);
        writeLEB128(buffer, cache[value]);
        return;
    }
    // Dictionary lookup — dict strings are already 1–2 bytes, no need to cache.
    if (dictionary && dictionary.count > 0) {
        const idx = dictionary.keys[value];
        if (idx !== undefined) {
            if (idx <= 126) {
                buffer.push(0x80 | idx); // single byte 0x80–0xFE
            }
            else {
                buffer.push(0xFF); // extended dict marker
                buffer.push(idx); // uint8 index (127–254)
            }
            return;
        }
    }
    // Raw string — record start position, then encode.
    const startPos = buffer.length;
    const bytes = _textEncoder.encode(value);
    if (bytes.length <= 0x7E) {
        buffer.push(bytes.length); // 0x01–0x7E
    }
    else {
        buffer.push(0x7F); // escape: explicit LEB128 length follows
        writeLEB128(buffer, bytes.length);
    }
    for (const b of bytes)
        buffer.push(b);
    cache[value] = startPos;
}
export function decodeString(ref) {
    const first = ref.view.getUint8(ref.pos++);
    if (first === 0x00)
        return '';
    if (first >= 0x80) {
        if (first === 0xFF) {
            const second = ref.view.getUint8(ref.pos++);
            if (second === 0x00) {
                // Cache back-reference: seek to the original encoding and re-decode.
                const backPos = readLEB128(ref);
                const savedPos = ref.pos;
                ref.pos = backPos;
                const str = decodeString(ref);
                ref.pos = savedPos;
                return str;
            }
            // Dict index 127–254: second byte is the raw index.
            if (!ref.dictionary || second >= ref.dictionary.count) {
                throw new RangeError(`[helper] Dict index ${second} out of range (dict size: ${ref.dictionary?.count ?? 0})`);
            }
            return ref.dictionary.order[second];
        }
        // Dict index 0–126: compact form.
        const idx = first - 0x80;
        if (!ref.dictionary || idx >= ref.dictionary.count) {
            throw new RangeError(`[helper] Dict index ${idx} out of range (dict size: ${ref.dictionary?.count ?? 0})`);
        }
        return ref.dictionary.order[idx];
    }
    // Raw string
    const len = first === 0x7F ? readLEB128(ref) : first; // 0x01–0x7E = literal length
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++)
        arr[i] = ref.view.getUint8(ref.pos++);
    return _textDecoder.decode(arr);
}
export function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}
export function areEqual(a, b) {
    if (a === b)
        return true;
    if (a === null || b === null)
        return a === b;
    if (typeof a !== typeof b)
        return false;
    if (typeof a !== 'object')
        return a === b;
    const isArrA = Array.isArray(a);
    const isArrB = Array.isArray(b);
    if (isArrA !== isArrB)
        return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length)
        return false;
    for (const k of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, k))
            return false;
        if (!areEqual(a[k], b[k]))
            return false;
    }
    return true;
}
//# sourceMappingURL=helper.js.map