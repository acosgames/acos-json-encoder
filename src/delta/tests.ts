// import { delta, merge } from "./delta";
import { delta, merge } from "./delta";

function testDelta() {
  const defaultGame = {
    state: {
      board: [
        [0, 2, 0, 2, 0, 2, 0, 2],
        [2, 0, 2, 0, 2, 0, 2, 0],
        [0, 2, 0, 2, 0, 2, 0, 2],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 1, 0, 1, 0, 1, 0],
        [0, 1, 0, 1, 0, 1, 0, 1],
        [1, 0, 1, 0, 1, 0, 1, 0]
      ],
      cells: ["", "", "", "", "", "", "", "", ""],
      startPlayer: ""
    },
    players: {},
    rules: {
      bestOf: 5,
      maxPlayers: 2
    },
    next: {},
    events: []
  };

  let changed = JSON.parse(JSON.stringify(defaultGame));
  changed.state.board[0][0] = 1;
  changed.state.cells[0] = "x";
  changed.state.cells[1] = "x";
  changed.state.cells[2] = "o";
  changed.state.cells[11] = "1";
  changed.players.joe = { name: "Joe", type: "x" };
  delete changed.state.startPlayer;

  console.time("delta took");
  let diff = delta(defaultGame, changed);
  console.timeEnd("delta took");
  console.log("------------------");
  console.log("delta1:\n", JSON.stringify(diff, null, 2));

  let merged = merge(defaultGame, diff);
  console.log("Merged:", merged);

  changed = JSON.parse(JSON.stringify(merged));
  delete changed.players.joe.type;

  diff = delta(merged, changed);
  console.log("------------------");
  console.log("delta2:\n", JSON.stringify(diff, null, 2));

  merged = merge(merged, diff);

  const test: unknown[] = [];
  test.length = 10;
  console.log(test);
}


function testNestedArrayChange() {
  const from = { "teams": [
      {
        "team_slug": "team_o",
        "name": "Team O",
        "color": "#1187fd",
        "order": 0,
        "players": [
          {
            "id": 1,
            "name": "Player 1",
            "items": [0,0,0,0,0]
          },
          {
            "id": 2,
            "name": "Player 2"
          },
          {
            "id": 3,
            "name": "Player 3",
            "items": [ 1, 2, 3,0,0 ]
          }
        ],
        "rank": 1,
        "score": 0
      },
      {
        "team_slug": "team_x",
        "name": "Team X",
        "color": "#dd7575",
        "order": 1,
        "players": [
          {
            "id": 2,
            "name": "Player 2"
          }
          
        ],
        "rank": 0,
        "score": 0
      }
    ]
  }

  const to = { "teams": [
      {
        "team_slug": "team_B",
        "name": "Team B",
        "color": "#1187fd",
        "order": 0,
        "players": [
          {
            "id": 1,
            "name": "Player 1",
            "items": [ 0,0,0,0,0,0,0 ]
          },
          {
            "id": 2,
            "name": "Player 2"
          },
          {
            "id": 3,
            "name": "Player 3",
            "items": [ 1, 2, 3 ]
          }
        ],
        "rank": 0,
        "score": 0
      },
      
    ]
  }
  

  
  console.time("delta took");
  let diff = delta(from, to);
  console.timeEnd("delta took");
  console.log("------------------");
  console.log("delta1:\n", JSON.stringify(diff, null, 2));
}

function testObjectDeltaPlus() {
  const from = {
    a: 1,
    b: { x: 10, y: 20 },
    c: [1, 2, 3]
  };
  const to = {
    a: 1,
    b: { x: 15, z: 30 },
    c: [1, 2, 4, 5]
  };

  console.time("deltaPlus took");
  const diff = delta(from, to);
  console.timeEnd("deltaPlus took");
  console.log("------------------");
  console.log("deltaPlus:\n", JSON.stringify(diff, null, 2));
} 

testObjectDeltaPlus();
// testDelta();
// testNestedArrayChange();
