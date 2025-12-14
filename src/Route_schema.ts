import * as Schema from "effect/Schema"
import type {
  OneOrMany,
  Route,
  RouteSchemas,
  RouteSet,
} from "./Route.ts"
import {
  isRouteSet,
  makeSet,
} from "./Route.ts"

type RouteModule = typeof import("./Route.ts")

type Self =
  | RouteSet.Default
  | RouteSet<Route.Empty, RouteSchemas>
  | RouteModule
  | undefined

/**
 * Schema type that accepts string-encoded input.
 * Used for path parameters which are always strings.
 */
export type StringEncodedSchema =
  | Schema.Schema<any, string, any>
  | Schema.PropertySignature.All

/**
 * Schema type that accepts string or string array encoded input.
 * Used for URL params and headers which can have multiple values.
 */
export type StringOrArrayEncodedSchema =
  | Schema.Schema<any, OneOrMany<string>, any>
  | Schema.PropertySignature.All

/**
 * Helper type to extract the Encoded type from a Schema.
 */
export type GetEncoded<S> = S extends { Encoded: infer E } ? E : never

/**
 * Check if a schema's encoded type is string.
 */
export type IsStringEncoded<S> = S extends Schema.PropertySignature.All ? true
  : GetEncoded<S> extends string ? true
  : false

/**
 * Check if a schema's encoded type is string or string array.
 */
export type IsStringOrArrayEncoded<S> = S extends Schema.PropertySignature.All
  ? true
  : GetEncoded<S> extends OneOrMany<string> ? true
  : false

/**
 * Validate that all fields have string-encoded schemas.
 */
export type ValidateStringEncodedFields<T extends Record<PropertyKey, any>> = {
  [K in keyof T]: IsStringEncoded<T[K]> extends true ? T[K]
    : StringEncodedSchema
}

/**
 * Validate that all fields have string or array-encoded schemas.
 */
export type ValidateStringOrArrayEncodedFields<
  T extends Record<PropertyKey, any>,
> = {
  [K in keyof T]: IsStringOrArrayEncoded<T[K]> extends true ? T[K]
    : StringOrArrayEncodedSchema
}

/**
 * Decode RouteSchemas to make context in media handlers easier to read:
 * - Converts keys from PascalCase to camelCase
 * - Decodes schema types to their Type representation
 */
export type DecodeRouteSchemas<Schemas extends RouteSchemas> =
  & (Schemas["PathParams"] extends Schema.Struct<any> ? {
      pathParams: Schema.Schema.Type<Schemas["PathParams"]>
    }
    : {})
  & (Schemas["UrlParams"] extends Schema.Struct<any> ? {
      urlParams: Schema.Schema.Type<Schemas["UrlParams"]>
    }
    : {})
  & (Schemas["Payload"] extends Schema.Schema.Any ? {
      payload: Schema.Schema.Type<Schemas["Payload"]>
    }
    : {})
  & (Schemas["Headers"] extends Schema.Struct<any> ? {
      headers: Schema.Schema.Type<Schemas["Headers"]>
    }
    : {})

/**
 * Merges two RouteSchemas types.
 * For PathParams, UrlParams, and Headers: merges struct fields.
 * For Payload, Success, and Error: creates Schema.Union.
 */
export type MergeSchemas<
  A extends RouteSchemas,
  B extends RouteSchemas,
> = {
  readonly PathParams: [A["PathParams"], B["PathParams"]] extends [
    Schema.Struct<infer AFields>,
    Schema.Struct<infer BFields>,
  ] ? Schema.Struct<AFields & BFields>
    : A["PathParams"] extends Schema.Struct<any> ? A["PathParams"]
    : B["PathParams"] extends Schema.Struct<any> ? B["PathParams"]
    : never
  readonly UrlParams: [A["UrlParams"], B["UrlParams"]] extends [
    Schema.Struct<infer AFields>,
    Schema.Struct<infer BFields>,
  ] ? Schema.Struct<AFields & BFields>
    : A["UrlParams"] extends Schema.Struct<any> ? A["UrlParams"]
    : B["UrlParams"] extends Schema.Struct<any> ? B["UrlParams"]
    : never
  readonly Payload: [A["Payload"], B["Payload"]] extends [
    Schema.Schema.Any,
    Schema.Schema.Any,
  ] ? Schema.Union<[A["Payload"], B["Payload"]]>
    : A["Payload"] extends Schema.Schema.Any ? A["Payload"]
    : B["Payload"] extends Schema.Schema.Any ? B["Payload"]
    : never
  readonly Success: [A["Success"], B["Success"]] extends [
    Schema.Schema.Any,
    Schema.Schema.Any,
  ] ? Schema.Union<[A["Success"], B["Success"]]>
    : A["Success"] extends Schema.Schema.Any ? A["Success"]
    : B["Success"] extends Schema.Schema.Any ? B["Success"]
    : never
  readonly Error: [A["Error"], B["Error"]] extends [
    Schema.Schema.Any,
    Schema.Schema.Any,
  ] ? Schema.Union<[A["Error"], B["Error"]]>
    : A["Error"] extends Schema.Schema.Any ? A["Error"]
    : B["Error"] extends Schema.Schema.Any ? B["Error"]
    : never
  readonly Headers: [A["Headers"], B["Headers"]] extends [
    Schema.Struct<infer AFields>,
    Schema.Struct<infer BFields>,
  ] ? Schema.Struct<AFields & BFields>
    : A["Headers"] extends Schema.Struct<any> ? A["Headers"]
    : B["Headers"] extends Schema.Struct<any> ? B["Headers"]
    : never
}

