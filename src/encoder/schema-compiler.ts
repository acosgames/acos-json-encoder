// ─── Schema compiler ──────────────────────────────────────────────────────────

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
export function compileSchema(schema: any): CompiledNode {
    if (typeof schema === 'string') {
        if( schema == 'any' ) {
            return {kind: 'any', type: 'any'};
        }
        return { kind: 'primitive', type: schema as PrimitiveKind };
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
        if (!Array.isArray(values)) return { kind: 'primitive', type: 'object' };
        return { kind: 'enum', values: values as (string | number)[] };
    }

    if ('$custom' in schema) {
        const inner = schema['$custom'];
        const defaultNode: CompiledNode = (inner !== null && inner !== undefined &&
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

function compileFieldMap(schema: Record<string, any>): { [key: string]: number } {
    const map: { [key: string]: number } = {};
    let index = 0;
    for (const key of Object.keys(schema)) {
        map[key] = index++;
    }
    return map;
}

function compileFields(schema: Record<string, any>): CompiledField[] {
    return Object.keys(schema).map(key => ({ key, node: compileSchema(schema[key]) }));
}

function compileElementSchema(schema: any): CompiledNode {
    if (typeof schema === 'string') return { kind: 'primitive', type: schema as PrimitiveKind };
    return compileSchema(schema);
}
