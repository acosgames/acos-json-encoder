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
        $static: boolean;
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
                $static: {};
            };
            rank: number;
            score: number;
            attr: number;
            "#players": number;
        };
    };
    players: {
        $byte: number;
        $static: boolean;
        $array: {
            info: {
                $byte: number;
                $object: {
                    id: number;
                    displayname: number;
                    shortid: number;
                    portraitid: number;
                    countrycode: number;
                    rating: number;
                };
            };
            teamid: number;
            stats: {
                $byte: number;
                $map: {};
            };
            items: {
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
//# sourceMappingURL=protocol-test.d.ts.map