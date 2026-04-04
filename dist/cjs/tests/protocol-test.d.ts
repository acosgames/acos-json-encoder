declare const PROTOCOL: {
    room: {
        $byte: number;
        $object: {
            room_slug: number;
            starttime: number;
            endtime: number;
            sequence: number;
            updated: number;
            next_player: number;
            next_team: number;
            next_id: number;
            next_action: number;
            timeend: number;
            timesec: number;
            status: number;
            isreplay: number;
            players: number;
            teams: number;
            events: {
                $byte: number;
                $array: {
                    type: number;
                    payload: number;
                };
            };
            meta: number;
        };
    };
    teams: {
        $byte: number;
        $array: {
            team_slug: number;
            name: number;
            color: number;
            order: number;
            players: number;
            rank: number;
            score: number;
        };
    };
    players: {
        $byte: number;
        $array: {
            displayname: number;
            shortid: number;
            portraitid: number;
            countrycode: number;
            teamid: number;
            rank: number;
            score: number;
            ready: number;
            rating: number;
        };
    };
    state: number;
    "#players": {
        $byte: number;
        $array: {
            index: number;
            type: number;
            value: {
                $byte: number;
                $object: {
                    displayname: number;
                    shortid: number;
                    portraitid: number;
                    countrycode: number;
                    teamid: number;
                    rank: number;
                    score: number;
                    ready: number;
                    rating: number;
                };
            };
        };
    };
    "#teams": {
        $byte: number;
        $array: {
            index: number;
            type: number;
            value: {
                $byte: number;
                $object: {
                    team_slug: number;
                    name: number;
                    color: number;
                    order: number;
                    players: number;
                    rank: number;
                    score: number;
                };
            };
        };
    };
};
export default PROTOCOL;
