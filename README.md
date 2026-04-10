# ACOS JSON Encoder for Websocket Networking

Efficiently encode JSON objects into compact binary for network transmission. Includes a string dictionary, typed protocol schemas, array delta compression, and hidden-field extraction.

## Installation

```shell
npm i acos-json-encoder
```

## Usage

#### CommonJS (nodejs)

```js
const { encode, decode, createDefaultDict } = require("acos-json-encoder");
```

#### ES6 (webpack, vite, etc)

```js
import { encode, decode, createDefaultDict } from "acos-json-encoder";
```

## Development

```shell
npm install
npm run build
npm test
```

TypeScript source files live in `src/` and compile to `dist/`.

---

## Modules

- **Encoder** — generic JSON binary encoding with dictionary compression
- **Protocol** — typed schema-based binary encoding for structured messages
- **Delta** — compute and apply minimal diffs between two values

---

## Encoder

The encoder serializes any JSON value to a compact binary format. A string dictionary reduces repeating keys and values to 2-byte references.

```js
import { encode, decode, createDefaultDict } from "acos-json-encoder";

const dict = ["name", "rank", "score", "teamid"];
createDefaultDict(dict);

const data = { name: "Alice", rank: 1, score: 4200, teamid: "team_o" };
const bytes = encode(data);
const decoded = decode(bytes);

console.log(JSON.stringify(data) === JSON.stringify(decoded)); // true
console.log("JSON size:", JSON.stringify(data).length);         // e.g. 51
console.log("Encoded size:", bytes.byteLength);                 // e.g. 14
```

### API

#### `createDefaultDict(strings[])`
Set the global default dictionary. Strings in the list are encoded as 2-byte references.

#### `encode(json, [dictionary])`
Encode a JSON value to `ArrayBuffer`. Uses the default dictionary if none is provided.

#### `decode(bytes, [dictionary])`
Decode an `ArrayBuffer` back to a JSON value.

---

## Protocol

The protocol system encodes typed, schema-defined messages. Schemas are registered once; each message is prefixed with a 1-byte type index, allowing the decoder to reconstruct the value without any schema in the wire payload.

### Defining a schema

```js
import {
  registerProtocol, protoEncode, protoDecode,
  setDefaultDictionary, getProtocolSchema
} from "acos-json-encoder";

const Player = {
  id: "uint",
  displayname: "string",
  score: "uint",
  // $custom marks a field as replaceable via extendProtocol
  stats: { "$custom": "any" }
};

const PROTOCOL = {
  type: "gameupdate",
  payload: {
    room: {
      sequence: "uint",
      timeend:  "uint",
      status:   { "$enum": ["waiting", "active", "finished"] }
    },
    players: { "$static": Player },
    // $custom fields can be replaced at runtime
    state: { "$custom": "any" }
  }
};

setDefaultDictionary(["sequence", "timeend", "status", "players", "state"]);
registerProtocol(PROTOCOL);
```

### Encoding and decoding

```js
const message = {
  type: "gameupdate",
  payload: {
    room: { sequence: 12, timeend: 1716346342382, status: "active" },
    players: [
      { id: 1, displayname: "Alice", score: 100, stats: {} },
      { id: 2, displayname: "Bob",   score: 80,  stats: {} },
    ],
    state: { turn: 1 }
  }
};

const encoded = protoEncode(message);
const decoded = protoDecode(encoded);
// decoded.type    → "gameupdate"
// decoded.payload → { room: {...}, players: [...], state: {...} }
```

### Extending a protocol at runtime

`extendProtocol` adds new fields or replaces `$custom`-marked fields. Existing non-custom fields are never replaced. Recurses through `$static`/`$array` element schemas automatically.

```js
import { extendProtocol, revertProtocol } from "acos-json-encoder";

extendProtocol("gameupdate", {
  // Replace the $custom state field with a typed schema
  state: {
    cells: { "$static": { "$enum": ["", "X", "O"] } }
  },
  // Recurse into players/$static/Player to extend its $custom stats field
  players: {
    stats: { wins: "uint", losses: "uint" }
  }
});

// Inspect the live schema
console.log(getProtocolSchema("gameupdate"));

// Restore the original schema (resets all $custom fields)
revertProtocol("gameupdate");
```

