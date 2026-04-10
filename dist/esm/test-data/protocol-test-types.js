/**
 *
 * $object (known)
 *  (1)             [bitflag] [value] ...
 *
 * $map (unknown)
 *  (1)             [count] [ [key] [value] ] ...
 *
 * $array (normal or delta)
 *  (1) standard    [0] [count] [value] ...
 *  (2) flexible    [1] [count] [ [op] [index?] [length?] [value] ] ...
 *
 * $static (array)
 *  (3) by index    [2] [count] [ [index] [value] ] ...
 *  (4) fill        [3] [count] [index] [value]
 *  (5) refresh     [4] [count] [ [value] [value] [value] ... ]
 *
 */
const Player = {
    "info": {
        "$object": {
            "id": "uint",
            "displayname": "string",
            "shortid": "string",
            "portraitid": "uint",
            "countrycode": "string",
            "rating": "uint",
        }
    },
    "teamid": "uint",
    "stats": {
        "$map": {}
    },
    "items": {
        "$map": {}
    },
    "attr": "object",
    "rank": "uint",
    "score": "uint",
};
const Team = {
    "info": {
        "$object": {
            "team_slug": "string",
            "name": "string",
            "color": "string",
            "order": "uint",
        }
    },
    "players": {
        "$static": "uint"
    },
    "rank": "uint",
    "score": "uint",
    "attr": "object"
};
const PROTOCOL = {
    "type": "gameupdate",
    "payload": {
        "room": {
            "$object": {
                "timer": {
                    "$object": {
                        "starttime": "uint",
                        "updated": "uint",
                        "endtime": "uint",
                        "timesec": "uint",
                        "timeend": "uint",
                        "sequence": "uint",
                    }
                },
                "next": {
                    "$object": {
                        "next_player": "uint",
                        "next_team": "uint",
                        "next_action": "uint",
                    }
                },
                "status": "uint",
                "events": {
                    "$array": {
                        "type": "uint",
                        "payload": "object"
                    }
                },
                "meta": {
                    "$object": {
                        "room_slug": "string",
                        "isreplay": "uint",
                        "players": "uint",
                        "teams": "uint",
                    }
                }
            }
        },
        "teams": {
            "$static": Team,
        },
        "players": {
            "$static": Player
        },
        "state": "uint"
    }
};
export default PROTOCOL;
//# sourceMappingURL=protocol-test-types.js.map