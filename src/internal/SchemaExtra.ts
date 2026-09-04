import type * as Schema from "effect/Schema"
import * as SchemaAST from "effect/SchemaAST"

function getBaseSchemaAST(schema: Schema.Constraint): SchemaAST.AST {
  return schema.ast
}

function isOptional(schema: Schema.Constraint): boolean {
  return schema["~type.optionality"] === "optional" ||
    (schema.ast._tag === "Union" && schema.ast.types.some(SchemaAST.isUndefined))
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

function getSchemaTypeName(schema: Schema.Constraint): string {
  const baseAST = getBaseSchemaAST(schema)
  switch (baseAST._tag) {
    case "String":
      return "Schema.String"
    case "Number":
      return "Schema.Number"
    case "Boolean":
      return "Schema.Boolean"
    default:
      return "Schema.String"
  }
}

export function formatSchemaCode<F extends Schema.Struct.Fields>(schema: Schema.Struct<F>): string {
  const fields = schema.fields
  const fieldStrings: Array<string> = []

  for (const key of Object.keys(fields)) {
    const fieldSchema = fields[key]
    const optional = isOptional(fieldSchema)
    const typeName = getSchemaTypeName(fieldSchema)
    const fieldStr = optional ? `${key}?: ${typeName}` : `${key}: ${typeName}`
    fieldStrings.push(fieldStr)
  }

  return `{ ${fieldStrings.join(", ")} }`
}
