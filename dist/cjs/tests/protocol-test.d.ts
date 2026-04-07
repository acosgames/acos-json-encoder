declare const PROTOCOL: {
    room: {
        $byte: number;
        $object: {
            timer: {
                $byte: number;
                $object: {
                    starttime: number;
                    updated: number;
                    endtime: number;
                    timesec: number;
                    timeend: number;
                    sequence: number;
                };
            };
            next: {
                $byte: number;
                $object: {
                    next_player: number;
                    next_team: number;
                    next_action: number;
                };
            };
            status: number;
            events: {
                $byte: number;
                $array: {
                    type: number;
                    payload: number;
                };
            };
            meta: {
                $byte: number;
                $object: {
                    room_slug: number;
                    isreplay: number;
                    players: number;
                    teams: number;
                };
            };
        };
    };
    teams: {
        $byte: number;
        $array: {
            info: {
                $byte: number;
                $object: {
                    team_slug: number;
                    name: number;
                    color: number;
                    order: number;
                };
            };
            players: {
                $byte: number;
            };
            rank: number;
            score: number;
            attr: number;
            "#players": number;
        };
    };
    players: {
        $byte: number;
        $array: {
            info: {
                $byte: number;
                $object: {
                    id: number;
                    displayname: number;
                    shortid: number;
                    portraitid: number;
                    countrycode: number;
                    teamid: number;
                    rating: number;
                };
            };
            stats: {
                $byte: number;
                $object: {};
            };
            attr: number;
            rank: number;
            score: number;
        };
    };
    state: number;
};
export default PROTOCOL;
