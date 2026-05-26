/**
 * 
 * $object (known fields, plain record)
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

const PROTOCOL = {
    "type": "gameupdate",
    "room_slug": "string",
    "payload": {
        "room": {
            "events": {
                "$array": {
                    "type": {"$enum": ["join", "newround", "gamestart", "pick", "gameover", "error"]},
                    "payload": {
                        "$slot": "any"
                    }
                }
            },
            "timeend": "uint",
            "timesec": "uint",
            "updated": "uint",
            "next_action": {
                "$enum": ["pick", "move", "select"]
            },
            "next_player": "uint",
            "next_team": "uint",
            "starttime": "uint",
            "endtime": "uint",
            "sequence": "uint",
            "status": "uint",
            "meta": {
                "room_slug": "string",
                "isreplay": "uint",
                "players": "uint",
                "teams": "uint"
            }
        },
        "teams": {
            "$static": {
                "team_slug": "string",
                "name": "string",
                "color": "string",
                "order": "uint",
                "players": {
                    "$static": "uint"
                },
                "rank": "uint",
                "score": "uint",
                "attr": {
                    "$slot": {}
                }
            }
        },
        "players": {
            "$static": {
                "id": "uint",
                "displayname": "string",
                "shortid": "string",
                "portraitid": "uint",
                "countrycode": "string",
                "rating": "uint",
                "teamid": "uint",
                "stats": {
                    "$map": {
                        "value": "uint"
                    }
                },
                "items": {
                    "$map": {
                        "name": "uint",
                        "balance": "uint"
                    }
                },
                "attr": {
                    "$slot": "any"
                },
                "rank": "uint",
                "score": "uint"
            }
        },
        "state": {
            "$slot": "any"
        }
    }
}

export default PROTOCOL;