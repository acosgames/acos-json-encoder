/**
 * Full test suite for acos-json-encoder
 * Covers: encoder, protocol (schema types, extensions, enum, $slot, extras), delta, hidden/unhidden
 */

import {
    encode, decode, createDefaultDict,
    registerProtocol, registerExtension, applyExtension, disableExtension,
    protoEncode as _protoEncodeRaw, protoDecode,
    setDefaultDictionary, getProtocolSchema,
    delta, merge, hidden, unhidden,
} from "./index";
import { areEqual } from "./encoder/helper";

// ─── ANSI colors ──────────────────────────────────────────────────────────────

const C = {
    reset:  '\x1b[0m',
    green:  '\x1b[32m',
    red:    '\x1b[31m',
    yellow: '\x1b[33m',
    cyan:   '\x1b[36m',
    gray:   '\x1b[90m',
    bold:   '\x1b[1m',
};
const c = (color: string, s: string) => `${color}${s}${C.reset}`;
// ─── Byte-savings tracker ────────────────────────────────────────────────────

let _encodeStats = '';
function protoEncode(msg: any): ArrayBuffer {
    const enc = _protoEncodeRaw(msg);
    const jsonLen = JSON.stringify(msg).length;
    const pct = jsonLen > 0 ? Math.round((1 - enc.byteLength / jsonLen) * 100) : 0;
    const savings = pct >= 0 ? c(C.green, pct + '% smaller') : c(C.red, Math.abs(pct) + '% larger');
    _encodeStats = `${c(C.yellow, enc.byteLength + 'B')} wire  ${c(C.gray, jsonLen + 'B')} JSON  ${savings}`;
    return enc;
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
    _encodeStats = '';
    try {
        fn();
        const stats = _encodeStats ? `  ${c(C.gray, '[' + _encodeStats + ']')}` : '';
        console.log(`  ${c(C.green, '✓')} ${name}${stats}`);
        passed++;
    } catch (e: any) {
        console.error(`  ${c(C.red, '✗')} ${c(C.red, name)}`);
        console.error(c(C.gray, `    ${e?.message ?? e}`));
        failed++;
    }
}

function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(a: any, b: any, label = ''): void {
    const ok = areEqual(a, b);
    if (!ok) {
        throw new Error(`${label ? label + ': ' : ''}Expected\n    ${JSON.stringify(a)}\n  to equal\n    ${JSON.stringify(b)}`);
    }
}

function roundtrip(label: string, encode: () => ArrayBuffer, decode: (b: ArrayBuffer) => any, original: any): void {
    const bytes = encode();
    const decoded = decode(bytes);
    assertEqual(decoded, original, label);
}

// ─── Section: Generic Encoder ─────────────────────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Generic Encoder ──${C.reset}`);

test('uint 0', () => {
    const v = 0;
    const encoded = encode(v);
    const decoded = decode(encoded);
    assertEqual(decoded, v);
});

test('uint small positive', () => {
    const v = 42;
    assertEqual(decode(encode(v)), v);
});

test('negative integer', () => {
    const v = -25;
    assertEqual(decode(encode(v)), v);
});

test('large integer', () => {
    const v = 1234567890;
    assertEqual(decode(encode(v)), v);
});

test('float', () => {
    const v = 3.14159;
    assertEqual(decode(encode(v)), v);
});

test('empty string', () => {
    assertEqual(decode(encode('')), '');
});

test('short string', () => {
    assertEqual(decode(encode('hello')), 'hello');
});

test('long string (>31 chars)', () => {
    const s = 'abcdefghijklmnopqrstuvwxyz012345';
    assertEqual(decode(encode(s)), s);
});

test('boolean true/false', () => {
    assertEqual(decode(encode(true)), true);
    assertEqual(decode(encode(false)), false);
});

test('null', () => {
    assertEqual(decode(encode(null)), null);
});

test('empty object', () => {
    assertEqual(decode(encode({})), {});
});

test('empty array', () => {
    assertEqual(decode(encode([])), []);
});

