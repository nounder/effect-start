import * as HttpMethod from "@effect/platform/HttpMethod"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"
import type { YieldWrap } from "effect/Utils"
import * as RouteRender from "./RouteRender.ts"

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
const RouteLayerTypeId: unique symbol = Symbol.for("effect-start/RouteLayer")

export type RouteMethod =
  | "*"
  | HttpMethod.HttpMethod

// TODO: This should be a RouterPattern and moved to its file?
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
 * A handler function that produces a raw value.
 * The value will be rendered to an HttpServerResponse by RouteRender
 * based on the route's media type.
 *
 * Receives RouteContext which includes an optional next() for layers.
 */
export type RouteHandler<
  A = unknown,
  E = any,
  R = any,
> = (context: RouteContext) => Effect.Effect<A, E, R>

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
  delete: typeof _delete
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

/**
 * Type for HTTP middleware function
 */
export type HttpMiddlewareFunction = ReturnType<typeof HttpMiddleware.make>

/**
 * Marker type for route middleware specification.
 * Used to distinguish middleware from routes in Route.layer() arguments.
 */
export interface RouteMiddleware {
  readonly _tag: "RouteMiddleware"
  readonly middleware: HttpMiddlewareFunction
}

export type RouteLayer<
  M extends ReadonlyArray<Route.Default> = ReadonlyArray<Route.Default>,
  Schemas extends RouteSchemas = RouteSchemas.Empty,
> =
  & Pipeable.Pipeable
  & {
    [RouteLayerTypeId]: typeof RouteLayerTypeId
    [RouteSetTypeId]: typeof RouteSetTypeId
    set: M
    schema: Schemas
    httpMiddleware?: HttpMiddlewareFunction
  }
  & RouteBuilder

export const isRouteLayer = (u: unknown): u is RouteLayer =>
  Predicate.hasProperty(u, RouteLayerTypeId)

/**
 * Check if two routes match based on method and media type.
 * Returns true if both method and media type match, accounting for wildcards.
 */
export function matches(
  a: Route.Default,
  b: Route.Default,
): boolean {
  const methodMatches = a.method === "*"
    || b.method === "*"
    || a.method === b.method

  const mediaMatches = a.media === "*"
    || b.media === "*"
    || a.media === b.media

  return methodMatches && mediaMatches
}

export const post = makeMethodModifier("POST")
export const get = makeMethodModifier("GET")
export const put = makeMethodModifier("PUT")
export const patch = makeMethodModifier("PATCH")
export const options = makeMethodModifier("OPTIONS")
export const head = makeMethodModifier("HEAD")
const _delete = makeMethodModifier("DELETE")
export {
  _delete as delete,
}

export const text = makeMediaFunction<"GET", "text/plain", string>(
  "GET",
  "text/plain",
)

export const html = makeMediaFunction<
  "GET",
  "text/html",
  string | GenericJsxObject
