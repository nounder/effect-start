import * as HttpMethod from "@effect/platform/HttpMethod"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"
import type { YieldWrap } from "effect/Utils"

export {
  pipe,
} from "effect/Function"

type RouteModule = typeof import("./Route.ts")

/**
 * 'this' argument type for {@link RouteBuilder} functions.
 * Its value depend on how the function is called as described below.
 */
type Self =
  /**
   * Called as {@link RouteSet} method:
   *
   * @example
   * ```ts
   * let route: Route
   *
   * route.text("Hello")
   *
   * ```
   */
  | RouteSet.Default
  | RouteSet<Route.Empty, RouteSchemas>
  /**
   * Called from namespaced import.
   *
   * @example
   * ```ts
   * import * as Route from "./Route.ts"
   *
   * let route: Route
   *
   * Route.text("Hello")
   *
   * ```
   */
  | RouteModule
  /**
   * Called directly from exported function.
   * Disencouraged but possible.
   *
   * @example
   * ```ts
   * import { text } from "./Route.ts"
   *
   * text("Hello")
   *
   * ```
   */
  | undefined

const TypeId: unique symbol = Symbol.for("effect-start/Route")
const RouteSetTypeId: unique symbol = Symbol.for("effect-start/RouteSet")

export type RouteMethod =
  | "*"
  | HttpMethod.HttpMethod

export type RoutePattern = `/${string}`

/**
 * Route media type used for content negotiation.
 * This allows to create routes that serve different media types
 * for the same path & method, depending on the `Accept` header
 * of the request.
 */
export type RouteMedia =
  | "*"
  | "text/plain"
  | "text/html"
  | "application/json"

/**
 * A handler that produces a raw value.
 * The value will be rendered to an HttpServerResponse by RouteRender
 * based on the route's media type.
 */
export type RouteHandler<
  A = unknown,
  E = any,
  R = any,
> = Effect.Effect<A, E, R>

/**
 * Helper type for a value that can be a single item or an array.
 */
export type OneOrMany<T> = T | T[] | readonly T[]

export type RouteSchemas = {
  readonly PathParams?: Schema.Struct<any>
  readonly UrlParams?: Schema.Struct<any>
  readonly Payload?: Schema.Schema.Any
  readonly Success?: Schema.Schema.Any
  readonly Error?: Schema.Schema.Any
  readonly Headers?: Schema.Struct<any>
}

export namespace RouteSchemas {
  export type Empty = {
    readonly PathParams?: never
    readonly UrlParams?: never
    readonly Payload?: never
    readonly Success?: never
    readonly Error?: never
    readonly Headers?: never
  }
}

export interface Route<
  out Method extends RouteMethod = "*",
  out Media extends RouteMedia = "*",
  out Handler extends RouteHandler = RouteHandler,
  out Schemas extends RouteSchemas = RouteSchemas.Empty,
> extends RouteSet<[Route.Default], Schemas> {
  [TypeId]: typeof TypeId
  readonly method: Method
  readonly media: Media
  readonly handler: Handler
  readonly schemas: Schemas
}

/**
 * Describes a single route that varies by method & media type.
 *
 * Implements {@link RouteSet} interface that contains itself.
 */
export namespace Route {
  export type Data<
    Method extends RouteMethod = RouteMethod,
    Media extends RouteMedia = RouteMedia,
    Handler extends RouteHandler = RouteHandler,
    Schemas extends RouteSchemas = RouteSchemas.Empty,
  > = {
    readonly method: Method
    readonly media: Media
    readonly handler: Handler
    readonly schemas: Schemas
  }

  export type Default = Route<
    RouteMethod,
    RouteMedia,
    RouteHandler,
    RouteSchemas
  >

  export type Tuple = readonly [Default, ...Default[]]

  export type Empty = readonly []

  export type Proto =
    & Pipeable.Pipeable
    & {
      [TypeId]: typeof TypeId
    }
}

/**
 * Consists of function to build {@link RouteSet}.
 * This should include all exported functions in this module ({@link RouteModule})
 * that have `this` as {@link Self}.
 *
 * Method functions, like {@link post}, modify the method of existing routes.
 * Media functions, like {@link json}, create new routes with specific media type.
 */
