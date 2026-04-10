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
export declare function compileSchema(schema: any): CompiledNode;
//# sourceMappingURL=schema-compiler.d.ts.map