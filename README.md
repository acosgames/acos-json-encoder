# ACOS JSON Encoder for Websocket Networking

Efficiently encode your JSON object or array into serialized bytes for primitive types, also includes a string dictionary to reduce bandwidth bytes transmitted to players.

This package should be used in combination with the [acos-json-delta](https://github.com/acosgames/acos-json-delta) to maximize bandwidth reduction.

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
import {encode, decode, createDefaultDict} = require("acos-json-encoder");
```

### Encoding and Decoding example

```js
// example dictionary to match any strings that might appear in JSON
// this will reduce these strings into two bytes when detected
let myDictionary = [
  "name",
  "rank",
  "score",
  "rating",
  "teamid",
  "ready",
  "type",
  "team_o",
  "team_x",
];

// example JSON data to encode/decode
let jsonData = {
  iobYl: {
    name: "Player2326",
    rank: 0,
    score: 0,
    rating: 2636,
    teamid: "team_o",
    ready: true,
    type: "X",
  },
  DjTS3: {
    name: "Player7145",
    rank: 0,
    score: 0,
    rating: 2364,
    teamid: "team_x",
    ready: true,
    type: "O",
  },
};

// set the dictionary to use by default
createDefaultDict(myDictionary);

// encode and serialize the data into bytes
let jsonEncoded = encode(jsonData);

// decode the bytes back into a JSON string
let decoded = decode(jsonEncoded);

// validate the original matches the decoded
if (JSON.stringify(jsonData) == JSON.stringify(decoded)) {
  console.log("Encoding MATCHES");
}

// print byte sizes
console.log("JSON string size: ", JSON.stringify(jsonData).length);
console.log("Encoded JSON size:", jsonEncoded.byteLength);

// -------- output --------------
// Encoding MATCHES
// JSON string size:  211
// Encoded JSON size: 94
```

## Methods

### `createDefaultDict(dictionary)`

Setup the default dictionary to use by this package.

##### Parameters

- **dictionary** (array of strings) - dictionary to use for this encoding.

##### Returns

Dictionary object used internally. You should not need to use it.

.

### `encode(json, [dictionary])`

##### Parameters

- **json** (object or array) - the data you want to encode into bytes
- **dictionary** (array of strings) - OPTIONAL dictionary to use for this encoding.

Encode the JSON data with optional dictionary. If no dictionary specified will use the one set using `createDefaultDict`.

##### Returns

A byte array of type **Uint8Array**. Compatible with WebSocket's send using bytes instead of string.

.

### `decode(bytes, [dictionary])`

##### Parameters

- **bytes** (byte array) - the byte data to decode into JSON data
- **dictionary** (array of strings) - OPTIONAL dictionary to use for this encoding.

Decode the byte array with optional dictionary. If no dictionary specified will use the one set using `createDefaultDict`.

##### Returns

JSON data. Compatible with WebSocket's receive callback using the message raw data in byte format.
