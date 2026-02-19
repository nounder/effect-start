import type * as Schema from "effect/Schema"
import * as SchemaAST from "effect/SchemaAST"

function getBaseSchemaAST(schema: Schema.Schema.Any): SchemaAST.AST {
  let current = schema.ast

  while (SchemaAST.isRefinement(current) || SchemaAST.isTransformation(current)) {
    current = current.from
  }

  return current
}

function isOptional(schema: Schema.Schema.Any): boolean {
  const ast = schema.ast

  if (ast._tag === "Union") {
    return ast.types.some((t: SchemaAST.AST) => t._tag === "UndefinedKeyword")
  }

  return false
}

export function schemaEqual(
  userSchema: Schema.Struct<any> | undefined,
  expectedSchema: Schema.Struct<any> | null,
): boolean {
  if (!userSchema && !expectedSchema) {
    return true
  }
  if (!userSchema || !expectedSchema) {
    return false
  }

  const userFields = userSchema.fields
  const expectedFields = expectedSchema.fields

  const userKeys = Object.keys(userFields).sort()
  const expectedKeys = Object.keys(expectedFields).sort()

  if (userKeys.length !== expectedKeys.length) {
    return false
  }

  for (let i = 0; i < userKeys.length; i++) {
    if (userKeys[i] !== expectedKeys[i]) {
      return false
    }
  }

  for (const key of userKeys) {
    const userFieldSchema = userFields[key]
    const expectedFieldSchema = expectedFields[key]

    const userOptional = isOptional(userFieldSchema)
    const expectedOptional = isOptional(expectedFieldSchema)

    if (userOptional !== expectedOptional) {
      return false
    }

    const userBaseAST = getBaseSchemaAST(userFieldSchema)
    const expectedBaseAST = getBaseSchemaAST(expectedFieldSchema)

    if (userBaseAST._tag !== expectedBaseAST._tag) {
      return false
    }
  }

  return true
}

function getSchemaTypeName(schema: Schema.Schema.Any): string {
  const baseAST = getBaseSchemaAST(schema)
  switch (baseAST._tag) {
    case "StringKeyword":
      return "Schema.String"
    case "NumberKeyword":
      return "Schema.Number"
    case "BooleanKeyword":
      return "Schema.Boolean"
    default:
      return "Schema.String"
  }
}

export function formatSchemaCode(schema: Schema.Struct<any>): string {
  const fields = schema.fields
  const fieldStrings: Array<string> = []

  for (const [key, fieldSchema] of Object.entries(fields)) {
    const optional = isOptional(fieldSchema)
    const typeName = getSchemaTypeName(fieldSchema)
    const fieldStr = optional ? `${key}?: ${typeName}` : `${key}: ${typeName}`
    fieldStrings.push(fieldStr)
  }

  return `{ ${fieldStrings.join(", ")} }`
}