test('small object', () => {
    const v = { a: 1, b: 'hello', c: true };
    assertEqual(decode(encode(v)), v);
});

test('nested object', () => {
    const v = { x: { y: { z: 99 } } };
    assertEqual(decode(encode(v)), v);
});

test('array of primitives', () => {
    const v = [1, 2, 3, 4, 5];
    assertEqual(decode(encode(v)), v);
});

test('array of objects', () => {
    const v = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
    assertEqual(decode(encode(v)), v);
});

test('object with array', () => {
    const v = { items: [10, 20, 30], name: 'list' };
    assertEqual(decode(encode(v)), v);
});

test('all-same array (allocate encoding)', () => {
    const v = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    assertEqual(decode(encode(v)), v);
});

test('dictionary compression', () => {
    const dict = ['name', 'score', 'rank'];
    const v = { name: 'Alice', score: 100, rank: 1 };
    const enc = encode(v, dict);
    const dec = decode(enc, dict);
    assertEqual(dec, v);
});

// ─── Section: Protocol — primitive schema types ───────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Protocol: primitive types ──${C.reset}`);

// Reset registry state for each section by using unique type names.
const DICT = ['id', 'name', 'score', 'value', 'type', 'payload', 'status', 'cells'];
setDefaultDictionary(DICT);

registerProtocol({
    type: 'p_primitives',
    payload: {
        u: 'uint',
        i: 'int',
        f: 'float',
        s: 'string',
        b: 'boolean',
    }
}, DICT);

