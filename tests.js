const { encode, decode, createDefaultDict } = require('./encoder')


var defaultDictionary = [
    'room_slug',
    'game_slug',
    'gameid',
    'version',
    'state',
    'events',
    'players',
    'timer',
    'rules',
    'next',
    'prev',
    'action',
    'seq',
    'rank',
    'rating',
    'ratingTxt',
    'score',
    'highscore',
    '_win',
    '_loss',
    '_tie',
    '_played',
    'win',
    'loss',
    'tie',
    'wins',
    'losses',
    'tied',
    'forfeit',
    'forfeited',
    'strip',
    'type',
    'payload',
    'dict',
    'db',
    'latest_tsupdate',
    'minplayers',
    'maxplayers',
    'maxPlayers',
    'teams',
    'mode',
    'owner',
    'isfull',
    'isprivate',
    'tsupdate',
    'tsinsert',
    'name',
    'id',
    'offset',
    'serverTime',
    'gamestatus',
    'pregame',
    'starting',
    'gamestart',
    'gameover',
    'join',
    'leave',
    'seconds',
    'end',
    'ready',
    'update',
    'finish',
    'winner',
    'private',
    'timeleft',
    'user',
    'pick',
    'picked',
    'move',
    'moved',
    'cells',
    'cellid',
    'cellx',
    'celly',
    'cellz',
    'startPlayer',
    'queue',
    'experimental',
    'local',
    'ping',
    'pong',
    'joingame',
    'joinroom',
    'joinqueue',
    'leavequeue',
    'spectate',
    'newround',
    'round',
    'rounds',
    'inrooms',
    'shortid',
    'private_key',
    'joined',
    'Wood I',
    'Wood II',
    'Wood III',
    'Wood IV',
    'Bronze I',
    'Bronze II',
    'Bronze III',
    'Bronze IV',
    'Silver I',
    'Silver II',
    'Silver III',
    'Silver IV',
    'Gold I',
    'Gold II',
    'Gold III',
    'Gold IV',
    'Platinum I',
    'Platinum II',
    'Platinum III',
    'Platinum IV',
    'Champion I',
    'Champion II',
    'Champion III',
    'Champion IV',
    'Grand Champion I',
    'Grand Champion II',
    'Grand Champion III',
    'Grand Champion IV',
    'board',
    'playerCount',
    'red',
    'blue',
    'item',
    'items',
    'bestOf',
    'achievements',
    'achievement',
    'chat',
    'message',
    'displayname',
    'timestamp',
    'icon',
    'lastUpdate',
    'starttime',
    'endtime',
    'updated',
    'timeseq',
    'isreplay',
    'status',
    'sequence',
    'history',
    'index',
    'value',
    'setvalue',
    'resize',
    'nested',
    'team_slug',
    'team_1',
    'team_2',
    'team_3',
    'team_4',
    'team_5',
    'team_6',
    'team_7',
    'team_8',
    'team_9',
    'team_10',
    'team_11',
    'team_12',
    'team_13',
    'team_14',
    'team_15',
    'team_16',
    'correct',
    'incorrect'
]



let testJSON = {
    "room": {
        "room_slug": "8HKDWM",
        "sequence": 8,
        "status": "gamestart",
        "starttime": 1672290602570,
        "endtime": 0,
        "updated": 1672290609197
    },
    "state": {
        "cells": [
            "O",
            "X",
            "",
            "O",
            "",
            "",
            "",
            "",
            ""
        ],
        "sx": "DjTS3"
    },
    "next": {
        "id": "iobYl",
        "action": "pick"
    },
    "events": {},
    "timer": {
        "end": 1672300609197,
        "seconds": 10000,
        "sequence": 5
    },
    "players": {
        "iobYl": {
            "name": "Player2326",
            "rank": 0,
            "score": 0,
            "rating": 2636,
            "teamid": "team_o",
            "ready": true,
            "type": "X"
        },
        "DjTS3": {
            "name": "Player7145",
            "rank": 0,
            "score": 0,
            "rating": 2364,
            "teamid": "team_x",
            "ready": true,
            "type": "O"
        }
    },
    "teams": {
        "team_o": {
            "name": "Team O",
            "color": "#a2abdd",
            "order": 0,
            "players": [
                "iobYl"
            ],
            "rank": 2,
            "score": 0
        },
        "team_x": {
            "name": "Team X",
            "color": "#dd7575",
            "order": 1,
            "players": [
                "DjTS3"
            ],
            "rank": 2,
            "score": 0
        }
    }
}


function testEncoding() {
    // example dictionary to match any strings that might appear in JSON
    // this will reduce these strings into two bytes when detected
    let myDictionary = [
        "name",
        "rank",
        "score",
        "rating",
        "teamid",
        "ready",
        "type",
        "team_o",
        "team_x",
    ];

    // example JSON data to encode/decode
    let jsonData = {
        iobYl: {
            name: "Player2326",
            rank: 0,
            score: 0,
            rating: 2636,
            teamid: "team_o",
            ready: true,
            type: "X",
        },
        DjTS3: {
            name: "Player7145",
            rank: 0,
            score: 0,
            rating: 2364,
            teamid: "team_x",
            ready: true,
            type: "O",
        },
    };

    // use your dictionary
    createDefaultDict(myDictionary);

    // encode and serialize the data into bytes
    let jsonEncoded = encode(jsonData);

    // decode the bytes back into a JSON string
    let decoded = decode(jsonEncoded);

    // validate the original matches the decoded
    if (JSON.stringify(jsonData) == JSON.stringify(decoded)) {
        console.log("Encoding MATCHES");
    }

    // output byte sizes
    console.log("JSON string size: ", JSON.stringify(jsonData).length);
    console.log("Encoded JSON size:", jsonEncoded.byteLength);
}







testEncoding();
