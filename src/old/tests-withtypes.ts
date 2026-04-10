/**
 * tests-withtypes.ts
 *
 * Test suite for protocol-withtypes.ts using the protocol-test-types.ts definition.
 * Run via: npm test  (builds first, then node dist/tests-withtypes.js)
 */

import _PROTOCOL_DEF from '../test-data/protocol-test-types';
// The exported default is the payload schema (no type/payload envelope).
// Use the two-argument form of registerProtocolWT to register it under "update".
const PROTOCOL_SCHEMA = _PROTOCOL_DEF as any;
import {
    registerProtocolWT,
    protoEncodeWT,
    protoDecodeWT,
    compileSchema,
    encodeNode,
    decodeNode,
    setStringDictionaryWT,
} from './protocol-withtypes';
import { createDefaultDict } from '../encoder/encoder';


var defaultDictionary = [
    "room_slug",
    "game_slug",
    "gameid",
    "version",
    "state",
    "events",
    "players",
    "timer",
    "rules",
    "next",
    "prev",
    "action",
    "seq",
    "rank",
    "rating",
    "ratingTxt",
    "score",
    "highscore",
    "_win",
    "_loss",
    "_tie",
    "_played",
    "win",
    "loss",
    "tie",
    "wins",
    "losses",
    "tied",
    "forfeit",
    "forfeited",
    "strip",
    "type",
    "payload",
    "dict",
    "db",
    "latest_tsupdate",
    "minplayers",
    "maxplayers",
    "maxPlayers",
    "teams",
    "mode",
    "owner",
    "isfull",
    "isprivate",
    "tsupdate",
    "tsinsert",
    "name",
    "id",
    "offset",
    "serverTime",
    "gamestatus",
    "pregame",
    "starting",
    "gamestart",
    "gameover",
    "join",
    "leave",
    "seconds",
    "end",
    "ready",
    "update",
    "finish",
    "winner",
    "private",
    "timeleft",
    "user",
    "pick",
    "picked",
    "move",
    "moved",
    "cells",
    "cellid",
    "cellx",
    "celly",
    "cellz",
    "startPlayer",
    "queue",
    "experimental",
    "local",
    "ping",
    "pong",
    "joingame",
    "joinroom",
    "joinqueue",
    "leavequeue",
    "spectate",
    "newround",
    "round",
    "rounds",
    "inrooms",
    "shortid",
    "private_key",
    "joined",
    "board",
    "playerCount",
    "red",
    "blue",
    "item",
    "items",
    "bestOf",
    "achievements",
    "achievement",
    "chat",
    "message",
    "displayname",
    "timestamp",
    "icon",
    "lastUpdate",
    "starttime",
    "endtime",
    "updated",
    "timeseq",
    "isreplay",
    "status",
    "_sequence",
    "history",
    "index",
    "value",
    "setvalue",
    "resize",
    "nested",
    "team_slug",
    "team_1",
    "team_2",
    "team_3",
    "team_4",
    "team_5",
    "team_6",
    "team_7",
    "team_8",
    "team_9",
    "team_10",
    "team_11",
    "team_12",
    "team_13",
    "team_14",
    "team_15",
    "team_16",
    "correct",
    "incorrect",
    "queueStats",
    "preview_images",
    "preview_image",
    "count",
    "portraitid",
    "countrycode",
    "US",
    "UK",
    "gamecancelled",
    "gameerror",
    "timesec",
    "timeend",
    "next_id",
    "next_action",
];
// ─── Equality helper (same as tests.ts) ───────────────────────────────────────

function areEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return a === b;

    const isArrA = Array.isArray(a);
    const isArrB = Array.isArray(b);
    if (isArrA !== isArrB) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const k of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
        if (!areEqual(a[k], b[k])) return false;
    }
    return true;
}

// ─── Primitive roundtrip helper ───────────────────────────────────────────────

