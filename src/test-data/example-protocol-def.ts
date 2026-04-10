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
    "id": "uint",
    "displayname": "string",
    "shortid": "string",
    "portraitid": "uint",
    "countrycode": "string",
    "rating": "uint",
    "teamid": "uint",
    "stats": {
        "$map": {}
    },
    "items": {
        "$map": {}
    },
    "attr": {
        "$custom": 'any'
    },
    "rank": "uint",
    "score": "uint",
}

const Team = {
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
        "$custom": {}
    }
}

const PROTOCOL = {
    "type": "gameupdate",
    "payload": {
        "room": {
            "events": {
                "$array": {
                    "type": "uint",
                    "payload": "object"
                }
            },
            "timeend": "uint",
            "timesec": "uint",
            "updated": "uint",
            "next_action": "uint",
            "next_player": "uint",
            "next_team": "uint",
            "starttime": "uint",
            "endtime": "uint",
            "sequence": "uint",
            "status": "uint",
            "meta": {
                "$object": {
                    "room_slug": "string",
                    "isreplay": "uint",
                    "players": "uint",
                    "teams": "uint",
                }
            }
        },
        "teams": {
            "$static": Team,
        },
        "players": {
            "$static": Player
        },
        "state": {
            "$custom": 'any'
        }
    },
}

export default PROTOCOL;