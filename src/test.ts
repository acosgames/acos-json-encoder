import { registerExtension, applyExtension, getProtocolSchema, protoDecode, protoEncode, registerProtocol, setDefaultDictionary, protoEncodeDebug } from "./encoder/protocol";
import PROTOCOL from "./test-data/example-protocol-def";
import DICTIONARY from './test-data/dictionary.json';
import { areEqual } from "./encoder/helper";
import { merge } from "./delta/delta";

function runEncodingTest() {
    let tests = [
        // {
        //     type: 'gameupdate',
        //     payload: {
        //         room: {
        //             starttime: 1716346322864, updated: 1716346322873, endtime: 1716347000000, timesec: 60, timeend: 120, sequence: 1,
        //             next_player: 1, next_team: 0, next_action: 1,
        //             status: 2,
        //             events: [{ type: 1, payload: { joined: [1, 2] } }],
        //             meta: { room_slug: 'B89HJ', isreplay: 0, players: 2, teams: 2 },
        //         },
        //         teams: [
        //             { team_slug: 'team_o', name: 'Team O', color: '#1187fd', order: 0, players: [1], rank: 0, score: 0 },
        //             { team_slug: 'team_x', name: 'Team X', color: '#dd7575', order: 1, players: [2], rank: 0, score: 0 },
        //         ],
        //         players: [
        //             { id: 1, displayname: 'Alice', shortid: 'ac1', portraitid: 892, countrycode: 'US', rating: 3543, teamid: 1, rank: 0, score: 0 },
        //             { id: 2, displayname: 'Bob', shortid: 'rb2', portraitid: 1832, countrycode: 'UK', rating: 3519, teamid: 2, rank: 0, score: 0 },
        //         ],
        //         state: 1,
        //     }
        // },
        // {
        //     type: "gameupdate",
        //     payload: {
        //         room: {
        //             sequence: 6,
        //             next_player: 1,
        //             timeend: 1716346342382,
        //             // "meta": { room_slug: "B89HJ", }
        //         },
        //         state: {
        //             "cells": [
        //                 {
        //                     index: 0,
        //                     op: "set",
        //                     value: "HELLO",
        //                 },
        //             ],
        //             // "cells": ["X","","O","X","X","O","O","",""],
        //         },
        //         players: [
        //             {
        //                 id: 1,
        //                 displayname: 'Alice', attr: { test: 123 },
        //             },
        //             {
        //                 id: 2, displayname: 'Bob', attr: { test: 456 },
        //             },
        //         ]
        //         // players: [
        //         //     { id: 1, displayname: 'Alice', shortid: 'ac1', portraitid: 892, countrycode: 'US', rating: 3543, teamid: 1, rank: 0, score: 0 },
        //         //     { id: 2, displayname: 'Bob', shortid: 'rb2', portraitid: 1832, countrycode: 'UK', rating: 3519, teamid: 2, rank: 0, score: 0 },
        //         // ],

        //     },
        // },
        // {
        //     type: "gameupdate",
        //     payload: {
        //         room: {
        //             sequence: 6,
        //             next_player: 1,
        //             timeend: 1716346342382,
        //             // "meta": { room_slug: "B89HJ", }
        //         },
        //         state: {
        //             "cells": [
        //                 {
        //                     index: 0,
        //                     op: "set",
        //                     value: "HELLO",
        //                 },
        //             ],
        //             // "cells": ["X","","O","X","X","O","O","",""],
        //         },
        //         players: [
        //             {
        //                 index: 0,
        //                 op: "set",
        //                 value: {
        //                     id: 1,
        //                     displayname: 'Alice', attr: { test: 123 },
        //                 },
        //             },

        //         ]
        //         // players: [
        //         //     { id: 1, displayname: 'Alice', shortid: 'ac1', portraitid: 892, countrycode: 'US', rating: 3543, teamid: 1, rank: 0, score: 0 },
        //         //     { id: 2, displayname: 'Bob', shortid: 'rb2', portraitid: 1832, countrycode: 'UK', rating: 3519, teamid: 2, rank: 0, score: 0 },
        //         // ],

        //     },
        // },
        // {
        //     "type": "join",
        //     "payload": {
        //         "id": 12345,
        //     }
        // }
        {
            "type": "gameupdate",
            "payload":
            {
                "room": {
                    "room_slug": "test",
                    // "next_player": null,
                    // "starttime": 1775878393994,
                    "updated": 70837,
                    // "timeend": null,
                    // "timesec": null
                },
                players: [
                    {
                        index: 100,
                        op: "set",
                        value: {
                            id: 1,
                            // displayname: 'Alice', 
                            attr: { test: 123 },
                        },
                    },
                ]
                // "state": {},
                // "teams": [
                //     {
                //         "team_slug": "team_o",
                //         "name": "Team O",
                //         "color": "#1187fd",
                //         "order": 0,
                //         "players": [],
                //         "rank": 0,
                //         "score": 0
                //     },
                //     {
                //         "team_slug": "team_x",
                //         "name": "Team X",
                //         "color": "#dd7575",
                //         "order": 1,
                //         "players": [],
                //         "rank": 0,
                //         "score": 0
                //     }
                // ]
            }
        }

    ]

    setDefaultDictionary(DICTIONARY);
    registerProtocol(PROTOCOL, DICTIONARY);

    registerExtension('gameupdate', 'default', {
        "state": {
            "cells": {
                "$static": { "$enum": ["", "X", "O"] }
            }
        },
        "players": {
            "attr": {
                "test": "uint"
            }
        },
        "teams": {
            "attr": {
                "test2": "uint"
            }
        },
        "room": {
            "next_action": {
                "$enum": [
                    "pick",
                    "move",
                    "rematch"
                ]
            },
            "events": {
                "$array": {
                    "type": {
                        "$enum": [
                            "pick"
                        ]
                    },
                    "payload": "any"
                }
            }
        }
    });
    // applyExtension('gameupdate', 'default');


    registerProtocol({
        "type": "join",
        "payload": {
            "id": "uint"
        }
    }, DICTIONARY);

    console.log("Extended Protocol Schema:", JSON.stringify(getProtocolSchema('gameupdate'), null, 2));
    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        console.time("Encoding " + i);
        let encoded = protoEncodeDebug(test);
        console.log("Encoding report:", encoded.report);
        console.timeEnd("Encoding " + i);
        console.time("Decoding " + i);
        let decoded = protoDecode(encoded.buffer);
        console.timeEnd("Decoding " + i);

        console.log("Encoded (original size):", JSON.stringify(test).length, "bytes");
        console.log("Encoded (size):", encoded.buffer.byteLength, "bytes");
        console.log("Original:", JSON.stringify(test));
        console.log("Decoded: ", JSON.stringify(decoded));

        console.log("Decoded equals original:", areEqual(decoded, test));
    }


    let startJson = {};
    let deltaJson = {
        "cells": [
            {
                "op": "fill",
                "index": 0,
                "count": 9,
                "value": ""
            }
        ]
    }
    let merged = merge(startJson, deltaJson);
    console.log("Merged:", JSON.stringify(merged));

}

runEncodingTest();