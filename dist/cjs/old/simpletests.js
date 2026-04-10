"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var encoder_1 = require("../encoder/encoder");
var protocol_withtypes_1 = require("./protocol-withtypes");
var protocol_test_types_1 = require("../test-data/protocol-test-types");
var protocol_test_1 = require("../test-data/protocol-test");
var dictionary_json_1 = require("../test-data/dictionary.json");
var protocol_1 = require("./protocol");
function runEncodingTest() {
    var tests = [
        {
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
        },
        {
            type: "update",
            payload: {
                "#teams": [
                    {
                        "index": 1,
                        "op": "set",
                        "value": {
                            "players": [
                                1
                            ],
                            "rank": 2
                        }
                    }
                ]
            }
        }
    ];
    (0, encoder_1.createDefaultDict)(dictionary_json_1.default);
    (0, protocol_1.initProtocols)({ "update": { schema: 2, protocol: protocol_test_1.default } });
    (0, protocol_withtypes_1.registerProtocolWT)("update", protocol_test_types_1.default);
    for (var i = 0; i < tests.length; i++) {
        var test = tests[i];
        console.time("Encoding " + i);
        var encoded = (0, protocol_withtypes_1.protoEncodeWT)(test);
        console.timeEnd("Encoding " + i);
        console.time("Decoding " + i);
        var decoded = (0, protocol_withtypes_1.protoDecodeWT)(encoded);
        console.timeEnd("Decoding " + i);
        console.log("Decoded equals original:", JSON.stringify(decoded) === JSON.stringify(test));
        console.log("Encoded (original size):", JSON.stringify(test).length, "bytes");
        console.log("Encoded (size):", encoded.byteLength, "bytes");
        var encoded2 = (0, protocol_1.protoEncode)(test);
        console.log("Re-encoded (size):", encoded2.byteLength, "bytes");
        var decoded2 = (0, protocol_1.protoDecode)(encoded2);
        console.log("Decoded equals original:", JSON.stringify(decoded2) === JSON.stringify(test));
        console.log("Encoded (size):", encoded2.byteLength, "bytes");
        // console.log("Original:", JSON.stringify(test));
        // console.log("Decoded: ", JSON.stringify(decoded));
    }
}
// runAllTests();
runEncodingTest();