test('uint field', () => {
    const msg = { type: 'p_primitives', payload: { u: 255 } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('int field (negative)', () => {
    const msg = { type: 'p_primitives', payload: { i: -1024 } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('float field', () => {
    const msg = { type: 'p_primitives', payload: { f: 2.718281828 } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('string field', () => {
    const msg = { type: 'p_primitives', payload: { s: 'hello world' } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('boolean field true', () => {
    const msg = { type: 'p_primitives', payload: { b: true } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('boolean field false', () => {
    const msg = { type: 'p_primitives', payload: { b: false } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('multiple primitive fields together', () => {
    const msg = { type: 'p_primitives', payload: { u: 7, i: -3, f: 1.5, s: 'hi', b: true } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('omitted optional fields round-trip', () => {
    const msg = { type: 'p_primitives', payload: { u: 99 } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

// ─── Section: Protocol — object (plain record) ─────────────────────────────────────────────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Protocol: object (plain record) ──${C.reset}`);

registerProtocol({
    type: 'p_object',
    payload: {
        meta: {
            title: 'string',
            count: 'uint',
        }
    }
}, DICT);

test('object field present', () => {
    const msg = { type: 'p_object', payload: { meta: { title: 'test', count: 5 } } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('object field absent (payload has schema field as undefined)', () => {
    // When meta is entirely absent, the field bit is 0 and no bytes are written.
    // The bitflag byte is still written (value 0), so the decoder can advance past it.
    const msg = { type: 'p_object', payload: { meta: { title: 'only one field' } } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('object partial fill', () => {
    const msg = { type: 'p_object', payload: { meta: { count: 3 } } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

// ─── Section: Protocol — $array ───────────────────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Protocol: $array ──${C.reset}`);

registerProtocol({
    type: 'p_array',
    payload: {
        events: {
            $array: { type: 'uint', data: 'string' }
        }
    }
}, DICT);

test('empty $array', () => {
    const msg = { type: 'p_array', payload: { events: [] } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('$array with items', () => {
    const msg = { type: 'p_array', payload: { events: [{ type: 1, data: 'join' }, { type: 2, data: 'move' }] } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('$array delta ops (flexible mode)', () => {
    const msg = {
        type: 'p_array',
        payload: {
            events: [
                { op: 'set', index: 0, value: { type: 3, data: 'shoot' } },
                { op: 'resize', value: 1 },
            ]
        }
    };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

// ─── Section: Protocol — $static ─────────────────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Protocol: $static ──${C.reset}`);

registerProtocol({
    type: 'p_static',
    payload: {
        cells: { $static: 'string' },
        players: {
            $static: { id: 'uint', name: 'string', score: 'uint' }
        }
    }
}, DICT);

test('$static refresh (mode 4)', () => {
    const msg = {
        type: 'p_static',
        payload: {
            cells: ['X', '', 'O', '', 'X', '', 'O', '', ''],
            players: [{ id: 1, name: 'Alice', score: 10 }, { id: 2, name: 'Bob', score: 7 }]
        }
    };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('$static set ops (mode 2)', () => {
    const msg = {
        type: 'p_static',
        payload: {
            cells: [{ op: 'set', index: 0, value: 'X' }, { op: 'set', index: 4, value: 'O' }],
            players: []
        }
    };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('$static fill op (mode 3)', () => {
    const msg = {
        type: 'p_static',
        payload: {
            cells: [{ op: 'fill', index: 0, count: 9, value: '' }],
            players: []
        }
    };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

// ─── Section: Protocol — $map ─────────────────────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Protocol: $map ──${C.reset}`);

registerProtocol({
    type: 'p_map',
    payload: {
        scores: { $map: {} },
        attrs:  { $map: { value: 'uint' } }
    }
}, DICT);

test('$map empty', () => {
    const msg = { type: 'p_map', payload: { scores: {}, attrs: {} } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('$map with typed value schema', () => {
    // attrs: { $map: { value: 'uint' } } — each map value is a typed object
    const msg = { type: 'p_map', payload: { scores: {}, attrs: { alice: { value: 100 }, bob: { value: 85 } } } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

// ─── Section: Protocol — $enum ───────────────────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Protocol: $enum ──${C.reset}`);

registerProtocol({
    type: 'p_enum',
    payload: {
        status: { $enum: ['waiting', 'active', 'finished'] },
        mark:   { $enum: ['', 'X', 'O'] },
        code:   { $enum: [0, 1, 2, 3, 4] },
        board:  { $static: { $enum: ['', 'X', 'O'] } }
    }
}, DICT);

test('$enum string value', () => {
    const msg = { type: 'p_enum', payload: { status: 'active' } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('$enum all string values', () => {
    for (const v of ['waiting', 'active', 'finished']) {
        const msg = { type: 'p_enum', payload: { status: v } };
        assertEqual(protoDecode(protoEncode(msg)), msg);
    }
});

test('$enum number value', () => {
    const msg = { type: 'p_enum', payload: { code: 3 } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('$enum unknown value → undefined on decode', () => {
    const msg = { type: 'p_enum', payload: { status: 'unknown' as any } };
    const decoded = protoDecode(protoEncode(msg));
    assert(decoded.payload.status === undefined, 'unknown enum should decode as undefined');
});

test('$static of $enum', () => {
    const msg = { type: 'p_enum', payload: { board: ['X', '', 'O', 'X', 'X', 'O', 'O', '', ''] } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

// ─── Section: Protocol — $custom ─────────────────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Protocol: $slot ──${C.reset}`);

registerProtocol({
    type: 'p_custom',
    payload: {
        fixed: 'uint',
        state: { $slot: 'any' },
        meta:  {
            title: 'string',
            extra: { $slot: 'any' }
        }
    }
}, DICT);

test('$slot default (any) encodes generically', () => {
    const msg = { type: 'p_custom', payload: { fixed: 5, state: { foo: 'bar', n: 42 } } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('$slot in nested object', () => {
    const msg = { type: 'p_custom', payload: { meta: { title: 'T', extra: { x: 1 } } } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

// ─── Section: Extensions ─────────────────────────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Protocol: Extensions ──${C.reset}`);

registerProtocol({
    type: 'p_ext',
    payload: {
        seq: 'uint',
        fixed: { id: 'uint', name: 'string' },
        state: { $slot: 'any' },
        eventType: { $enum: ['join', 'gameover'] },
        players: {
            $static: {
                id: 'uint',
                score: 'uint',
                attr: { $slot: 'any' }
            }
        }
    }
}, DICT);

registerExtension('p_ext', 'chess', {
    state: { cells: { $static: { $enum: ['', 'X', 'O'] } } },
    newkey: 'uint',
    eventType: { $enum: ['pick', 'checkmate'] },
    players: { attr: { level: 'uint', tag: 'string' } }
});

registerExtension('p_ext', 'poker', {
    state: { deck: { $static: 'string' } },
    newkey: 'uint',
    eventType: { $enum: ['bet', 'fold', 'allin'] }
});

applyExtension('p_ext', 'chess');

test('extension: $slot state encodes/decodes', () => {
    const msg = {
        type: 'p_ext',
        payload: {
            state: { cells: ['X', 'O', 'X', 'O', 'X', '', 'O', '', ''] },
        }
    };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('extension: new key added', () => {
    const msg = { type: 'p_ext', payload: { seq: 1, newkey: 99 } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('extension: nested $slot in $static extended', () => {
    const msg = {
        type: 'p_ext',
        payload: {
            players: [
                { id: 1, score: 100, attr: { level: 5, tag: 'pro' } },
                { id: 2, score: 80,  attr: { level: 3, tag: 'mid' } },
            ]
        }
    };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('extension: fixed field NOT overridden', () => {
    // fixed is a concrete field, not $slot — extendNode skips it silently
    const msg = { type: 'p_ext', payload: { fixed: { id: 7, name: 'Alice' } } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('extension: schema reflects active extension', () => {
    const schema = getProtocolSchema('p_ext');
    assert(schema.newkey === 'uint', 'newkey should appear in schema');
    assert(schema.players.$static.attr.level === 'uint', 'players.attr.level should be uint');
    assert(Array.isArray(schema.eventType.$enum), 'eventType.$enum should be an array');
    assert(schema.eventType.$enum[0] === 'join', 'base enum values preserved');
    assert(schema.eventType.$enum[2] === 'pick', 'extension enum values appended');
});

test('extension: $enum base values encode/decode', () => {
    const msg = { type: 'p_ext', payload: { eventType: 'join' } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('extension: $enum extended values encode/decode', () => {
    const msg = { type: 'p_ext', payload: { eventType: 'pick' } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('extension: $enum extended values encode/decode 2', () => {
    const msg = { type: 'p_ext', payload: { eventType: 'checkmate' } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

applyExtension('p_ext', 'poker');

test('extension: switch to poker extension', () => {
    const msg = { type: 'p_ext', payload: { newkey: 42, state: { deck: ['Ace', 'King'] } } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('extension: switching removes previous extension fields', () => {
    // chess added players.attr.level; after switching to poker it should be gone
    const schema = getProtocolSchema('p_ext');
    assert(schema.players.$static.attr === 'any', 'players.attr should be $slot/any after switching away from chess');
    // chess added pick/checkmate; poker replaces with bet/fold/allin
    assert(schema.eventType.$enum.includes('bet'), 'poker enum values present');
    assert(!schema.eventType.$enum.includes('pick'), 'chess enum values absent after switch');
    assert(schema.eventType.$enum[0] === 'join', 'base enum values still present');
});

disableExtension('p_ext');

test('extension: disable reverts to base schema', () => {
    // state is $slot/'any' again — any object should round-trip via generic encoder
    const msg = { type: 'p_ext', payload: { seq: 2, state: { anything: 42 } } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('extension: schema after disable shows $slot default', () => {
    const schema = getProtocolSchema('p_ext');
    assert(schema.state === 'any', 'state should be any after disable');
    assert(schema.newkey === undefined, 'newkey should be gone after disable');
});

applyExtension('p_ext', 'chess');
test('extension: re-apply after disable works', () => {
    const msg = { type: 'p_ext', payload: { state: { cells: ['X', '', 'O'] } } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});
disableExtension('p_ext');

// ─── Section: extras (non-schema keys) ────────────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Protocol: extras (non-schema keys) ──${C.reset}`);

registerProtocol({
    type: 'p_extras',
    payload: { id: 'uint', name: 'string' }
}, DICT);

test('extra keys round-trip', () => {
    const msg = { type: 'p_extras', payload: { id: 1, name: 'Alice', extra1: 'hello', extra2: 99 } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('only extras present', () => {
    const msg = { type: 'p_extras', payload: { id: 5, foo: 'bar' } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

// ─── Section: fallback / unregistered protocol ────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Protocol: fallback encoding ──${C.reset}`);

test('unregistered type uses generic encoder', () => {
    const msg = { type: 'unknown_type', payload: { x: 1, y: 'hello' } };
    // setDefaultDictionary was called at the top of Protocol section
    const decoded = protoDecode(protoEncode(msg));
    // fallback re-encodes the whole { type, payload } object
    assert(decoded !== null && decoded !== undefined, 'decoded should not be null');
});

registerProtocol({ type: 'p_fallback_known', payload: { id: 'uint' } }, DICT);

test('registered protocol after fallback still works', () => {
    const msg = { type: 'p_fallback_known', payload: { id: 42 } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

// ─── Section: large numeric range ─────────────────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Protocol: large numeric ranges ──${C.reset}`);

registerProtocol({
    type: 'p_numbers',
    payload: {
        big_uint: 'uint',
        neg_int:  'int',
        ts:       'uint',
    }
}, DICT);

test('large uint (timestamp-sized)', () => {
    const msg = { type: 'p_numbers', payload: { big_uint: 0, ts: 1716346342382 } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('negative int field', () => {
    const msg = { type: 'p_numbers', payload: { neg_int: -99999 } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('zero values for all numeric types', () => {
    const msg = { type: 'p_numbers', payload: { big_uint: 0, neg_int: 0, ts: 0 } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

// ─── Section: Delta ───────────────────────────────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Delta ──${C.reset}`);

test('array delta: no change', () => {
    const a = [1, 2, 3];
    const d = delta(a, a);
    assert(d === undefined, 'identical arrays should produce undefined delta');
});

test('array delta: set single element', () => {
    const from = ['', '', ''];
    const to   = ['X', '', ''];
    const d = delta(from, to);
    const result = merge(from, d);
    assertEqual(result, to);
});

test('array delta: fill run', () => {
    const from = undefined;//['', '', '', '', '', '', '', '', ''];
    const to   = ['X', 'X', 'X', '', '', '', '', '', ''];
    const d = delta(from, to);
    console.log('Delta for fill run:', JSON.stringify(d));
    const result = merge(from, d);
    assertEqual(result, to);
});

test('array delta: resize shorter', () => {
    const from = [1, 2, 3, 4, 5];
    const to   = [1, 2, 3];
    const d = delta(from, to);
    const result = merge(from, d);
    assertEqual(result, to);
});

test('array delta: resize longer (append)', () => {
    const from = [1, 2];
    const to   = [1, 2, 3, 4];
    const d = delta(from, to);
    const result = merge(from, d);
    assertEqual(result, to);
});

test('array delta: setrange', () => {
    const from = [0, 0, 0, 0, 0];
    const to   = [0, 1, 2, 0, 0];
    const d = delta(from, to);
    const result = merge(from, d);
    assertEqual(result, to);
});

test('array delta: patch nested object', () => {
    const from = [{ score: 10 }, { score: 20 }];
    const to   = [{ score: 10 }, { score: 25 }];
    const d = delta(from, to);
    const result = merge(from, d);
    assertEqual(result, to);
});

test('object delta: no change', () => {
    const a = { x: 1, y: 2 };
    const d = delta(a, a);
    assert(d === undefined, 'identical objects should produce undefined delta');
});

test('object delta: changed key', () => {
    const from = { score: 10, name: 'Alice' };
    const to   = { score: 15, name: 'Alice' };
    const d = delta(from, to);
    const result = merge(from, d);
    assertEqual(result, to);
});

test('object delta: deleted key', () => {
    const from: any = { a: 1, b: 2 };
    const to: any   = { a: 1 };
    const d = delta(from, to);
    const result = merge(from, d);
    assertEqual(result, to);
});

test('object delta: nested array changes round-trip', () => {
    const from = { items: [1, 2, 3] };
    const to   = { items: [1, 2, 3, 4] };
    const d = delta(from, to);
    assert(d !== undefined && Array.isArray(d['items']), 'array delta stored under original key');
    assert(d['items'][0]?.op !== undefined, 'array delta entries have op key');
    const result = merge(from, d);
    assertEqual(result, to);
});

test('object delta: new array key uses array ops', () => {
    const from: any = { score: 5 };
    const to: any   = { score: 5, cells: ['X', 'X', 'X', 'O', 'O'] };
    const d = delta(from, to);
    assert(Array.isArray(d['cells']), 'cells delta should be an array');
    assert(d['cells'][0]?.op !== undefined, 'cells delta should contain ops');
    const result = merge(from, d);
    assertEqual(result, to);
});

test('object delta: new array key with fill op creates key on merge', () => {
    const from: any = {
    "room": {
        "_teams": {
            "team_o": 0,
            "team_x": 1
        },
        "_players": {
            "6LFHTF": 0,
            "8Q88GH": 1
        },
        "next_id": null,
        "starttime": 1775854350372,
        "_sequence": 2,
        "updated": 16815,
        "timeend": null,
        "timesec": null,
        "status": 2,
        "isreplay": true
    },
    "state": {},
    "events": [],
    "teams": [
        {
            "team_slug": "team_o",
            "name": "Team O",
            "color": "#1187fd",
            "order": 0,
            "players": [
                0
            ],
            "rank": 2,
            "score": 0
        },
        {
            "team_slug": "team_x",
            "name": "Team X",
            "color": "#dd7575",
            "order": 1,
            "players": [
                1
            ],
            "rank": 2,
            "score": 0
        }
    ],
    "players": [
        {
            "id": 0,
            "shortid": "6LFHTF",
            "displayname": "Player_0",
            "portraitid": 1155,
            "teamid": 0,
            "rank": 2,
            "score": 0
        },
        {
            "id": 1,
            "shortid": "8Q88GH",
            "displayname": "Player_1",
            "portraitid": 1973,
            "teamid": 1,
            "rank": 2,
            "score": 0
        }
    ],
    "action": {
        "type": "join",
        "user": {
            "shortid": "8Q88GH",
            "displayname": "Player_1",
            "clientid": "6LFHTF",
            "id": 1,
            "teamid": 1,
            "timeseq": 1,
            "timeleft": 0
        }
    }
};
    const to: any   = {
    "room": {
        "_teams": {
            "team_o": 0,
            "team_x": 1
        },
        "_players": {
            "6LFHTF": 0,
            "8Q88GH": 1
        },
        "next_id": null,
        "starttime": 1775854350372,
        "_sequence": 3,
        "updated": 16815,
        "timeend": 17234,
        "timesec": 15,
        "events": [
            {
                "type": "newround",
                "payload": true
            }
        ],
        "status": 4,
        "next_player": 1,
        "next_action": "pick",
        "isreplay": true
    },
    "state": {
        "cells": [
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
        ]
    },
    "events": [],
    "teams": [
        {
            "team_slug": "team_o",
            "name": "Team O",
            "color": "#1187fd",
            "order": 0,
            "players": [
                0
            ],
            "rank": 2,
            "score": 0
        },
        {
            "team_slug": "team_x",
            "name": "Team X",
            "color": "#dd7575",
            "order": 1,
            "players": [
                1
            ],
            "rank": 2,
            "score": 0
        }
    ],
    "players": [
        {
            "id": 0,
            "shortid": "6LFHTF",
            "displayname": "Player_0",
            "portraitid": 1155,
            "teamid": 0,
            "rank": 2,
            "score": 0
        },
        {
            "id": 1,
            "shortid": "8Q88GH",
            "displayname": "Player_1",
            "portraitid": 1973,
            "teamid": 1,
            "rank": 2,
            "score": 0
        }
    ],
    "action": {
        "type": "gamestart",
        "user": {
            "shortid": "6LFHTF",
            "displayname": "Player_0",
            "id": 0,
            "timeseq": 2,
            "timeleft": 0
        }
    },
    "timeend": null
};
    const d = delta(from, to);
    console.log('Delta for new array key with fill op:', JSON.stringify(d));
    assert(d['state']['cells'][0]?.op === 'fill', 'all-same array should produce fill op');
    const result = merge(from, d);
    assertEqual(result, to);
});

test('merge primitive replacement', () => {
    assert(merge(5, 10) === 10, 'should replace primitive');
});

// ─── Section: hidden / unhidden ───────────────────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Hidden / Unhidden ──${C.reset}`);

test('hidden extracts _-prefixed key', () => {
    const state: any = { id: 1, _secret: 'abc' };
    const priv = hidden(state);
    assert(state._secret === undefined, '_secret should be removed from state');
    assert(priv._secret === 'abc', '_secret should appear in priv');
    assert(state.id === 1, 'id should remain');
});

test('hidden extracts nested _-prefixed key', () => {
    const state: any = { room: { seq: 1, _key: 'x' } };
    const priv = hidden(state);
    assert((state.room as any)._key === undefined, 'nested _key removed');
    assert(priv.room._key === 'x', 'nested _key in priv');
});

test('hidden handles array elements', () => {
    const state: any = { players: [{ id: 1, _hand: ['c1'] }, { id: 2 }] };
    const priv = hidden(state);
    assert((state.players[0] as any)._hand === undefined, '_hand removed from player');
    assert(priv.players[0]._hand[0] === 'c1', '_hand in priv');
    assert(priv.players[1] === null, 'player with no hidden data is null in priv');
});

test('hidden returns undefined when nothing hidden', () => {
    const state: any = { a: 1, b: 2 };
    const priv = hidden(state);
    assert(priv === undefined, 'should return undefined when no _ keys');
});

test('unhidden merges private data back (mutates obj in-place)', () => {
    // unhidden mutates obj in-place and returns void
    const state: any = { id: 1 };
    const priv: any = { _secret: 'xyz' };
    unhidden(state, priv);
    assert(state._secret === 'xyz', '_secret merged back into state');
    assert(state.id === 1, 'id preserved');
});

// ─── Section: protocol + delta integration ───────────────────────────────────

console.log(`${C.cyan}${C.bold}\n── Protocol + Delta integration ──${C.reset}`);

registerProtocol({
    type: 'p_delta_int',
    payload: {
        seq: 'uint',
        board: { $static: { $enum: ['', 'X', 'O'] } },
        players: { $static: { id: 'uint', score: 'uint' } }
    }
}, DICT);

test('encode delta ops for $static board', () => {
    const prev = ['', '', '', '', '', '', '', '', ''];
    const next = ['X', '', 'O', '', 'X', '', '', '', ''];
    const changes = delta(prev, next) as any[];
    const msg = { type: 'p_delta_int', payload: { seq: 1, board: changes } };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('encode set ops for $static players', () => {
    // Use explicit set ops (patch ops become set after $static round-trip)
    const msg = {
        type: 'p_delta_int',
        payload: {
            seq: 2,
            players: [{ op: 'set', index: 0, value: { id: 1, score: 5 } }]
        }
    };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

test('full board refresh in protocol', () => {
    const msg = {
        type: 'p_delta_int',
        payload: {
            seq: 3,
            board: ['X', 'O', 'X', 'O', 'X', 'O', 'X', 'O', 'X'],
            players: [{ id: 1, score: 3 }, { id: 2, score: 2 }]
        }
    };
    assertEqual(protoDecode(protoEncode(msg)), msg);
});

// ─── Results ─────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${failed === 0 ? c(C.green + C.bold, passed + ' passed') : c(C.green, passed + ' passed')}, ${failed > 0 ? c(C.red + C.bold, failed + ' failed') : c(C.gray, '0 failed')} ──\n`);
