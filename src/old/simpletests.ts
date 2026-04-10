import { createDefaultDict } from '../encoder/encoder';
import {
    registerProtocolWT,
    protoEncodeWT,
    protoDecodeWT,
    compileSchema,
    encodeNode,
    decodeNode,
    setStringDictionaryWT,
} from './protocol-withtypes';

import PROTOCOL_GAME_TYPES from '../test-data/protocol-test-types';
import PROTOCOL_GAME from '../test-data/protocol-test';
import dictionary from '../test-data/dictionary.json';
import { initProtocols, protoDecode, protoEncode } from './protocol';

function runEncodingTest() {
    let tests = [
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
    ]

    createDefaultDict(dictionary);
    initProtocols({ "update": { schema: 2, protocol: PROTOCOL_GAME } });
    registerProtocolWT("update", PROTOCOL_GAME_TYPES);

    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        console.time("Encoding " + i);
        let encoded = protoEncodeWT(test);
        console.timeEnd("Encoding " + i);
        console.time("Decoding " + i);
        let decoded = protoDecodeWT(encoded);
        console.timeEnd("Decoding " + i);

        
        console.log("Decoded equals original:", JSON.stringify(decoded) === JSON.stringify(test));
        console.log("Encoded (original size):", JSON.stringify(test).length, "bytes");
        console.log("Encoded (size):", encoded.byteLength, "bytes");
        

        let encoded2 = protoEncode(test);
        console.log("Re-encoded (size):", encoded2.byteLength, "bytes");
        let decoded2 = protoDecode(encoded2);
        console.log("Decoded equals original:", JSON.stringify(decoded2) === JSON.stringify(test));

        console.log("Encoded (size):", encoded2.byteLength, "bytes");

        // console.log("Original:", JSON.stringify(test));
        // console.log("Decoded: ", JSON.stringify(decoded));
    }

}
// runAllTests();
runEncodingTest();