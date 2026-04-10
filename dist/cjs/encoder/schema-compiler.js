"use strict";
// ─── Schema compiler ──────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileSchema = compileSchema;
/**
 * Compile a raw protocol schema node into a typed CompiledNode tree.
 *
 * A schema node is one of:
 *   "uint" | "int" | "float" | "string" | "boolean" | "null" | "object" | …
 *     → primitive
 *   { $object: { key: schemaNode, … } }
 *     → object  (empty $object falls back to primitive 'object')
 *   { $map: { key: schemaNode, … } }
 *     → map     (empty $map uses primitive 'object' for values)
 *   { $array: schemaNode | record }
 *     → array
 *   { $static: schemaNode | record }
 *     → static
 *   { key: schemaNode, … }   (plain record, implicit $object)
 *     → object  (empty record falls back to primitive 'object')
 */
function compileSchema(schema) {
    if (typeof schema === 'string') {
        if (schema == 'any') {
            return { kind: 'any', type: 'any' };
        }
        return { kind: 'primitive', type: schema };
    }
    if (typeof schema !== 'object' || schema === null) {
        return { kind: 'primitive', type: 'object' };
    }
    if ('$object' in schema) {
        const inner = schema['$object'];
        if (!inner || Object.keys(inner).length === 0) {
            return { kind: 'primitive', type: 'object' };
        }
        return { kind: 'object', mapping: compileFieldMap(inner), fields: compileFields(inner) };
    }
    if ('$map' in schema) {
        const inner = schema['$map'];
        // const valueNode: CompiledNode = (inner && Object.keys(inner).length > 0)
        //     ? compileSchema(inner)
        //     : { kind: 'primitive', type: 'object' };
        return { kind: 'map', mapping: compileFieldMap(inner), fields: compileFields(inner) };
    }
    if ('$enum' in schema) {
        const values = schema['$enum'];
        if (!Array.isArray(values))
            return { kind: 'primitive', type: 'object' };
        return { kind: 'enum', values: values };
    }
    if ('$custom' in schema) {
        const inner = schema['$custom'];
        const defaultNode = (inner !== null && inner !== undefined &&
            (typeof inner === 'string' || Object.keys(inner).length > 0))
            ? compileSchema(inner)
            : { kind: 'any', type: 'any' };
        return { kind: 'custom', node: defaultNode };
    }
    if ('$array' in schema) {
        return { kind: 'array', elementNode: compileElementSchema(schema['$array']) };
    }
    if ('$static' in schema) {
        return { kind: 'static', elementNode: compileElementSchema(schema['$static']) };
    }
    // Plain record → implicit $object
    const keys = Object.keys(schema);
    if (keys.length === 0) {
        return { kind: 'primitive', type: 'object' };
    }
    return { kind: 'object', mapping: compileFieldMap(schema), fields: compileFields(schema) };
}
function compileFieldMap(schema) {
    const map = {};
    let index = 0;
    for (const key of Object.keys(schema)) {
        map[key] = index++;
    }
    return map;
}
function compileFields(schema) {
    return Object.keys(schema).map(key => ({ key, node: compileSchema(schema[key]) }));
}
function compileElementSchema(schema) {
    if (typeof schema === 'string')
        return { kind: 'primitive', type: schema };
    return compileSchema(schema);
}
//# sourceMappingURL=schema-compiler.js.map