/**
 * Runtime function to merge two RouteSchemas.
 * For PathParams, UrlParams, and Headers: merges struct fields.
 * For Payload, Success, and Error: creates Schema.Union.
 */
export function mergeSchemas<
  A extends RouteSchemas,
  B extends RouteSchemas,
>(
  a: A,
  b: B,
): MergeSchemas<A, B> {
  const result: any = {}

  const structKeys: Array<keyof RouteSchemas> = [
    "PathParams",
    "UrlParams",
    "Headers",
  ]

  const unionKeys: Array<keyof RouteSchemas> = [
    "Payload",
    "Success",
    "Error",
  ]

  for (const key of structKeys) {
    if (a[key] && b[key]) {
      const aSchema = a[key]! as Schema.Struct<any>
      const bSchema = b[key]! as Schema.Struct<any>
      const mergedFields = {
        ...aSchema.fields,
        ...bSchema.fields,
      }
      result[key] = Schema.Struct(mergedFields)
    } else if (a[key]) {
      result[key] = a[key]
    } else if (b[key]) {
      result[key] = b[key]
    }
  }

  for (const key of unionKeys) {
    if (a[key] && b[key]) {
      result[key] = Schema.Union(a[key]!, b[key]!)
    } else if (a[key]) {
      result[key] = a[key]
    } else if (b[key]) {
      result[key] = b[key]
    }
  }

  return result
}

export function makeSingleStringSchemaModifier<
  K extends string,
>(key: K) {
  return function<
    S extends Self,
    const Fields extends Record<PropertyKey, any>,
  >(
    this: S,
    fieldsOrSchema: Fields extends Schema.Struct<any> ? Fields
      : ValidateStringEncodedFields<Fields>,
  ): S extends RouteSet<infer Routes, infer Schemas> ? RouteSet<
      Routes,
      & Schemas
      & {
        [P in K]: Fields extends Schema.Struct<infer F> ? Schema.Struct<F>
          : Schema.Struct<
            Fields extends Record<PropertyKey, infer _> ? Fields : never
          >
      }
    >
    : RouteSet<
      [],
      {
        [P in K]: Fields extends Schema.Struct<infer F> ? Schema.Struct<F>
          : Schema.Struct<
            Fields extends Record<PropertyKey, infer _> ? Fields : never
          >
      }
    >
  {
    const baseRoutes = isRouteSet(this)
      ? this.set
      : [] as const
    const baseSchema = isRouteSet(this)
      ? this.schema
      : {} as RouteSchemas.Empty

    const schema = Schema.isSchema(fieldsOrSchema)
      ? fieldsOrSchema
      : Schema.Struct(fieldsOrSchema as Schema.Struct.Fields)

    return makeSet(
      baseRoutes as ReadonlyArray<Route.Default>,
      {
        ...baseSchema,
        [key]: schema,
      },
    ) as never
  }
}

export function makeMultiStringSchemaModifier<
  K extends string,
>(key: K) {
  return function<
    S extends Self,
    const Fields extends Record<PropertyKey, any>,
  >(
    this: S,
    fieldsOrSchema: Fields extends Schema.Struct<any> ? Fields
      : ValidateStringOrArrayEncodedFields<Fields>,
  ): S extends RouteSet<infer Routes, infer Schemas> ? RouteSet<
      Routes,
      & Schemas
      & {
        [P in K]: Fields extends Schema.Struct<infer F> ? Schema.Struct<F>
          : Schema.Struct<
            Fields extends Record<PropertyKey, infer _> ? Fields : never
          >
      }
    >
    : RouteSet<
      [],
      {
        [P in K]: Fields extends Schema.Struct<infer F> ? Schema.Struct<F>
          : Schema.Struct<
            Fields extends Record<PropertyKey, infer _> ? Fields : never
          >
      }
    >
  {
    const baseRoutes = isRouteSet(this)
      ? this.set
      : [] as const
    const baseSchema = isRouteSet(this)
      ? this.schema
      : {} as RouteSchemas.Empty

    const schema = Schema.isSchema(fieldsOrSchema)
      ? fieldsOrSchema
      : Schema.Struct(fieldsOrSchema as Schema.Struct.Fields)

    return makeSet(
      baseRoutes as ReadonlyArray<Route.Default>,
      {
        ...baseSchema,
        [key]: schema,
      },
    ) as never
  }
}

export function makeUnionSchemaModifier<
  K extends "Payload" | "Success" | "Error",
>(key: K) {
  return function<
    S extends Self,
    Fields extends Schema.Struct.Fields | Schema.Schema.Any,
  >(
    this: S,
    fieldsOrSchema: Fields,
  ): S extends RouteSet<infer Routes, infer Schemas> ? RouteSet<
      Routes,
      & Schemas
      & {
        [P in K]: Fields extends Schema.Schema.Any ? Fields
          : Fields extends Schema.Struct.Fields ? Schema.Struct<Fields>
          : never
      }
    >
    : RouteSet<
      [],
      {
        [P in K]: Fields extends Schema.Schema.Any ? Fields
          : Fields extends Schema.Struct.Fields ? Schema.Struct<Fields>
          : never
      }
    >
  {
    const baseRoutes = isRouteSet(this)
      ? this.set
      : [] as const
    const baseSchema = isRouteSet(this)
      ? this.schema
      : {} as RouteSchemas.Empty

    const schema = Schema.isSchema(fieldsOrSchema)
      ? fieldsOrSchema
      : Schema.Struct(fieldsOrSchema as Schema.Struct.Fields)

    return makeSet(
      baseRoutes as ReadonlyArray<Route.Default>,
      {
        ...baseSchema,
        [key]: schema,
      },
    ) as never
  }
}