>(
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
  delete: _delete,
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

const RouteLayerProto = Object.assign(
  Object.create(SetProto),
  {
    [RouteLayerTypeId]: RouteLayerTypeId,
  },
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
 * Context passed to route handler functions.
 *
 * @template {Input} Decoded schema values (pathParams, urlParams, etc.)
 * @template {Next}  Return type of next() based on media type
 */
export type RouteContext<
  Input extends RouteContextDecoded = {},
  Next = unknown,
> =
  & {
    request: HttpServerRequest.HttpServerRequest
    get url(): URL
    slots: Record<string, string>
    next: <E = unknown, R = unknown>() => Effect.Effect<Next, E, R>
  }
  & Input

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

type HandlerInput<A, E, R> =
  | A
  | Effect.Effect<A, E, R>
  | ((context: RouteContext) =>
    | Effect.Effect<A, E, R>
    | Generator<YieldWrap<Effect.Effect<A, E, R>>, A, never>)

function normalizeHandler<A, E, R>(
  handler: HandlerInput<A, E, R>,
): RouteHandler<A, E, R> {
  if (typeof handler === "function") {
    return (context): Effect.Effect<A, E, R> => {
      const result = (handler as Function)(context)
      if (Effect.isEffect(result)) {
        return result as Effect.Effect<A, E, R>
      }
      return Effect.gen(() => result) as Effect.Effect<A, E, R>
    }
  }
  if (Effect.isEffect(handler)) {
    return () => handler
  }
  return () => Effect.succeed(handler as A)
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
        | A
        | Effect.Effect<A, E, R>
        | ((
          context: RouteContext<DecodeRouteSchemas<Schemas>, ExpectedValue>,
        ) =>
          | Effect.Effect<A, E, R>
          | Generator<YieldWrap<Effect.Effect<A, E, R>>, A, never>)
      :
        | A
        | Effect.Effect<A, E, R>
        | ((context: RouteContext<{}, ExpectedValue>) =>
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
          handler: normalizeHandler(handler),
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

export type GenericJsxObject = {
  type: any
  props: any
}

export function isGenericJsxObject(value: unknown): value is GenericJsxObject {
  return typeof value === "object"
    && value !== null
    && "type" in value
    && "props" in value
}

/**
 * Create HTTP middleware spec for Route.layer().
 * Multiple middleware can be composed by passing multiple Route.http() to Route.layer().
 *
 * @example
 * Route.layer(
 *   Route.http(middleware1),
 *   Route.http(middleware2),
 *   Route.http(middleware3)
 * )
 */
export function http(
  middleware: HttpMiddlewareFunction,
): RouteMiddleware {
  return {
    _tag: "RouteMiddleware",
    middleware,
  }
}

/**
 * Create a RouteLayer from routes and middleware.
 *
 * Accepts:
 * - Route.http(middleware) - HTTP middleware to apply to all child routes
 * - Route.html/text/json/etc handlers - Wrapper routes that receive props.children
 * - Other RouteSets - Routes to include in the layer
 *
 * Multiple middleware are composed in order - first middleware wraps second, etc.
 * Routes in the layer act as wrappers for child routes with matching method + media type.
 *
 * @example
 * Route.layer(
 *   Route.http(loggingMiddleware),
 *   Route.http(authMiddleware),
 *   Route.html(function*(props) {
 *     return <html><body>{props.children}</body></html>
 *   })
 * )
 */
export function layer(
  ...items: Array<RouteMiddleware | RouteSet.Default>
): RouteLayer {
  const routeMiddleware: RouteMiddleware[] = []
  const routeSets: RouteSet.Default[] = []

  for (const item of items) {
    if ("_tag" in item && item._tag === "RouteMiddleware") {
      routeMiddleware.push(item)
    } else if (isRouteSet(item)) {
      routeSets.push(item)
    }
  }

  const layerRoutes: Route.Default[] = []

  for (const routeSet of routeSets) {
    layerRoutes.push(...routeSet.set)
  }

  const middlewareFunctions = routeMiddleware.map((spec) => spec.middleware)
  const httpMiddleware = middlewareFunctions.length === 0
    ? undefined
    : middlewareFunctions.length === 1
    ? middlewareFunctions[0]
    : (app: any) => middlewareFunctions.reduceRight((acc, mw) => mw(acc), app)

  return Object.assign(
    Object.create(RouteLayerProto),
    {
      set: layerRoutes,
      schema: {},
      httpMiddleware,
    },
  )
}

/**
 * Extract method union from a RouteSet's routes
 */

type ExtractMethods<T extends ReadonlyArray<Route.Default>> =
  T[number]["method"]

/**
 * Extract media union from a RouteSet's routes
 */
type ExtractMedia<T extends ReadonlyArray<Route.Default>> = T[number]["media"]

/**
 * Merge two RouteSets into one with content negotiation.
 * Properly infers union types for method/media and merges schemas.
 */
export function merge<
  RoutesA extends ReadonlyArray<Route.Default>,
  SchemasA extends RouteSchemas,
  RoutesB extends ReadonlyArray<Route.Default>,
  SchemasB extends RouteSchemas,
>(
  self: RouteSet<RoutesA, SchemasA>,
  other: RouteSet<RoutesB, SchemasB>,
): RouteSet<
  [
    Route<
      ExtractMethods<RoutesA> | ExtractMethods<RoutesB>,
      ExtractMedia<RoutesA> | ExtractMedia<RoutesB>,
      RouteHandler<HttpServerResponse.HttpServerResponse, any, never>,
      MergeSchemas<SchemasA, SchemasB>
    >,
  ],
  MergeSchemas<SchemasA, SchemasB>
> {
  const allRoutes = [...self.set, ...other.set]
  const mergedSchemas = mergeSchemas(self.schema, other.schema)

  const handler: RouteHandler<HttpServerResponse.HttpServerResponse> = (
    context,
  ) =>
    Effect.gen(function*() {
      const accept = context.request.headers.accept ?? ""

      if (accept.includes("application/json")) {
        const jsonRoute = allRoutes.find((r) => r.media === "application/json")
        if (jsonRoute) {
          return yield* RouteRender.render(jsonRoute, context)
        }
      }

      if (accept.includes("text/plain")) {
        const textRoute = allRoutes.find((r) => r.media === "text/plain")
        if (textRoute) {
          return yield* RouteRender.render(textRoute, context)
        }
      }

      if (
        accept.includes("text/html") || accept.includes("*/*") || !accept
      ) {
        const htmlRoute = allRoutes.find((r) => r.media === "text/html")
        if (htmlRoute) {
          return yield* RouteRender.render(htmlRoute, context)
        }
      }

      const firstRoute = allRoutes[0]
      if (firstRoute) {
        return yield* RouteRender.render(firstRoute, context)
      }

      return HttpServerResponse.empty({ status: 406 })
    })

  return makeSet(
    [
      make({
        method: allRoutes[0]?.method ?? "*",
        media: allRoutes[0]?.media ?? "*",
        handler,
        schemas: mergedSchemas,
      }),
    ] as any,
    mergedSchemas,
  ) as any
}