### Fallback encoding

Messages with an unregistered `type` are encoded using the generic encoder with the default dictionary. Set a default dictionary to ensure the fallback path decodes correctly.

```js
setDefaultDictionary(["id", "type", "payload"]);

// Unregistered protocol — falls back to generic encoding
const bytes = protoEncode({ type: "ping", payload: { id: 1 } });
const msg   = protoDecode(bytes); // { type: "ping", payload: { id: 1 } }
```

### Schema types

| Schema value | Meaning |
|---|---|
| `"uint"` | Unsigned integer (LEB128) |
| `"int"` | Signed integer (SLEB128) |
| `"float"` | 64-bit float |
| `"string"` | UTF-8 string with optional dictionary compression |
| `"boolean"` | 1 byte |
| `"any"` | Generic fallback encoding |
| `"object"` | Opaque object (generic encoding) |
| `{ "$object": {...} }` | Known-key object with bitflag presence encoding |
| `{ "$map": {...} }` | String-keyed map with typed values |
| `{ "$array": schema }` | Variable-length array |
| `{ "$static": schema }` | Fixed-schema array supporting delta ops |
| `{ "$enum": [v, ...] }` | One of a fixed list of string/number values (1 byte index) |
| `{ "$custom": schema }` | Replaceable field; default schema used until `extendProtocol` overrides it |

### Protocol API

#### `registerProtocol(definition, [dictionary])`
Register a protocol. `definition.type` (string) is the message type name. `definition.payload` is the schema.

#### `extendProtocol(type, overrides)`
Deep-merge `overrides` into the live schema. Only `$custom` fields can be replaced; non-custom fields are skipped. `$static`/`$array` element schemas are traversed automatically.

#### `revertProtocol(type)`
Reset the protocol schema back to its state at registration time.

#### `setDefaultDictionary(strings[])`
Set the dictionary used by the fallback (unregistered type) encode/decode path.

#### `getProtocolSchema(type)`
Returns a plain-object description of the current compiled schema.

#### `protoEncode(message)`
Encode `{ type, payload }` to `ArrayBuffer`.

#### `protoDecode(buffer)`
Decode an `ArrayBuffer` to `{ type, payload }`.

---

## Delta

Compute minimal diffs between two values and apply them. Designed to pair with `$array` / `$static` schemas in the protocol encoder.

```js
import { delta, merge } from "acos-json-encoder";

const prev = ["X", "", "O", "", "", "", "", "", ""];
const next = ["X", "", "O", "X", "", "", "", "", ""];

const changes = delta(prev, next);
// → [{ op: "set", index: 3, value: "X" }]

const restored = merge(prev, changes);
// → ["X","","O","X","","","","",""]
```

Object deltas work the same way:

```js
const a = { score: 10, name: "Alice" };
const b = { score: 15, name: "Alice" };

const d = delta(a, b);  // → { score: 15 }
const r = merge(a, d);  // → { score: 15, name: "Alice" }
```

### Hidden fields

`hidden` extracts all `_`-prefixed keys from an object (mutating it in place) and returns the extracted subtree. Useful for stripping server-only data before broadcasting to clients.

```js
import { hidden, unhidden } from "acos-json-encoder";

const state = {
  turn: 1,
  _secret: "xyz",
  players: [{ id: 1, _hand: ["card1", "card2"] }, { id: 2 }]
};

const priv = hidden(state);
// priv  → { _secret: "xyz", players: [{ _hand: ["card1","card2"] }, null] }
// state → { turn: 1, players: [{ id: 1 }, { id: 2 }] }

// Merge private data back in for a specific player
const playerView = unhidden(state, priv, 0);
```

### Delta API

#### `delta(from, to)`
Returns the minimal delta between two values, or `undefined` if equal.

#### `merge(from, delta)`
Apply a delta returned by `delta()` and return the patched value. Does not mutate `from`.

#### `hidden(obj)`
Extracts `_`-prefixed keys from `obj` (mutated in place). Returns the hidden subtree or `undefined`.

#### `unhidden(obj, hiddenData, [index])`
Merges hidden data back into an object or a specific array element.

