const Player = {
    "info": {
        "$byte": 1,
        "$object": {
            "id": 1,
            "displayname": 2,
            "shortid": 3,
            "portraitid": 4,
            "countrycode": 5,
            "teamid": 6,
            "rating": 7,
        }
    },
    "stats": {
        "$byte": 2,
        "$object": {}
    },
    "attr": 3,
    "rank": 4,
    "score": 5
}

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
        "$byte": 2
    },
    "rank": 3,
    "score": 4,
    "attr": 5,
    "#players": 6
}

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
        "$array": Team
    },
    "players": {
        "$byte": 5,
        "$array": Player
    },

    "state": 6
}

export default PROTOCOL;