type RouteBuilder = {
  post: typeof post
  get: typeof get
  put: typeof put
  patch: typeof patch
  del: typeof del
  options: typeof options
  head: typeof head

  text: typeof text
  html: typeof html
  json: typeof json

  schemaPathParams: typeof schemaPathParams
  schemaUrlParams: typeof schemaUrlParams
  schemaPayload: typeof schemaPayload
  schemaSuccess: typeof schemaSuccess
  schemaError: typeof schemaError
  schemaHeaders: typeof schemaHeaders
}

/**
 * Set of one or many {@link Route} with chainable builder functions
 * to modify the set or add new routes.
 */
export type RouteSet<
  M extends ReadonlyArray<Route.Default>,
  Schemas extends RouteSchemas = RouteSchemas.Empty,
> =
  & Pipeable.Pipeable
  & RouteSet.Instance<M, Schemas>
  & {
    [RouteSetTypeId]: typeof RouteSetTypeId
  }
  & RouteBuilder

export namespace RouteSet {
  export type Instance<
    M extends ReadonlyArray<Route.Default> = Route.Tuple,
    Schemas extends RouteSchemas = RouteSchemas.Empty,
  > = {
    set: M
    schema: Schemas
  }

  export type Default = RouteSet<Route.Tuple, RouteSchemas>

  export type Proto =
    & {
      [RouteSetTypeId]: typeof RouteSetTypeId
    }
    & RouteBuilder
}

export const post = makeMethodModifier("POST")
export const get = makeMethodModifier("GET")
export const put = makeMethodModifier("PUT")
export const patch = makeMethodModifier("PATCH")
export const del = makeMethodModifier("DELETE")
export const options = makeMethodModifier("OPTIONS")
export const head = makeMethodModifier("HEAD")

export const text = makeMediaFunction<"GET", "text/plain", string>(
  "GET",
  "text/plain",
)

export const html = makeMediaFunction<"GET", "text/html", string | JsxObject>(
  "GET",
  "text/html",
)

export const json = makeMediaFunction<"GET", "application/json", JsonValue>(
  "GET",
  "application/json",
)

/**
 * Schema type that accepts string-encoded input.
 * Used for path parameters which are always strings.
 */
type StringEncodedSchema =
  | Schema.Schema<any, string, any>
  // TODO: we accept PropertySignature to support Schema.optional
  // not great but Effect 4 should be better about it
  | Schema.PropertySignature.All

/**
 * Schema type that accepts string or string array encoded input.
 * Used for URL params and headers which can have multiple values.
 */
type StringOrArrayEncodedSchema =
  | Schema.Schema<any, OneOrMany<string>, any>
  | Schema.PropertySignature.All

/**
 * Helper type to extract the Encoded type from a Schema.
 */
type GetEncoded<S> = S extends { Encoded: infer E } ? E : never

/**
 * Check if a schema's encoded type is string.
 */
type IsStringEncoded<S> = S extends Schema.PropertySignature.All ? true
  : GetEncoded<S> extends string ? true
  : false

/**
 * Check if a schema's encoded type is string or string array.
 */
type IsStringOrArrayEncoded<S> = S extends Schema.PropertySignature.All ? true
  : GetEncoded<S> extends OneOrMany<string> ? true
  : false

/**
 * Validate that all fields have string-encoded schemas.
 */
type ValidateStringEncodedFields<T extends Record<PropertyKey, any>> = {
  [K in keyof T]: IsStringEncoded<T[K]> extends true ? T[K]
    : StringEncodedSchema
}

/**
 * Validate that all fields have string or array-encoded schemas.
 */
type ValidateStringOrArrayEncodedFields<T extends Record<PropertyKey, any>> = {
  [K in keyof T]: IsStringOrArrayEncoded<T[K]> extends true ? T[K]
    : StringOrArrayEncodedSchema
}

function makeSingleStringSchemaModifier<
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

function makeMultiStringSchemaModifier<
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

function makeUnionSchemaModifier<
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

