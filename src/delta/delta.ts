/**
 * Position-based array delta and merge.
 *
 * Change operations
 * -----------------
 * { op: 'resize', length: number }          – truncate or set array length
 * { op: 'set',   index: number, value: any } – replace or recursively merge an element
 */


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObject(x: unknown): x is Record<string, unknown> {
    return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function deepEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// Object delta (supports nested use)
// ---------------------------------------------------------------------------

function objectDelta(
    from: Record<string, any>,
    to: Record<string, any>
): Record<string, any> | undefined {
    const result: Record<string, any> = {};

    for (const key of Object.keys(to)) {
        if (!(key in from)) {
            result[key] = to[key];
            continue;
        }
        const child = valueDelta(from[key], to[key]);
        if (child !== undefined) {
            result[key] = child;
        }
    }

    const deleted = Object.keys(from).filter((k) => !(k in to));
    if (deleted.length > 0) result['$deleted'] = deleted;

    return Object.keys(result).length > 0 ? result : undefined;
}

// Returns the minimal delta between two arbitrary values, or undefined if equal.
function valueDelta(from: any, to: any): any {
    if (deepEqual(from, to)) return undefined;

    if (Array.isArray(from) && Array.isArray(to)) {
        const changes = arrayDelta(from, to);
        return changes.length > 0 ? changes : undefined;
    }

    if (isPlainObject(from) && isPlainObject(to)) {
        return objectDelta(from, to);
    }

    return to; // primitive or type-mismatch replacement
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Push a set op, coalescing adjacent identical values into fill and others into setrange. */
function pushSet(changes: ArrayChange[], index: number, value: any): void {
    const last = changes[changes.length - 1];

    // Extend an existing fill run if the value matches.
    if (last && last.op === 'fill' && last.index + last.length === index && deepEqual(last.value, value)) {
        last.length++;
        return;
    }

    // Extending a setrange: if the new value matches the last element, split off a fill run.
    if (last && last.op === 'setrange' && last.index + last.values.length === index) {
        const lastVal = last.values[last.values.length - 1];
        if (deepEqual(lastVal, value)) {
            // Remove the trailing duplicate from the setrange and start a fill there.
            last.values.pop();
            const fillIndex = index - 1;
            if (last.values.length === 0) {
                changes.pop();
            } else if (last.values.length === 1) {
                changes[changes.length - 1] = { op: 'set', index: last.index, value: last.values[0] };
            }
            changes.push({ op: 'fill', index: fillIndex, length: 2, value });
        } else {
            last.values.push(value);
        }
        return;
    }

    // Promote a lone set: identical value → fill, different value → setrange.
    if (last && last.op === 'set' && last.index + 1 === index) {
        if (deepEqual(last.value, value)) {
            changes[changes.length - 1] = { op: 'fill', index: last.index, length: 2, value };
        } else {
            changes[changes.length - 1] = { op: 'setrange', index: last.index, values: [last.value, value] };
        }
        return;
    }

    changes.push({ op: 'set', index, value });
}

// ---------------------------------------------------------------------------
// Public: delta
// ---------------------------------------------------------------------------

/**
 * Generate a minimal delta between any two values.
 * - Both arrays   → ArrayChange[]  (empty array means identical)
 * - Both objects  → object delta   (undefined means identical)
 * - Primitives / type mismatch → the new value, or undefined if identical
 */
export function delta(from: any, to: any): any {
    if (Array.isArray(from) && Array.isArray(to)) {
        const changes = arrayDelta(from, to);
        return changes.length > 0 ? changes : undefined;
    }
    if (isPlainObject(from) && isPlainObject(to)) {
        return objectDelta(from, to);
    }
    return deepEqual(from, to) ? undefined : to;
}

// ---------------------------------------------------------------------------
// Public: arrayDelta
// ---------------------------------------------------------------------------

/**
 * Generate a minimal list of changes that transform `from` into `to`.
 * Returns an empty array when the two arrays are identical.
 */
export function arrayDelta(from: any[], to: any[]): ArrayChange[] {
    const changes: ArrayChange[] = [];

    const maxLen = Math.max(from.length, to.length);

    for (let i = 0; i < maxLen; i++) {
        // Elements beyond `to` – emit a single resize op and stop
        if (i >= to.length) {
            changes.push({ op: 'resize', value: to.length });
            break;
        }

        // New element appended beyond original length
        if (i >= from.length) {
            pushSet(changes, i, to[i]);
            continue;
        }

        if (deepEqual(from[i], to[i])) continue;

        // Try to produce a recursive delta for objects and arrays
        if (Array.isArray(from[i]) && Array.isArray(to[i])) {
            const nested = arrayDelta(from[i], to[i]);
            if (nested.length > 0) {
                changes.push({ op: 'set', index: i, value: nested });
                continue;
            }
        } else if (isPlainObject(from[i]) && isPlainObject(to[i])) {
            const nested = objectDelta(from[i], to[i]);
            if (nested !== undefined) {
                changes.push({ op: 'set', index: i, value: nested });
                continue;
            }
        }

        // Fallback: replace entirely
        pushSet(changes, i, to[i]);
    }

    // // A lone resize never resends element data the receiver already holds,
    // // so it is always more efficient than replace regardless of byte size.
    // const onlyResize = changes.length === 1 && changes[0].op === 'resize';
    // if (!onlyResize && changes.length > 0) {
    //     const changesSize = JSON.stringify(changes).length;
    //     const toSize      = JSON.stringify(to).length;

    //     // If `to` is entirely one repeated value, a single fill from index 0 may beat everything.
    //     if (to.length > 1) {
    //         const first = JSON.stringify(to[0]);
    //         if (to.every((v) => JSON.stringify(v) === first)) {
    //             const fill: ArrayChange[] = [{ op: 'fill', index: 0, length: to.length, value: to[0] }];
    //             if (JSON.stringify(fill).length < Math.min(changesSize, toSize)) {
    //                 return fill;
    //             }
    //         }
    //     }

    //     if (changesSize >= toSize) {
    //         return [{ op: 'replace', values: to }];
    //     }
    // }

    return changes;
}

// ---------------------------------------------------------------------------
// Public: merge
// ---------------------------------------------------------------------------

/**
 * Apply a delta to any value and return the result.
 * - Array `from` + ArrayChange[] delta → arrayMerge
 * - Object `from` + object delta      → objectMerge
 * - Anything else                     → delta replaces from directly
 */
export function merge(from: any, delta: any): any {
    if (Array.isArray(from) && Array.isArray(delta)) {
        return arrayMerge(from, delta as ArrayChange[]);
    }
    if (isPlainObject(from) && isPlainObject(delta)) {
        return objectMerge(from, delta);
    }
    return delta;
}

// ---------------------------------------------------------------------------
// Public: arrayMerge
// ---------------------------------------------------------------------------

/**
 * Apply a delta produced by `arrayDelta` to `from` and return the patched array.
 * `from` is not mutated.
 */
export function arrayMerge(from: any[], changes: ArrayChange[]): any[] {
    const result = [...from];

    for (const change of changes) {
        if (change.op === 'replace') {
            return [...change.values];
        } else if (change.op === 'fill') {
            for (let i = 0; i < change.length; i++) {
                result[change.index + i] = change.value;
            }
        } else if (change.op === 'resize') {
            result.length = change.value;
        } else if (change.op === 'set') {
            const elem = result[change.index];
            if (Array.isArray(elem) && Array.isArray(change.value)) {
                result[change.index] = arrayMerge(elem, change.value);
            } else if (isPlainObject(elem) && isPlainObject(change.value)) {
                result[change.index] = objectMerge(elem, change.value);
            } else {
                result[change.index] = change.value;
            }
        } else if (change.op === 'setrange') {
            for (let i = 0; i < change.values.length; i++) {
                result[change.index + i] = change.values[i];
            }
        }
    }

    return result;
}

function objectMerge(
    from: Record<string, any>,
    delta: Record<string, any>
): Record<string, any> {
    const result = { ...from };

    for (const key of Object.keys(delta)) {
        if (key === '$deleted') {
            for (const k of delta[key]) delete result[k];
            continue;
        }

        const d = delta[key];

        if (Array.isArray(d) && d.length > 0 && isPlainObject(d[0]) && 'op' in (d[0] as any)) {
            result[key] = arrayMerge(result[key] ?? [], d as ArrayChange[]);
        } else if (isPlainObject(result[key]) && isPlainObject(d)) {
            result[key] = objectMerge(result[key], d);
        } else {
            result[key] = d;
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Public: hidden
// ---------------------------------------------------------------------------

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
export function hidden(obj: any): any {
    if (Array.isArray(obj)) {
        const result: any[] = new Array(obj.length).fill(null);
        let hasHidden = false;
        for (let i = 0; i < obj.length; i++) {
            const extracted = hidden(obj[i]);
            if (extracted !== undefined) {
                result[i] = extracted;
                hasHidden = true;
            }
        }
        return hasHidden ? result : undefined;
    }

    if (isPlainObject(obj)) {
        const extracted: Record<string, any> = {};
        for (const key of Object.keys(obj)) {
            if (key[0] === '_') {
                extracted[key] = (obj as Record<string, any>)[key];
                delete (obj as Record<string, any>)[key];
            } else {
                const child = hidden((obj as Record<string, any>)[key]);
                if (child !== undefined) extracted[key] = child;
            }
        }
        return Object.keys(extracted).length > 0 ? extracted : undefined;
    }

    return undefined;
}

// ---------------------------------------------------------------------------
// Public: unhidden
// ---------------------------------------------------------------------------

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
export function unhidden(obj: any, extracted: any): void {
    if (Array.isArray(obj) && Array.isArray(extracted)) {
        for (let i = 0; i < extracted.length; i++) {
            if (extracted[i] !== null && extracted[i] !== undefined) {
                unhidden(obj[i], extracted[i]);
            }
        }
        return;
    }

    if (isPlainObject(obj) && isPlainObject(extracted)) {
        for (const key of Object.keys(extracted as Record<string, any>)) {
            if (key[0] === '_') {
                (obj as Record<string, any>)[key] = (extracted as Record<string, any>)[key];
            } else {
                unhidden((obj as Record<string, any>)[key], (extracted as Record<string, any>)[key]);
            }
        }
    }
}