function primitiveRoundtrip(type: string, value: any): any {
    const node = compileSchema(type);
    const buf: number[] = [];
    encodeNode(value, node, buf);
    const view = new DataView(new Uint8Array(buf).buffer);
    return decodeNode({ view, pos: 0 }, node);
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const errors: string[] = [];

function run(name: string, fn: () => void) {
    try {
        fn();
        pass++;
        console.log(`  PASS  ${name}`);
    } catch (e: any) {
        fail++;
        errors.push(`  FAIL  ${name}\n         ${e?.message ?? e}`);
        console.log(`  FAIL  ${name}: ${e?.message ?? e}`);
    }
}

function assertEqual(actual: any, expected: any, msg = '') {
    if (!areEqual(actual, expected)) {
        throw new Error(
            `${msg ? msg + '\n         ' : ''}expected: ${JSON.stringify(expected)}\n         actual:   ${JSON.stringify(actual)}`
        );
    }
}

function assertRoundtrip(label: string, msg: { type: string; payload: any }) {
    run(label, () => {
        const encoded = protoEncodeWT(msg);
        const decoded = protoDecodeWT(encoded);
        assertEqual(decoded, msg, 'round-trip mismatch');
        console.log(`          encoded: ${encoded.byteLength}B  (json: ${JSON.stringify(msg).length}B)`);
    });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

// PROTOCOL_SCHEMA has the { type, payload } envelope – use one-argument form so
// registerProtocolWT extracts typeName from .type and schema from .payload.
createDefaultDict(defaultDictionary);
registerProtocolWT(PROTOCOL_SCHEMA);

console.log('\n=== protocol-withtypes tests ===\n');

// ─── 1. Primitive wire encoders ───────────────────────────────────────────────

console.log('--- Primitives ---');

run('uint: 0', () => assertEqual(primitiveRoundtrip('uint', 0), 0));
run('uint: 127 (1-byte LEB)', () => assertEqual(primitiveRoundtrip('uint', 127), 127));
run('uint: 128 (2-byte LEB)', () => assertEqual(primitiveRoundtrip('uint', 128), 128));
run('uint: 300', () => assertEqual(primitiveRoundtrip('uint', 300), 300));
run('uint: large (2^20)', () => assertEqual(primitiveRoundtrip('uint', 1048576), 1048576));
run('uint: null → 0', () => assertEqual(primitiveRoundtrip('uint', null), 0));

run('int: 0', () => assertEqual(primitiveRoundtrip('int', 0), 0));
run('int: -1', () => assertEqual(primitiveRoundtrip('int', -1), -1));
run('int: -128', () => assertEqual(primitiveRoundtrip('int', -128), -128));
run('int: 127', () => assertEqual(primitiveRoundtrip('int', 127), 127));
run('int: -32768', () => assertEqual(primitiveRoundtrip('int', -32768), -32768));

run('float: 3.14', () => {
    const v = primitiveRoundtrip('float', 3.14);
    if (Math.abs(v - 3.14) > 1e-10) throw new Error(`expected 3.14, got ${v}`);
});
run('float: -99.5', () => {
    const v = primitiveRoundtrip('float', -99.5);
    if (Math.abs(v - (-99.5)) > 1e-10) throw new Error(`expected -99.5, got ${v}`);
});

run('string: empty', () => assertEqual(primitiveRoundtrip('string', ''), ''));
run('string: ascii', () => assertEqual(primitiveRoundtrip('string', 'hello'), 'hello'));
run('string: unicode', () => assertEqual(primitiveRoundtrip('string', '日本語'), '日本語'));
run('string: null → ""', () => assertEqual(primitiveRoundtrip('string', null), ''));

run('boolean: true', () => assertEqual(primitiveRoundtrip('boolean', true), true));
run('boolean: false', () => assertEqual(primitiveRoundtrip('boolean', false), false));

// ─── 2. $object bitflag encoding ─────────────────────────────────────────────

console.log('\n--- $object (bitflag) ---');

run('empty payload (no fields present)', () => {
    const msg = { type: 'update', payload: {} };
    const enc = protoEncodeWT(msg);
    const dec = protoDecodeWT(enc);
    assertEqual(dec.type, 'update');
    assertEqual(dec.payload, {});
});

run('state field only (last schema key)', () => {
    assertRoundtrip('state field', { type: 'update', payload: { state: 7 } });
});

run('room: status only (single nested $object field)', () => {
    assertRoundtrip('room.status', { type: 'update', payload: { room: { status: 3 } } });
});

run('room: timer – all 6 fields', () => {
    assertRoundtrip('room.timer full', {
        type: 'update',
        payload: {
            room: {
                timer: {
                    starttime: 1716346322864,
                    updated: 1716346322873,
                    endtime: 2000000000,
                    timesec: 60,
                    timeend: 120,
                    sequence: 7,
                }
            }
        }
    });
});

run('room: timer – partial (3 of 6 fields)', () => {
    assertRoundtrip('room.timer partial', {
        type: 'update',
        payload: {
            room: {
                timer: {
                    sequence: 3,
                    timesec: 30,
                    endtime: 9999,
                }
            }
        }
    });
});

run('room: next – all fields', () => {
    assertRoundtrip('room.next full', {
        type: 'update',
        payload: {
            room: {
                next: { next_player: 2, next_team: 1, next_action: 3 }
            }
        }
    });
});

run('room: meta – all fields', () => {
    assertRoundtrip('room.meta full', {
        type: 'update',
        payload: {
            room: {
                meta: { room_slug: 'B89HJ', isreplay: 0, players: 4, teams: 2 }
            }
        }
    });
});

run('room: full (timer + next + status + events + meta)', () => {
    assertRoundtrip('room full', {
        type: 'update',
        payload: {
            room: {
                timer: { starttime: 1716000000, updated: 1716000001, endtime: 1716001000, timesec: 90, timeend: 180, sequence: 1 },
                next: { next_player: 1, next_team: 0, next_action: 1 },
                status: 2,
                events: [{ type: 1, payload: { x: 1 } }, { type: 2, payload: null }],
                meta: { room_slug: 'lobby7', isreplay: 0, players: 2, teams: 2 }
            }
        }
    });
});

// ─── 3. $array (typed elements) ──────────────────────────────────────────────

console.log('\n--- $array ---');

run('room.events: empty', () => {
    assertRoundtrip('events empty', { type: 'update', payload: { room: { events: [] } } });
});

run('room.events: single item', () => {
    assertRoundtrip('events single', {
        type: 'update',
        payload: { room: { events: [{ type: 5, payload: 'hello' }] } }
    });
});

run('room.events: multiple items with complex payload', () => {
    assertRoundtrip('events multi', {
        type: 'update',
        payload: {
            room: {
                events: [
                    { type: 1, payload: [1, 2, 3] },
                    { type: 2, payload: { key: 'val' } },
                    { type: 3, payload: null },
                ]
            }
        }
    });
});

// ─── 4. $static arrays ───────────────────────────────────────────────────────

console.log('\n--- $static (teams & players) ---');

run('teams: mode 4 (full refresh) – 2 teams', () => {
    assertRoundtrip('teams refresh 2', {
        type: 'update',
        payload: {
            teams: [
                {
                    info: { team_slug: 'team_a', name: 'Team A', color: '#ff0000', order: 0 },
                    rank: 1,
                    score: 10,
                },
                {
                    info: { team_slug: 'team_b', name: 'Team B', color: '#00ff00', order: 1 },
                    rank: 2,
                    score: 5,
                },
            ]
        }
    });
});

run('teams: mode 4 – team with all fields', () => {
    assertRoundtrip('teams all fields', {
        type: 'update',
        payload: {
            teams: [
                {
                    info: { team_slug: 'team_alpha', name: 'Alpha', color: '#ff0055', order: 0 },
                    players: [1, 2, 3],
                    rank: 1,
                    score: 100,
                    attr: { extra: true },
                }
            ]
        }
    });
});

run('teams: mode 2 (by-index updates)', () => {
    assertRoundtrip('teams by-index', {
        type: 'update',
        payload: {
            teams: [
                { op: 'set', index: 0, value: { info: { team_slug: 'team_1', name: 'T1' }, rank: 2, score: 20 } },
                { op: 'set', index: 1, value: { rank: 3 } },
            ]
        }
    });
});

run('teams: mode 3 (fill with single value)', () => {
    assertRoundtrip('teams fill', {
        type: 'update',
        payload: {
            teams: [{ op: 'fill', index: 0, count: 3, value: { rank: 0, score: 0 } }]
        }
    });
});

run('players: mode 4 (full refresh) – 2 players', () => {
    assertRoundtrip('players refresh 2', {
        type: 'update',
        payload: {
            players: [
                {
                    info: { id: 1, displayname: 'Alice', shortid: 'aaa', portraitid: 10, countrycode: 'US', rating: 1500 },
                    teamid: 1,
                    rank: 1,
                    score: 200,
                },
                {
                    info: { id: 2, displayname: 'Bob', shortid: 'bbb', portraitid: 20, countrycode: 'UK', rating: 1200 },
                    teamid: 2,
                    rank: 2,
                    score: 50,
                },
            ]
        }
    });
});

run('players: mode 2 (by-index update)', () => {
    assertRoundtrip('players by-index', {
        type: 'update',
        payload: {
            players: [
                { op: 'set', index: 0, value: { rank: 1, score: 300 } },
            ]
        }
    });
});

run('players: stats ($map with values)', () => {
    assertRoundtrip('players with stats map', {
        type: 'update',
        payload: {
            players: [
                {
                    info: { id: 1, displayname: 'Alice', shortid: 'a', portraitid: 1, countrycode: 'US', rating: 1000 },
                    teamid: 1,
                    stats: { kills: 5, deaths: 2, assists: 3 },
                    rank: 1,
                    score: 50,
                }
            ]
        }
    });
});

// ─── 5. $array flexible ops (mode 1) ─────────────────────────────────────────
// The events field ($array) accepts delta ops when first element has an `op` key.

console.log('\n--- $array flexible ops (events) ---');

run('events: op resize', () => {
    assertRoundtrip('events resize', {
        type: 'update',
        payload: { room: { events: [{ op: 'resize', value: 10 }] } }
    });
});

run('events: op set', () => {
    assertRoundtrip('events set', {
        type: 'update',
        payload: {
            room: {
                events: [{ op: 'set', index: 0, value: { type: 7, payload: 'test' } }]
            }
        }
    });
});

run('events: op patch', () => {
    assertRoundtrip('events patch', {
        type: 'update',
        payload: {
            room: {
                events: [{ op: 'patch', index: 2, value: { type: 9, payload: null } }]
            }
        }
    });
});

run('events: op setrange', () => {
    assertRoundtrip('events setrange', {
        type: 'update',
        payload: {
            room: {
                events: [{
                    op: 'setrange', index: 1,
                    values: [{ type: 1, payload: 1 }, { type: 2, payload: 2 }]
                }]
            }
        }
    });
});

run('events: op fill', () => {
    assertRoundtrip('events fill', {
        type: 'update',
        payload: {
            room: {
                events: [{ op: 'fill', index: 0, count: 4, value: { type: 0, payload: null } }]
            }
        }
    });
});

run('events: op replace', () => {
    assertRoundtrip('events replace', {
        type: 'update',
        payload: {
            room: {
                events: [{
                    op: 'replace',
                    values: [{ type: 5, payload: 'a' }, { type: 6, payload: 'b' }]
                }]
            }
        }
    });
});

run('events: multiple ops in one message', () => {
    assertRoundtrip('events multi-op', {
        type: 'update',
        payload: {
            room: {
                events: [
                    { op: 'resize', value: 3 },
                    { op: 'set', index: 0, value: { type: 1, payload: null } },
                    { op: 'set', index: 1, value: { type: 2, payload: 99 } },
                ]
            }
        }
    });
});

// ─── 6. $map encoding ─────────────────────────────────────────────────────────

console.log('\n--- $map ---');

run('player.stats: empty map', () => {
    assertRoundtrip('stats empty', {
        type: 'update',
        payload: {
            players: [{
                info: { id: 1, displayname: 'P', shortid: 'p', portraitid: 0, countrycode: 'US', rating: 0 },
                teamid: 0,
                stats: {},
                rank: 0,
                score: 0,
            }]
        }
    });
});

run('player.stats: multiple string keys', () => {
    assertRoundtrip('stats multi-key', {
        type: 'update',
        payload: {
            players: [{
                info: { id: 2, displayname: 'Q', shortid: 'q', portraitid: 0, countrycode: 'DE', rating: 900 },
                teamid: 1,
                stats: { kills: 10, deaths: 3, headshots: 7 },
                rank: 1,
                score: 70,
            }]
        }
    });
});

// ─── 7. Complex multi-field messages ─────────────────────────────────────────

console.log('\n--- Complex multi-field messages ---');

run('game start – room + teams (refresh) + players (refresh) + state', () => {
    assertRoundtrip('game start full', {
        type: 'update',
        payload: {
            room: {
                timer: { starttime: 1716346322864, updated: 1716346322873, endtime: 1716347000000, timesec: 60, timeend: 120, sequence: 1 },
                next: { next_player: 1, next_team: 0, next_action: 1 },
                status: 2,
                events: [{ type: 1, payload: { joined: [1, 2] } }],
                meta: { room_slug: 'B89HJ', isreplay: 0, players: 2, teams: 2 },
            },
            teams: [
                { info: { team_slug: 'team_o', name: 'Team O', color: '#1187fd', order: 0 }, players: [1], rank: 0, score: 0 },
                { info: { team_slug: 'team_x', name: 'Team X', color: '#dd7575', order: 1 }, players: [2], rank: 0, score: 0 },
            ],
            players: [
                { info: { id: 1, displayname: 'Alice', shortid: 'ac1', portraitid: 892, countrycode: 'US', rating: 3543 }, teamid: 1, rank: 0, score: 0 },
                { info: { id: 2, displayname: 'Bob', shortid: 'rb2', portraitid: 1832, countrycode: 'UK', rating: 3519 }, teamid: 2, rank: 0, score: 0 },
            ],
            state: 1,
        }
    });
});

run('score update – players by-index + teams by-index', () => {
    assertRoundtrip('score update', {
        type: 'update',
        payload: {
            players: [{ op: 'set', index: 0, value: { rank: 1, score: 100 } }],
            teams: [{ op: 'set', index: 0, value: { rank: 1, score: 100 } }],
        }
    });
});

run('timer tick – room.timer partial + room.next', () => {
    assertRoundtrip('timer tick', {
        type: 'update',
        payload: {
            room: {
                timer: { sequence: 4, updated: 1716346323000, timeend: 90 },
                next: { next_player: 2, next_action: 1 },
            }
        }
    });
});

run('full game snapshot then patch round', () => {
    // Snapshot
    const snap = {
        type: 'update',
        payload: {
            room: {
                timer: { starttime: 1716346322864, updated: 1716346322873, endtime: 1716347000000, timesec: 60, timeend: 120, sequence: 1 },
                next: { next_player: 1, next_team: 0, next_action: 1 },
                status: 2,
                events: [{ type: 1, payload: { joined: [1, 2] } }],
                meta: { room_slug: 'B89HJ', isreplay: 0, players: 2, teams: 2 },
            },
            teams: [
                { info: { team_slug: 'team_o', name: 'Team O', color: '#1187fd', order: 0 }, players: [1], rank: 0, score: 0 },
                { info: { team_slug: 'team_x', name: 'Team X', color: '#dd7575', order: 1 }, players: [2], rank: 0, score: 0 },
            ],
            players: [
                { info: { id: 1, displayname: 'Alice', shortid: 'ac1', portraitid: 892, countrycode: 'US', rating: 3543 }, teamid: 1, rank: 0, score: 0 },
                { info: { id: 2, displayname: 'Bob', shortid: 'rb2', portraitid: 1832, countrycode: 'UK', rating: 3519 }, teamid: 2, rank: 0, score: 0 },
            ],
            state: 1,
        }
    };

    setStringDictionaryWT(defaultDictionary);

    const enc1 = protoEncodeWT(snap);
    const dec1 = protoDecodeWT(enc1);
    assertEqual(dec1, snap, 'snapshot round-trip');

    // Patch
    const patch = {
        type: 'update' as const,
        payload: {
            room: { timer: { sequence: 2, updated: 150 }, status: 2 },
            players: [
                { op: 'set', index: 0, value: { score: 1 } },
            ],
            state: 1,
        }
    };
    const enc2 = protoEncodeWT(patch);
    const dec2 = protoDecodeWT(enc2);
    assertEqual(dec2, patch, 'patch round-trip');
    console.log(`          snapshot: ${enc1.byteLength}B  patch: ${enc2.byteLength}B`);
});

// ─── 12. Size regressions (no dict) ──────────────────────────────────────────

console.log('\n--- Size regressions ---');

run('single uint field encodes in ≤ 4 bytes', () => {
    const enc = protoEncodeWT({ type: 'update', payload: { state: 1 } });
    // 1 typeIndex + 1 bitflag + 1 LEB uint = 3 bytes
    if (enc.byteLength > 4) throw new Error(`expected ≤4B, got ${enc.byteLength}B`);
});

run('empty payload encodes in 2 bytes', () => {
    const enc = protoEncodeWT({ type: 'update', payload: {} });
    // 1 typeIndex + 1+ bitflag bytes (at least one for each group of 7 fields)
    if (enc.byteLength > 8) throw new Error(`expected small (≤8B), got ${enc.byteLength}B`);
});

// ─── 10. String dictionary encoding ──────────────────────────────────────────

console.log('\n--- String dictionary ---');

const GAME_DICT = [
    // indices 0-7: country codes / short strings (single-byte encode)
    'US', 'UK', 'DE', 'FR', 'JP', 'KR', 'CN', 'BR',
    // indices 8-15: common team slugs
    'team_o', 'team_x', 'team_r', 'team_b', 'team_a', 'team_c', 'team_d', 'team_e',
    // indices 16-21: common display strings
    'Alice', 'Bob', 'Charlie', 'Dave', 'Team A', 'Team B',
    // index 127 (boundary – encodes as 2 bytes: 0xFF 0x7F)
    ...Array.from({ length: 110 }, (_, i) => `entry_${i + 17}`),
    'boundary_entry',   // index 127
    // index 128
    'after_boundary',   // index 128
];

run('dict: install dictionary', () => {
    setStringDictionaryWT(GAME_DICT);
    if (GAME_DICT.length < 129) throw new Error('Test dict too short');
});

// Primitive roundtrip with dict active
run('dict: single-byte index (country code "US" → idx 0)', () => {
    const node = compileSchema('string');
    const buf: number[] = [];
    encodeNode('US', node, buf);
    // Expect 1 byte: 0x80 | 0 = 0x80
    if (buf.length !== 1) throw new Error(`expected 1B, got ${buf.length}B`);
    if (buf[0] !== 0x80) throw new Error(`expected 0x80, got 0x${buf[0].toString(16)}`);
    const view = new DataView(new Uint8Array(buf).buffer);
    assertEqual(decodeNode({ view, pos: 0 }, node), 'US');
});

run('dict: single-byte index "team_o" → idx 8 (byte 0x88)', () => {
    const node = compileSchema('string');
    const buf: number[] = [];
    encodeNode('team_o', node, buf);
    if (buf.length !== 1) throw new Error(`expected 1B, got ${buf.length}B`);
    if (buf[0] !== 0x88) throw new Error(`expected 0x88, got 0x${buf[0].toString(16)}`);
    const view = new DataView(new Uint8Array(buf).buffer);
    assertEqual(decodeNode({ view, pos: 0 }, node), 'team_o');
});

run('dict: index 126 encodes as single byte (0xFE)', () => {
    const node = compileSchema('string');
    const entry = GAME_DICT[126];
    const buf: number[] = [];
    encodeNode(entry, node, buf);
    if (buf.length !== 1) throw new Error(`expected 1B, got ${buf.length}B`);
    if (buf[0] !== 0xFE) throw new Error(`expected 0xFE, got 0x${buf[0].toString(16)}`);
    const view = new DataView(new Uint8Array(buf).buffer);
    assertEqual(decodeNode({ view, pos: 0 }, node), entry);
});

run('dict: index 127 encodes as 2 bytes (0xFF, 0x7F)', () => {
    const node = compileSchema('string');
    const entry = GAME_DICT[127]; // 'boundary_entry'
    const buf: number[] = [];
    encodeNode(entry, node, buf);
    if (buf.length !== 2) throw new Error(`expected 2B, got ${buf.length}B`);
    if (buf[0] !== 0xFF) throw new Error(`expected first byte 0xFF, got 0x${buf[0].toString(16)}`);
    if (buf[1] !== 127) throw new Error(`expected second byte 127, got ${buf[1]}`);
    const view = new DataView(new Uint8Array(buf).buffer);
    assertEqual(decodeNode({ view, pos: 0 }, node), entry);
});

run('dict: index 128 encodes as 2 bytes (0xFF, 0x80)', () => {
    const node = compileSchema('string');
    const entry = GAME_DICT[128]; // 'after_boundary'
    const buf: number[] = [];
    encodeNode(entry, node, buf);
    if (buf.length !== 2) throw new Error(`expected 2B, got ${buf.length}B`);
    if (buf[0] !== 0xFF || buf[1] !== 128) throw new Error(`expected [0xFF, 128], got [0x${buf[0].toString(16)}, ${buf[1]}]`);
    const view = new DataView(new Uint8Array(buf).buffer);
    assertEqual(decodeNode({ view, pos: 0 }, node), entry);
});

run('dict: non-dict string still encodes as raw (no overhead for short strings)', () => {
    const node = compileSchema('string');
    const value = 'zz_not_in_dict';
    const buf: number[] = [];
    encodeNode(value, node, buf);
    // Raw: first byte = byte length of value (14), then 14 bytes
    const expectedLen = 1 + new TextEncoder().encode(value).length;
    if (buf.length !== expectedLen) throw new Error(`expected ${expectedLen}B, got ${buf.length}B`);
    const view = new DataView(new Uint8Array(buf).buffer);
    assertEqual(decodeNode({ view, pos: 0 }, node), value);
});

run('dict: raw string ≥ 127 bytes uses 0x7F escape', () => {
    const node = compileSchema('string');
    const value = 'x'.repeat(127);
    const buf: number[] = [];
    encodeNode(value, node, buf);
    // 0x7F (escape) + LEB128(127) [= 0x7F, 0x01] + 127 bytes = 130 bytes
    if (buf[0] !== 0x7F) throw new Error(`expected 0x7F escape, got 0x${buf[0].toString(16)}`);
    const view = new DataView(new Uint8Array(buf).buffer);
    assertEqual(decodeNode({ view, pos: 0 }, node), value);
});

run('dict: empty string still 1 byte (0x00) with dict active', () => {
    const node = compileSchema('string');
    const buf: number[] = [];
    encodeNode('', node, buf);
    if (buf.length !== 1 || buf[0] !== 0) throw new Error(`expected [0x00], got ${JSON.stringify(buf)}`);
});

// Full message round-trips with dict active
run('dict: player info countrycode round-trip (dict hits: US, UK)', () => {
    assertRoundtrip('players with dict strings', {
        type: 'update',
        payload: {
            players: [
                { info: { id: 1, displayname: 'Alice', shortid: 'p1', portraitid: 1, countrycode: 'US', rating: 1500 }, teamid: 1, rank: 1, score: 0 },
                { info: { id: 2, displayname: 'Bob', shortid: 'p2', portraitid: 2, countrycode: 'UK', rating: 1200 }, teamid: 2, rank: 2, score: 0 },
            ]
        }
    });
});

run('dict: team_slug dict hit + non-dict room_slug', () => {
    assertRoundtrip('teams dict slug + raw room meta', {
        type: 'update',
        payload: {
            teams: [
                { info: { team_slug: 'team_o', name: 'Team A', color: '#f00', order: 0 }, rank: 0, score: 0 },
                { info: { team_slug: 'team_x', name: 'Team B', color: '#00f', order: 1 }, rank: 0, score: 0 },
            ],
            room: { meta: { room_slug: 'XYZROOM', isreplay: 0, players: 2, teams: 2 } },
        }
    });
});

run('dict: size gain – same message, dict vs no-dict', () => {
    const msg = {
        type: 'update' as const,
        payload: {
            players: [
                { info: { id: 1, displayname: 'Alice', shortid: 'ac1', portraitid: 1, countrycode: 'US', rating: 1000 }, teamid: 1, rank: 0, score: 0 },
                { info: { id: 2, displayname: 'Bob', shortid: 'rb2', portraitid: 2, countrycode: 'UK', rating: 900 }, teamid: 2, rank: 0, score: 0 },
            ],
        }
    };
    const encWithDict = protoEncodeWT(msg);
    setStringDictionaryWT([]);                // clear dict
    const encNoDict = protoEncodeWT(msg);
    setStringDictionaryWT(GAME_DICT);         // restore
    console.log(`          with dict: ${encWithDict.byteLength}B   without dict: ${encNoDict.byteLength}B`);
    if (encWithDict.byteLength >= encNoDict.byteLength) {
        throw new Error(`dict encoding should be smaller (dict=${encWithDict.byteLength}B, no-dict=${encNoDict.byteLength}B)`);
    }
});

// Clean up dictionary after dict tests so later tests are unaffected
run('dict: reset dictionary', () => {
    setStringDictionaryWT([]);
});

// ─── 11. Unregistered type fallback ──────────────────────────────────────────

console.log('\n--- Fallback (unregistered type) ---');

run('unregistered type falls back gracefully', () => {
    const msg = { type: 'unknown_type', payload: { foo: 42 } };
    const enc = protoEncodeWT(msg as any);
    const byte0 = new Uint8Array(enc)[0];
    assertEqual(byte0, 0, 'typeIndex 0 for unknown type');
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(48)}`);
console.log(`${pass} passed, ${fail} failed  (${pass + fail} total)`);
if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach(e => console.log(e));
    process.exit(1);
}
