"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const delta_1 = require("./delta/delta");
const encoder_1 = require("./encoder");
const protocol_1 = require("./protocol");
const protocol_test_1 = __importDefault(require("./tests/protocol-test"));
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
let testJSON = [
    {
        type: "update",
        payload: {
            "#players": [
                {
                    "index": 1,
                    "type": "setvalue",
                    "value": {
                        "score": 2
                    }
                }
            ],
        }
    },
    {
        room_id: 325,
        room_slug: "B89HJ",
        game_slug: "test-game-1",
        gameid: "6887818848595083264",
        version: 45,
        db: 0,
        css: 1,
        latest_tsupdate: "2024-05-19 04:16:18",
        minplayers: 2,
        maxplayers: 2,
        teams: [
            {
                game_slug: "test-game-1",
                team_slug: "team_o",
                team_order: 0,
                team_name: "Team O",
                minplayers: 1,
                maxplayers: 1,
                color: "#1187fd",
                icon: null,
                tsupdate: "2024-05-19 04:16:18",
                tsinsert: "2022-10-16 03:48:29",
            },
            {
                game_slug: "test-game-1",
                team_slug: "team_x",
                team_order: 1,
                team_name: "Team X",
                minplayers: 1,
                maxplayers: 1,
                color: "#dd7575",
                icon: null,
                tsupdate: "2024-05-19 04:16:18",
                tsinsert: "2022-10-16 03:48:29",
            },
        ],
        mode: "rank",
        rating: 3543,
        lbscore: 0,
        owner: "8CCkf",
        status: 0,
        isprivate: 0,
        private_key: null,
        preview_images: "JCKLNG.png",
        screentype: 3,
        resow: 4,
        resoh: 3,
        screenwidth: 1000,
        minteams: 2,
        maxteams: 2,
        name: "Test Game 1",
    },
    {
        type: "update",
        payload: {
            room: {
                room_slug: "B89HJ",
                sequence: 2,
                status: 1,
                starttime: 1716346322864,
                endtime: 0,
                updated: 1716346322873,
                next_id: 10,
                next_action: 1,
                events: [
                    { type: "join", payload: [1, 2] },
                ],
            },
            state: {},
            "#players": [
                {
                    "index": 1,
                    "type": "setvalue",
                    "value": {
                        "score": 2
                    }
                }
            ],
            players: [
                {
                    shortid: 1,
                    displayname: "joe",
                    rank: 2,
                    score: 0,
                    rating: 3543,
                    portraitid: 892,
                    countrycode: "US",
                    teamid: 1,
                },
                {
                    displayname: "IncriminatingSquab",
                    shortid: 2,
                    rank: 2,
                    score: 0,
                    rating: 3519,
                    portraitid: 1832,
                    countrycode: "US",
                    teamid: 2,
                },
            ],
            teams: [
                {
                    team_slug: 1,
                    name: "Team O",
                    color: 1148925,
                    order: 0,
                    players: [1],
                    rank: 2,
                    score: 0,
                },
                {
                    team_slug: 2,
                    name: "Team X",
                    color: 14513525,
                    order: 1,
                    players: [2],
                    rank: 2,
                    score: 0,
                },
            ],
        },
    },
    {
        "room": {
            "teams": {
                "team_o": 1,
                "team_x": 2
            },
            "teamCount": 2,
            "next_id": null,
            "starttime": 1775363825608,
            "updated": 441,
            "events": {
                "join": [
                    "NGDMWJ"
                ]
            },
            "status": "pregame"
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
                    "NGDMWJ"
                ],
                "rank": 0,
                "score": 0
            },
            {
                "team_slug": "team_x",
                "name": "Team X",
                "color": "#dd7575",
                "order": 1,
                "players": [],
                "rank": 0,
                "score": 0
            }
        ],
        "players": [
            {
                "shortid": "NGDMWJ",
                "displayname": "Player_0",
                "portraitid": 89,
                "teamid": "team_o"
            }
        ],
        "action": {
            "type": "join",
            "payload": {
                "user": {
                    "shortid": "NGDMWJ",
                    "displayname": "Player_0",
                    "team_slug": "team_o"
                },
                "timeseq": 0,
                "timeleft": 0
            }
        }
    },
    {
        type: "update",
        payload: {
            room: {
                sequence: 3,
                updated: 1716346323031,
            },
            players: [
                {
                    shortid: "pkHQf",
                    ready: true,
                },
            ],
        },
    },
    {
        type: "update",
        room_slug: "B89HJ",
        payload: {
            room: {
                sequence: 4,
                status: "starting",
                updated: 1716346323166,
            },
            timer: {
                sequence: 1,
                end: 1716346326166,
                seconds: 3,
            },
            players: {
                "8CCkf": {
                    ready: true,
                },
            },
        },
    },
    {
        type: "update",
        room_slug: "B89HJ",
        payload: {
            room: {
                sequence: 5,
                status: "gamestart",
                updated: 1716346326227,
            },
            state: {
                cells: ["", "", "", "", "", "", "", "", ""],
            },
            next: {
                id: "pkHQf",
                action: "pick",
            },
            events: {
                newround: true,
            },
            timer: {
                sequence: 2,
                end: 1716346341227,
                seconds: 15,
            },
        },
    },
    {
        type: "update",
        room_slug: "B89HJ",
        payload: {
            room: {
                sequence: 6,
                updated: 1716346327382,
            },
            state: {
                "#cells": [
                    {
                        index: 0,
                        type: "setvalue",
                        value: "X",
                    },
                ],
            },
            next: {
                id: "8CCkf",
            },
            timer: {
                sequence: 3,
                end: 1716346342382,
            },
        },
    },
    {
        type: "join",
        room_slug: "B89HJ",
        payload: {
            events: {
                join: ["8CCkf", "pkHQf"],
            },
        },
    },
    {
        type: "update",
        room_slug: "B89HJ",
        payload: {
            room: {
                sequence: 7,
                updated: 1716346327889,
            },
            state: {
                "#cells": [
                    {
                        index: 1,
                        type: "setvalue",
                        value: "O",
                    },
                ],
            },
            next: {
                id: "pkHQf",
            },
            timer: {
                sequence: 4,
                end: 1716346342890,
            },
        },
    },
    {
        type: "join",
        room_slug: "B89HJ",
        payload: {
            events: {
                join: ["8CCkf", "pkHQf"],
            },
        },
    },
    {
        type: "update",
        room_slug: "B89HJ",
        payload: {
            room: {
                sequence: 8,
                updated: 1716346328888,
            },
            state: {
                "#cells": [
                    {
                        index: 3,
                        type: "setvalue",
                        value: "X",
                    },
                ],
            },
            next: {
                id: "8CCkf",
            },
            timer: {
                sequence: 5,
                end: 1716346343888,
            },
        },
    },
    {
        type: "join",
        room_slug: "B89HJ",
        payload: {
            events: {
                join: ["8CCkf", "pkHQf"],
            },
        },
    },
    {
        type: "update",
        room_slug: "B89HJ",
        payload: {
            room: {
                sequence: 9,
                updated: 1716346329503,
            },
            state: {
                "#cells": [
                    {
                        index: 4,
                        type: "setvalue",
                        value: "O",
                    },
                ],
            },
            next: {
                id: "pkHQf",
            },
            timer: {
                sequence: 6,
                end: 1716346344503,
            },
        },
    },
    {
        type: "join",
        room_slug: "B89HJ",
        payload: {
            events: {
                join: ["8CCkf", "pkHQf"],
            },
        },
    },
    {
        type: "gameover",
        room_slug: "B89HJ",
        payload: {
            room: {
                sequence: 10,
                status: "gameover",
                endtime: 1716346330438,
                updated: 1716346330438,
            },
            state: {
                "#cells": [
                    {
                        index: 6,
                        type: "setvalue",
                        value: "X",
                    },
                ],
            },
            events: {
                gameover: {
                    type: "winner",
                    pick: "team_x",
                    strip: [0, 3, 6],
                    shortid: "pkHQf",
                },
                $: ["join"],
            },
            players: {
                pkHQf: {
                    rank: 1,
                    score: 100,
                },
            },
            teams: {
                team_x: {
                    rank: 1,
                    score: 100,
                },
            },
        },
    },
];
function testEncoding() {
    // example dictionary to match any strings that might appear in JSON
    // this will reduce these strings into two bytes when detected
    // let myDictionary = [
    //     "type",
    //     "room_slug",
    //     "payload",
    //     "room",
    //     "sequence",
    //     "status",
    //     "updated",
    //     "state",
    //     "_qid",
    //     "_history",
    //     "category",
    //     "choices",
    //     "round",
    //     "stage",
    //     "rounds",
    //     "maxplayers",
    //     "datetime",
    //     "next",
    //     "id",
    //     "events",
    //     "q",
    //     "timer",
    //     "sequence",
    //     "end",
    //     "seconds",
    //     "players",
    //     "_choice",
    //     "action",
    //     "timeseq",
    //     "timeleft",
    //     "gamestart",
    //     "timeseq",
    //     "timeend",
    //     "timeseconds",
    // ];
    // // use your dictionary
    // createDefaultDict(defaultDictionary);
    // let start = new Date();
    // // testJSON = { compact: true, schema: 0 };
    // let jsonEncoded2 = encode(testJSON);
    // console.time("Encoding and decoding time");
    // // encode and serialize the data into bytes
    // console.time("Encoding time");
    // let jsonEncoded = encode(testJSON);
    // console.timeEnd("Encoding time");
    // // decode the bytes back into a JSON string
    // console.time("Decoding time");
    // let decoded = decode(jsonEncoded);
    // console.timeEnd("Decoding time");
    // console.timeEnd("Encoding and decoding time");
    // // console.log("acos time:", (new Date() - start));
    // start = new Date();
    // // console.log("msgp time:", (new Date() - start));
    // console.log("Original JSON:", JSON.stringify(testJSON));
    // // validate the original matches the decoded
    // if (JSON.stringify(testJSON) == JSON.stringify(decoded)) {
    //     console.log("Encoding MATCHES");
    // } else {
    //     console.log(
    //         "Encoding not match",
    //         "\nBefore:",
    //         JSON.stringify(testJSON),
    //         "\nAfter :",
    //         JSON.stringify(decoded)
    //     );
    // }
    // // output byte sizes
    // console.log("JSON string size: ", Buffer.from(JSON.stringify(testJSON)).length);
    // console.log("acos encoded JSON size:", jsonEncoded.byteLength);
}
function areObjectsEqual(obj1, obj2) {
    if (obj1 === obj2)
        return true;
    if (obj1 === null || obj2 === null)
        return obj1 === obj2;
    if (typeof obj1 !== typeof obj2)
        return false;
    if (typeof obj1 !== "object")
        return obj1 === obj2;
    const arr1 = Array.isArray(obj1);
    const arr2 = Array.isArray(obj2);
    if (arr1 !== arr2)
        return false;
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length)
        return false;
    for (const key of keys1) {
        if (!Object.prototype.hasOwnProperty.call(obj2, key))
            return false;
        if (!areObjectsEqual(obj1[key], obj2[key]))
            return false;
    }
    return true;
}
function test() {
    // initProtocols();
    let ptypes = {
        "update": 2
    };
    let protocols = {
        // "default": { schema: 0, protocol: {} },
        "update": { schema: 2, protocol: protocol_test_1.default }
    };
    (0, encoder_1.createDefaultDict)(defaultDictionary);
    (0, protocol_1.initProtocols)(protocols);
    // for (let i = 0; i < 1; i++) {
    //     console.time("Encoding " + i);
    //     let encoded2 = protoEncode(testJSON[0], defaultDictionary);
    //     console.timeEnd("Encoding " + i);
    //     console.time("Decoding " + i);
    //     let decoded2 = protoDecode(encoded2, defaultDictionary);
    //     console.timeEnd("Decoding " + i);
    // }
    let simpleTest = {
        type: "update",
        payload: {
            "#teams": [
                {
                    "index": 1,
                    "op": "set",
                    "value": {
                        "#players": [
                            1
                        ],
                        "rank": 2
                    }
                }
            ]
        }
    };
    console.time("Encoding");
    let encoded = (0, protocol_1.protoEncode)(simpleTest);
    console.timeEnd("Encoding");
    console.time("Decoding");
    let decoded = (0, protocol_1.protoDecode)(encoded);
    console.timeEnd("Decoding");
    console.log("Encoded (original size):", JSON.stringify(simpleTest).length, "bytes");
    console.log("Encoded (size):", encoded.byteLength, "bytes");
    console.log("Original:", JSON.stringify(simpleTest));
    console.log("Decoded: ", JSON.stringify(decoded));
    console.log("Is Match:", areObjectsEqual(simpleTest, decoded));
}
function testObjectDeltaPlus() {
    let protocols = {
        // "default": { schema: 0, protocol: {} },
        "update": { schema: 2, protocol: protocol_test_1.default }
    };
    (0, encoder_1.createDefaultDict)(defaultDictionary);
    (0, protocol_1.initProtocols)(protocols);
    const from = {
        "teams": [
            {
                rank: 1,
                info: { team_slug: 10, name: 20 },
                players: [1, 2, 3]
            }
        ]
    };
    const to = {
        "teams": [
            {
                rank: 2,
                info: { team_slug: 15, name: 30 },
                players: [1, 2, 4, 5]
            }
        ]
    };
    console.time("deltaPlus took");
    const diff = (0, delta_1.delta)(from, to);
    console.timeEnd("deltaPlus took");
    console.log("------------------");
    console.log("deltaPlus:\n", JSON.stringify(diff, null, 2));
    let update = {
        type: "update",
        payload: diff
    };
    console.time("Encoding");
    let encoded = (0, protocol_1.protoEncode)(update);
    console.timeEnd("Encoding");
    console.time("Decoding");
    let decoded = (0, protocol_1.protoDecode)(encoded);
    console.timeEnd("Decoding");
    console.log("Encoded (original size):", JSON.stringify(update).length, "bytes");
    console.log("Encoded (size):", encoded.byteLength, "bytes");
    console.log("Original:", JSON.stringify(update));
    console.log("Decoded: ", JSON.stringify(decoded));
    console.log("Is Match:", areObjectsEqual(update, decoded));
}
function runAllTests() {
    const protocols = { "update": { schema: 2, protocol: protocol_test_1.default } };
    (0, encoder_1.createDefaultDict)(defaultDictionary);
    (0, protocol_1.initProtocols)(protocols);
    const cases = [
        // --- Primitives & simple fields ---
        {
            name: "primitive state only",
            payload: { state: 42 }
        },
        {
            name: "room: single status sub-field",
            payload: { room: { status: 1 } }
        },
        // --- Nested $object ---
        {
            name: "room: timer sub-object (partial fields)",
            payload: { room: { timer: { sequence: 5, timesec: 30 } } }
        },
        {
            name: "room: timer (all fields) + next + status",
            payload: {
                room: {
                    timer: { starttime: 1000000, updated: 1000001, endtime: 2000000, timesec: 60, timeend: 120, sequence: 7 },
                    next: { next_player: 3, next_team: 1, next_action: 2 },
                    status: 2
                }
            }
        },
        {
            name: "room: meta sub-object",
            payload: { room: { meta: { room_slug: 10, isreplay: 0, players: 4, teams: 2 } } }
        },
        // --- $array (normal) ---
        {
            name: "room: events array (normal)",
            payload: { room: { events: [{ type: 1, payload: 42 }, { type: 2, payload: 99 }] } }
        },
        {
            name: "teams: full array – 2 teams",
            payload: {
                teams: [
                    { info: { team_slug: 1, name: "Team A", color: 0xff0000, order: 0 }, rank: 1, score: 10 },
                    { info: { team_slug: 2, name: "Team B", color: 0x0000ff, order: 1 }, rank: 2, score: 5 }
                ]
            }
        },
        {
            name: "teams: with all fields incl. plain players (byte 2)",
            payload: {
                teams: [
                    { info: { team_slug: 1, name: "T1", color: 16711765, order: 0 }, players: [1, 2, 3], rank: 2, score: 5, attr: 7 }
                ]
            }
        },
        {
            name: "players: full array – 2 players",
            payload: {
                players: [
                    { info: { id: 1, displayname: "Alice", shortid: "abc", portraitid: 10, countrycode: "US", teamid: 1, rating: 1500 }, rank: 1, score: 100 },
                    { info: { id: 2, displayname: "Bob", shortid: "def", portraitid: 20, countrycode: "UK", teamid: 2, rating: 1200 }, rank: 2, score: 50 }
                ]
            }
        },
        // --- Schema-declared isDelta (#players: 6 in Team) ---
        {
            name: "teams: team with isDelta #players (op:replace)",
            payload: {
                teams: [
                    { info: { team_slug: 1, name: "T1" }, rank: 1, "#players": [{ op: "replace", values: [101, 102, 103] }] }
                ]
            }
        },
        {
            name: "teams: team with isDelta #players (op:setrange)",
            payload: {
                teams: [
                    {
                        info: { team_slug: 1, name: "T1" }, rank: 1,
                        "#players": [{ op: "setrange", index: 0, values: [201, 202] }]
                    }
                ]
            }
        },
        // --- #teams delta – individual ops ---
        {
            name: "#teams delta: op:resize",
            payload: { "#teams": [{ op: "resize", value: 4 }] }
        },
        {
            name: "#teams delta: op:set",
            payload: {
                "#teams": [{
                        op: "set", index: 0,
                        value: { info: { team_slug: 1, name: "New" }, rank: 1, score: 0 }
                    }]
            }
        },
        {
            name: "#teams delta: op:patch (partial fields)",
            payload: { "#teams": [{ op: "patch", index: 0, value: { rank: 3, score: 75 } }] }
        },
        {
            name: "#teams delta: op:patch with nested isDelta #players",
            payload: {
                "#teams": [{
                        op: "patch", index: 0,
                        value: { rank: 2, "#players": [{ op: "setrange", index: 1, values: [202, 203] }] }
                    }]
            }
        },
        {
            name: "#teams delta: op:setrange",
            payload: {
                "#teams": [{
                        op: "setrange", index: 0, values: [
                            { info: { team_slug: 1, name: "TA" }, rank: 1, score: 10 },
                            { info: { team_slug: 2, name: "TB" }, rank: 2, score: 5 }
                        ]
                    }]
            }
        },
        {
            name: "#teams delta: op:fill",
            payload: { "#teams": [{ op: "fill", index: 0, length: 3, value: { rank: 0, score: 0 } }] }
        },
        {
            name: "#teams delta: op:replace",
            payload: {
                "#teams": [{
                        op: "replace", values: [
                            { info: { team_slug: 10, name: "X" }, rank: 1, score: 0 },
                            { info: { team_slug: 20, name: "Y" }, rank: 2, score: 0 }
                        ]
                    }]
            }
        },
        {
            name: "#teams delta: multiple ops in sequence",
            payload: {
                "#teams": [
                    { op: "resize", value: 3 },
                    { op: "set", index: 0, value: { rank: 1, score: 0 } },
                    { op: "set", index: 1, value: { rank: 2, score: 0 } }
                ]
            }
        },
        // --- #players top-level delta (discriminator=1 path via $array) ---
        {
            name: "#players delta: op:set (top-level, discriminator=1)",
            payload: { "#players": [{ op: "set", index: 0, value: { rank: 5, score: 200 } }] }
        },
        {
            name: "#players delta: op:setrange with Player schema",
            payload: {
                "#players": [{
                        op: "setrange", index: 0, values: [
                            { info: { id: 1, displayname: "Alice" }, rank: 1, score: 100 },
                            { info: { id: 2, displayname: "Bob" }, rank: 2, score: 50 }
                        ]
                    }]
            }
        },
        // --- Multiple top-level fields ---
        {
            name: "multiple fields: room + teams (normal) + state",
            payload: {
                room: { status: 2, timer: { sequence: 3 } },
                teams: [{ info: { team_slug: 1, name: "T" }, rank: 1, score: 0 }],
                state: 99
            }
        },
        {
            name: "multiple fields: room + #teams delta + #players delta",
            payload: {
                room: { status: 1 },
                "#teams": [{ op: "resize", value: 2 }],
                "#players": [{ op: "resize", value: 4 }]
            }
        },
        // --- delta() round-trip (testObjectDeltaPlus scenario) ---
        {
            name: "delta() round-trip: patch with nested info + isDelta #players",
            from: { teams: [{ rank: 1, info: { team_slug: 10, name: 20 }, players: [1, 2, 3] }] },
            to: { teams: [{ rank: 2, info: { team_slug: 15, name: 30 }, players: [1, 2, 4, 5] }] }
        }
    ];
    let pass = 0, fail = 0;
    console.log("Running tests...\n");
    for (const tc of cases) {
        let payload = tc.payload;
        if (tc.from && tc.to)
            payload = (0, delta_1.delta)(tc.from, tc.to);
        const msg = { type: "update", payload };
        try {
            const encoded = (0, protocol_1.protoEncode)(msg);
            const decoded = (0, protocol_1.protoDecode)(encoded);
            const ok = areObjectsEqual(msg, decoded);
            if (ok) {
                pass++;
                console.log(`  PASS  [${encoded.byteLength}B]  ${tc.name}`);
            }
            else {
                fail++;
                console.log(`  FAIL        ${tc.name}`);
                console.log(`    orig:    ${JSON.stringify(msg)}`);
                console.log(`    decoded: ${JSON.stringify(decoded)}`);
            }
        }
        catch (e) {
            fail++;
            console.log(`  ERROR       ${tc.name}: ${e}`);
        }
    }
    console.log(`\n${pass} passed, ${fail} failed  (${pass + fail} total)`);
}
function runEncodingTest() {
    let tests = [
        {
            "type": "update",
            "payload": {
                "room": {
                    "timer": {
                        "timeend": 60776,
                    },
                    "next": {
                        "next_player": 1
                    }
                },
                "state": {
                    "#cells": [
                        {
                            "op": "set",
                            "index": 2,
                            "value": "O"
                        }
                    ]
                },
                "#players": [
                    {
                        "op": "patch",
                        "index": 0,
                        "value": {
                            "score": 1
                        }
                    }
                ],
            }
        }
    ];
    (0, encoder_1.createDefaultDict)(defaultDictionary);
    (0, protocol_1.initProtocols)({ "update": { schema: 2, protocol: protocol_test_1.default } });
    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        console.time("Encoding " + i);
        let encoded = (0, protocol_1.protoEncode)(test);
        console.timeEnd("Encoding " + i);
        console.time("Decoding " + i);
        let decoded = (0, protocol_1.protoDecode)(encoded);
        console.timeEnd("Decoding " + i);
        console.log("Encoded (original size):", JSON.stringify(test).length, "bytes");
        console.log("Encoded (size):", encoded.byteLength, "bytes");
        console.log("Original:", JSON.stringify(test));
        console.log("Decoded: ", JSON.stringify(decoded));
    }
}
runAllTests();
runEncodingTest();
// testObjectDeltaPlus();
// test();
// testEncoding();
//# sourceMappingURL=tests.js.map