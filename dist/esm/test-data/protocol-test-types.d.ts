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
            $object: {
                timer: {
                    $object: {
                        starttime: string;
                        updated: string;
                        endtime: string;
                        timesec: string;
                        timeend: string;
                        sequence: string;
                    };
                };
                next: {
                    $object: {
                        next_player: string;
                        next_team: string;
                        next_action: string;
                    };
                };
                status: string;
                events: {
                    $array: {
                        type: string;
                        payload: string;
                    };
                };
                meta: {
                    $object: {
                        room_slug: string;
                        isreplay: string;
                        players: string;
                        teams: string;
                    };
                };
            };
        };
        teams: {
            $static: {
                info: {
                    $object: {
                        team_slug: string;
                        name: string;
                        color: string;
                        order: string;
                    };
                };
                players: {
                    $static: string;
                };
                rank: string;
                score: string;
                attr: string;
            };
        };
        players: {
            $static: {
                info: {
                    $object: {
                        id: string;
                        displayname: string;
                        shortid: string;
                        portraitid: string;
                        countrycode: string;
                        rating: string;
                    };
                };
                teamid: string;
                stats: {
                    $map: {};
                };
                items: {
                    $map: {};
                };
                attr: string;
                rank: string;
                score: string;
            };
        };
        state: string;
    };
};
export default PROTOCOL;
//# sourceMappingURL=protocol-test-types.d.ts.map