export const schemaPathParams = makeSingleStringSchemaModifier("PathParams")
export const schemaUrlParams = makeMultiStringSchemaModifier("UrlParams")
export const schemaHeaders = makeMultiStringSchemaModifier("Headers")
export const schemaPayload = makeUnionSchemaModifier("Payload")
export const schemaSuccess = makeUnionSchemaModifier("Success")
export const schemaError = makeUnionSchemaModifier("Error")

const SetProto = {
  [RouteSetTypeId]: RouteSetTypeId,

  post,
  get,
  put,
  patch,
  del,
  options,
  head,

  text,
  html,
  json,

  schemaPathParams,
  schemaUrlParams,
  schemaPayload,
  schemaSuccess,
  schemaError,
  schemaHeaders,
} satisfies RouteSet.Proto

const RouteProto = Object.assign(
  Object.create(SetProto),
  {
    [TypeId]: TypeId,

    pipe() {
      return Pipeable.pipeArguments(this, arguments)
    },
  } satisfies Route.Proto,
)

export function isRoute(input: unknown): input is Route {
  return Predicate.hasProperty(input, TypeId)
}

export function isRouteSet(
  input: unknown,
): input is RouteSet.Default {
  return Predicate.hasProperty(input, RouteSetTypeId)
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
    [key: string]: JsonValue
  }

/**
 * Constructs a URL from HttpServerRequest.
 * Handles relative URLs by using headers to determine the base URL.
 */
function makeUrlFromRequest(
  request: HttpServerRequest.HttpServerRequest,
): URL {
  const origin = request.headers.origin
    ?? request.headers.host
    ?? "http://localhost"
  const protocol = request.headers["x-forwarded-proto"] ?? "http"
  const host = request.headers.host ?? "localhost"
  const base = origin.startsWith("http")
    ? origin
    : `${protocol}://${host}`
  return new URL(request.url, base)
}

