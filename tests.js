const { encode, decode, createDefaultDict } = require("./encoder");

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
    "Wood I",
    "Wood II",
    "Wood III",
    "Wood IV",
    "Bronze I",
    "Bronze II",
    "Bronze III",
    "Bronze IV",
    "Silver I",
    "Silver II",
    "Silver III",
    "Silver IV",
    "Gold I",
    "Gold II",
    "Gold III",
    "Gold IV",
    "Platinum I",
    "Platinum II",
    "Platinum III",
    "Platinum IV",
    "Champion I",
    "Champion II",
    "Champion III",
    "Champion IV",
    "Grand Champion I",
    "Grand Champion II",
    "Grand Champion III",
    "Grand Champion IV",
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
    "sequence",
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
    "timeend",
    "timeseconds",
];

let testJSON = [
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
        type: "join",
        room_slug: "B89HJ",
        payload: {
            room: {
                room_slug: "B89HJ",
                sequence: 2,
                status: "pregame",
                starttime: 1716346322864,
                endtime: 0,
                updated: 1716346322873,
            },
            state: {},
            next: {},
            events: {
                join: ["8CCkf", "pkHQf"],
            },
            timer: {
                sequence: 0,
            },
            players: {
                "8CCkf": {
                    displayname: "joe",
                    shortid: "8CCkf",
                    rank: 2,
                    score: 0,
                    rating: 3543,
                    portraitid: 892,
                    countrycode: "US",
                    teamid: "team_o",
                },
                pkHQf: {
                    displayname: "IncriminatingSquab",
                    shortid: "pkHQf",
                    rank: 2,
                    score: 0,
                    rating: 3519,
                    portraitid: 1832,
                    countrycode: "US",
                    teamid: "team_x",
                },
            },
            teams: {
                team_o: {
                    name: "Team O",
                    color: "#1187fd",
                    order: 0,
                    players: ["8CCkf"],
                    rank: 2,
                    score: 0,
                },
                team_x: {
                    name: "Team X",
                    color: "#dd7575",
                    order: 1,
                    players: ["pkHQf"],
                    rank: 2,
                    score: 0,
                },
            },
        },
    },
    {
        type: "update",
        room_slug: "B89HJ",
        payload: {
            room: {
                sequence: 3,
                updated: 1716346323031,
            },
            players: {
                pkHQf: {
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

const {
    unpack,
    pack,
    Packr,
    Unpackr,
    isNativeAccelerationEnabled,
} = require("msgpackr");
function testEncoding() {
    // example dictionary to match any strings that might appear in JSON
    // this will reduce these strings into two bytes when detected
    let myDictionary = [
        "type",
        "room_slug",
        "payload",
        "room",
        "sequence",
        "status",
        "updated",
        "state",
        "_qid",
        "_history",
        "category",
        "choices",
        "round",
        "stage",
        "rounds",
        "maxplayers",
        "datetime",
        "next",
        "id",
        "events",
        "q",
        "timer",
        "sequence",
        "end",
        "seconds",
        "players",
        "_choice",
        "action",
        "timeseq",
        "timeleft",
        "gamestart",
        "timeseq",
        "timeend",
        "timeseconds",
    ];

    // example JSON data to encode/decode
    // let jsonData = {
    //     iobYl: {
    //         name: "Player2326",
    //         rank: 0,
    //         score: 0,
    //         rating: 2636,
    //         teamid: "team_o",
    //         ready: true,
    //         type: "X",
    //     },
    //     DjTS3: {
    //         name: "Player7145",
    //         rank: 0,
    //         score: 0,
    //         rating: 2364,
    //         teamid: "team_x",
    //         ready: true,
    //         type: "O",
    //     },
    // };

    if (!isNativeAccelerationEnabled)
        console.warn(
            "Native acceleration not enabled, verify that install finished properly"
        );

    // use your dictionary
    createDefaultDict([]);
    let packer = new Packr({
        bundleStrings: false,
        isNativeAccelerationEnabled: true,
    });
    let unpacker = new Unpackr({
        bundleStrings: false,
        isNativeAccelerationEnabled: true,
    });

    let start = new Date();

    testJSON = {
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
    };

    // testJSON = { compact: true, schema: 0 };

    // encode and serialize the data into bytes
    let jsonEncoded = encode(testJSON, myDictionary);
    // decode the bytes back into a JSON string
    let decoded = decode(jsonEncoded, myDictionary);
    // console.log("acos time:", (new Date() - start));

    start = new Date();
    let packed = packer.pack(testJSON);
    let unpacked = unpacker.unpack(packed);
    // console.log("msgp time:", (new Date() - start));

    // validate the original matches the decoded
    if (JSON.stringify(testJSON) == JSON.stringify(decoded)) {
        console.log("Encoding MATCHES");
    } else {
        console.log("Encoding not match", decoded);
    }

    // output byte sizes
    console.log("JSON string size: ", JSON.stringify(testJSON).length);
    console.log("acos encoded JSON size:", jsonEncoded.byteLength);
    console.log("msgpack encoded JSON size: ", packed.byteLength);
}

testEncoding();
