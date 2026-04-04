const Player = {
    "displayname": 2,
    "shortid": 3,
    "portraitid": 4,
    "countrycode": 5,
    "teamid": 6,
    "rank": 7,
    "score": 8,
    "ready": 9,
    "rating": 10
}

const Team = {
    "team_slug": 2,
    "name": 3,
    "color": 4,
    "order": 5,
    "players": 6,
    "rank": 7,
    "score": 8
}

const PROTOCOL = {
    "room": {
        "$byte": 2,
        "$object": {
            "room_slug": 2,
            "starttime": 3,
            "endtime": 4,
            "sequence": 5,
            "updated": 6,
            "next_player": 7,
            "next_team": 8,
            "next_id": 9,
            "next_action": 10,
            "timeend": 11,
            "timesec": 12,
            "status": 13,
            "isreplay": 14,
            "players": 15,
            "teams": 16,
            "events": {
                "$byte": 17,
                "$array": {
                    "type": 2,
                    "payload": 3
                }
            },
            "meta": 18
        }
    },
    "teams": {
        "$byte": 4,
        "$array": Team
    },
    "players": {
        "$byte": 5,
        "$array": Player
    },

    "state": 6,
    "#players": {
        "$byte": 7,
        "$array": {
            "index": 2,
            "type": 3,
            "value": {
                "$byte": 4,
                "$object": Player
            }
        }
    },
    "#teams": {
        "$byte": 8,
        "$array": {
            "index": 2,
            "type": 3,
            "value": {
                "$byte": 4,
                "$object": Team
            }
        }
    }
}

export default PROTOCOL;