type RouteContextDecoded = {
  readonly pathParams?: Record<string, any>
  readonly urlParams?: Record<string, any>
  readonly payload?: any
  readonly headers?: Record<string, any>
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
 * Context passed to route handler generator functions.
 */
export type RouteContext<
  Input extends RouteContextDecoded = {},
> = {
  request: HttpServerRequest.HttpServerRequest
  get url(): URL
  children: any | undefined
  slots: Record<string, string>
} & Input

/**
 * Extracts fields from a Schema.Struct or returns never if not a struct.
 */
type ExtractStructFields<S> = S extends Schema.Struct<infer Fields> ? Fields
  : never

/**
 * Merges two RouteSchemas types.
 * For PathParams, UrlParams, and Headers: merges struct fields.
 * For Payload, Success, and Error: creates Schema.Union.
 */
type MergeSchemas<
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
function mergeSchemas<
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

export function make<
  Method extends RouteMethod = "*",
  Media extends RouteMedia = "*",
  Handler extends RouteHandler = never,
  Schemas extends RouteSchemas = RouteSchemas.Empty,
>(
  input: Route.Data<
    Method,
    Media,
    Handler,
    Schemas
  >,
): Route<
  Method,
  Media,
  Handler,
  Schemas
> {
  const route = Object.assign(
    Object.create(RouteProto),
    {
      set: [],
      // @ts-expect-error: assigned below
      schemas: input.schemas,
      method: input.method,
      media: input.media,
      handler: input.handler,
    } satisfies Route.Data,
  )

  route.set = [
    route,
  ]
  route.schemas = input.schemas

  return route
}

function makeSet<
  M extends ReadonlyArray<Route.Default>,
  Schemas extends RouteSchemas = RouteSchemas.Empty,
>(
  routes: M,
  schema: Schemas = {} as Schemas,
): RouteSet<M, Schemas> {
  return Object.assign(
    Object.create(SetProto),
    {
      set: routes,
      schema,
    },
  ) as RouteSet<M, Schemas>
}

/**
 * Factory function that creates Route for a specific method & media.
 * Accepts Effect, function that returns Effect, and effectful generator.
 */
function makeMediaFunction<
  Method extends HttpMethod.HttpMethod,
  Media extends RouteMedia,
  ExpectedValue,
>(
  method: Method,
  media: Media,
) {
  return function<
    S extends Self,
    A extends ExpectedValue,
    E = never,
    R = never,
  >(
    this: S,
    handler: S extends RouteSet<infer _Routes, infer Schemas> ?
        | Effect.Effect<A, E, R>
        | ((
          context: RouteContext<DecodeRouteSchemas<Schemas>>,
        ) =>
          | Effect.Effect<A, E, R>
          | Generator<YieldWrap<Effect.Effect<A, E, R>>, A, never>)
      :
        | Effect.Effect<A, E, R>
        | ((
          context: RouteContext<{}>,
        ) =>
          | Effect.Effect<A, E, R>
          | Generator<YieldWrap<Effect.Effect<A, E, R>>, A, never>),
  ): S extends RouteSet<infer Routes, infer Schemas> ? RouteSet<[
      ...Routes,
      Route<
        Method,
        Media,
        RouteHandler<A, E, R>,
        Schemas
      >,
    ], Schemas>
    : RouteSet<[
      Route<
        Method,
        Media,
        RouteHandler<A, E, R>,
        RouteSchemas.Empty
      >,
    ], RouteSchemas.Empty>
  {
    const effect = typeof handler === "function"
      ? Effect.gen(function*() {
        const request = yield* HttpServerRequest.HttpServerRequest
        const context: RouteContext = {
          request,
          get url() {
            return makeUrlFromRequest(request)
          },
          children: undefined,
          slots: {},
        }
        const result = handler(context)
        return yield* (typeof result === "object"
            && result !== null
            && Symbol.iterator in result
          ? Effect.gen(() =>
            result as Generator<
              YieldWrap<Effect.Effect<unknown, unknown, unknown>>,
              A,
              never
            >
          )
          : result as Effect.Effect<A, E, R>)
      })
      : handler

    const baseRoutes = isRouteSet(this)
      ? this.set
      : [] as const
    const baseSchema = isRouteSet(this)
      ? this.schema
      : {} as RouteSchemas.Empty

    return makeSet(
      [
        ...baseRoutes,
        make({
          method,
          media,
          handler: effect as RouteHandler<A, E, R>,
          schemas: baseSchema,
        }),
      ] as ReadonlyArray<Route.Default>,
      baseSchema,
    ) as never
  }
}

/**
 * Factory function that changes method in RouteSet.
 */
function makeMethodModifier<
  M extends HttpMethod.HttpMethod,
>(method: M) {
  return function<
    S extends Self,
    T extends Route.Tuple,
    InSchemas extends RouteSchemas,
  >(
    this: S,
    routes: RouteSet<T, InSchemas>,
  ): S extends RouteSet<infer B, infer BaseSchemas>
    // append to existing RouteSet
    ? RouteSet<
      [
        ...B,
        ...{
          [K in keyof T]: T[K] extends Route<
            infer _,
            infer Media,
            infer H,
            infer RouteSchemas
          > ? Route<
              M,
              Media,
              H,
              MergeSchemas<BaseSchemas, RouteSchemas>
            >
            : T[K]
        },
      ],
      BaseSchemas
    >
    // otherwise create new RouteSet
    : RouteSet<
      {
        [K in keyof T]: T[K] extends Route<
          infer _,
          infer Media,
          infer H,
          infer RouteSchemas
        > ? Route<
            M,
            Media,
            H,
            RouteSchemas
          >
          : T[K]
      },
      InSchemas
    >
  {
    const baseRoutes = isRouteSet(this)
      ? this.set
      : [] as const
    const baseSchema = isRouteSet(this)
      ? this.schema
      : {} as RouteSchemas.Empty

    return makeSet(
      [
        ...baseRoutes,
        ...routes.set.map(route => {
          return make({
            ...route,
            method,
            schemas: mergeSchemas(baseSchema, route.schemas),
          })
        }),
      ] as ReadonlyArray<Route.Default>,
      baseSchema,
    ) as never
  }
}

export type JsxObject = {
  type: any
  props: any
}

export function isJsxObject(value: unknown): value is JsxObject {
  return typeof value === "object"
    && value !== null
    && "type" in value
    && "props" in value
}
