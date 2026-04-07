/**
 * Position-based array delta and merge.
 *
 * Change operations
 * -----------------
 * { op: 'resize', length: number }          – truncate or set array length
 * { op: 'set',   index: number, value: any } – replace a single element wholesale
 * { op: 'patch', index: number, delta: any } – recursively patch an object or array element
 */
/**
 * Generate a minimal delta between any two values.
 * - Both arrays   → ArrayChange[]  (empty array means identical)
 * - Both objects  → object delta   (undefined means identical)
 * - Primitives / type mismatch → the new value, or undefined if identical
 */
export declare function delta(from: any, to: any): any;
/**
 * Generate a minimal list of changes that transform `from` into `to`.
 * Returns an empty array when the two arrays are identical.
 */
export declare function arrayDelta(from: any[], to: any[]): ArrayChange[];
/**
 * Apply a delta to any value and return the result.
 * - Array `from` + ArrayChange[] delta → arrayMerge
 * - Object `from` + object delta      → objectMerge
 * - Anything else                     → delta replaces from directly
 */
export declare function merge(from: any, delta: any): any;
/**
 * Apply a delta produced by `arrayDelta` to `from` and return the patched array.
 * `from` is not mutated.
 */
export declare function arrayMerge(from: any[], changes: ArrayChange[]): any[];
/**
 * Deep-extracts all `_`-prefixed keys from `obj` (mutating it in place) and
 * returns the extracted data in the same structural shape as the source.
 *
 * - Object keys whose name starts with `_` are removed from `obj` and placed
 *   into the returned structure under the same key.
 * - Non-prefixed keys that contain objects or arrays are recursed into.
 * - Array elements are iterated; only slots with extracted data appear
 *   non-null in the returned array (other slots are `null` to preserve index
 *   alignment). If no element in an array has hidden data, the array is
 *   omitted entirely from the result.
 * - Returns `undefined` when nothing was extracted.
 *
 * @example
 * const state = { id: 1, _token: "abc", players: [{ id: 2, _secret: "xyz" }] };
 * const priv  = hidden(state);
 * // priv  → { _token: "abc", players: [{ _secret: "xyz" }] }
 * // state → { id: 1,          players: [{ id: 2 }]         }
 */
export declare function hidden(obj: any): any;
/**
 * Injects previously extracted hidden data back into `obj` (mutating it in
 * place). This is the inverse of `hidden()`.
 *
 * - `_`-prefixed keys in `extracted` are set directly onto the matching
 *   object in `obj`.
 * - Non-prefixed keys are recursed into to reach nested objects/arrays.
 * - Array slots that are `null` in `extracted` are skipped (no hidden data
 *   was extracted from that element).
 *
 * @example
 * const state = { id: 1, players: [{ id: 2 }] };
 * const priv  = { _token: "abc", players: [{ _secret: "xyz" }] };
 * unhidden(state, priv);
 * // state → { id: 1, _token: "abc", players: [{ id: 2, _secret: "xyz" }] }
 */
export declare function unhidden(obj: any, extracted: any): void;
