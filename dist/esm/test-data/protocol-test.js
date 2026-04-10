/**
 *
 * $object (known)
 *  (1)             [bitflag] [value] ...
 *
 * $map (unknown)
 *  (1)             [count] [ [key] [value] ] ...
 *
 * $array (normal or delta)
 *  (1)             [count] [value] ...
 *  (2)             [count] [ [op] [index?] [length?] [value] ] ...
 *
 * $static (array)
 *  (1) by index    [0] [count] [ [index] [value] ] ...
 *  (2) fill        [1] [index] [value]
 *  (3) refresh     [2] [count] [ [value] [value] [value] ... ]
 *
 */
const Player = {
    "info": {
        "$byte": 1,
        "$object": {
            "id": 1,
            "displayname": 2,
            "shortid": 3,
            "portraitid": 4,
            "countrycode": 5,
            "rating": 7,
        }
    },
    "teamid": 2,
    "stats": {
        "$byte": 3,
        "$map": {}
    },
    "items": {
        "$byte": 4,
        "$object": {}
    },
    "attr": 5,
    "rank": 6,
    "score": 7,
};
const Team = {
    "info": {
        "$byte": 1,
        "$object": {
            "team_slug": 1,
            "name": 2,
            "color": 3,
            "order": 4,
        }
    },
    "players": {
        "$byte": 2,
        "$static": {}
    },
    "rank": 3,
    "score": 4,
    "attr": 5,
    "#players": 6
};
const PROTOCOL = {
    "room": {
        "$byte": 2,
        "$object": {
            "timer": {
                "$byte": 1,
                "$object": {
                    "starttime": 1,
                    "updated": 2,
                    "endtime": 3,
                    "timesec": 4,
                    "timeend": 5,
                    "sequence": 6,
                }
            },
            "next": {
                "$byte": 2,
                "$object": {
                    "next_player": 1,
                    "next_team": 2,
                    "next_action": 3,
                }
            },
            "status": 3,
            "events": {
                "$byte": 4,
                "$array": {
                    "type": 1,
                    "payload": 2
                }
            },
            "meta": {
                "$byte": 5,
                "$object": {
                    "room_slug": 1,
                    "isreplay": 2,
                    "players": 3,
                    "teams": 4,
                }
            }
        }
    },
    "teams": {
        "$byte": 4,
        "$static": true,
        "$array": Team
    },
    "players": {
        "$byte": 5,
        "$static": true,
        "$array": Player
    },
    "state": 6
};
export default PROTOCOL;
//# sourceMappingURL=protocol-test.js.map