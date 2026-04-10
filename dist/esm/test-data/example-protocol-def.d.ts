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
declare const PROTOCOL: {
    type: string;
    payload: {
        room: {
            events: {
                $array: {
                    type: string;
                    payload: string;
                };
            };
            timeend: string;
            timesec: string;
            updated: string;
            next_action: string;
            next_player: string;
            next_team: string;
            starttime: string;
            endtime: string;
            sequence: string;
            status: string;
            meta: {
                $object: {
                    room_slug: string;
                    isreplay: string;
                    players: string;
                    teams: string;
                };
            };
        };
        teams: {
            $static: {
                team_slug: string;
                name: string;
                color: string;
                order: string;
                players: {
                    $static: string;
                };
                rank: string;
                score: string;
                attr: {
                    $custom: {};
                };
            };
        };
        players: {
            $static: {
                id: string;
                displayname: string;
                shortid: string;
                portraitid: string;
                countrycode: string;
                rating: string;
                teamid: string;
                stats: {
                    $map: {};
                };
                items: {
                    $map: {};
                };
                attr: {
                    $custom: string;
                };
                rank: string;
                score: string;
            };
        };
        state: {
            $custom: string;
        };
    };
};
export default PROTOCOL;
//# sourceMappingURL=example-protocol-def.d.ts.map