import * as HttpApp from "@effect/platform/HttpApp"
import type * as HttpMethod from "@effect/platform/HttpMethod"
import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"
import { GenericJsxObject } from "./Hyper.ts"
import {
  http,
  makeMediaFunction,
  makeMethodModifier,
} from "./Route_builder.ts"
import {
  makeMultiStringSchemaModifier,
  makeSingleStringSchemaModifier,
  makeUnionSchemaModifier,
  type MergeSchemas,
  mergeSchemas,
} from "./Route_schema.ts"

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
   * Called directly from exported function. Don't do it.
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

// TODO: This should be a RouterPattern and moved to its file?
export type RoutePattern = `/${string}`

/**
 * Symbol key for HTTP middleware type discriminant.
 */
export const RouteHttpTypeId: unique symbol = Symbol.for(
  "effect-start/RouteHttpTypeId",
)

/**
 * Function signature for HTTP middleware.
 * Takes an HttpApp and returns an HttpApp or Effect.
 */
export type HttpMiddlewareFunction<E = any, R = any> = <AppE, AppR>(
  app: HttpApp.Default<AppE, AppR>,
) => HttpApp.HttpApp<E | AppE, R | AppR>

/**
 * Type helper to check if all routes in a RouteSet are HttpMiddleware.
 * HTTP middleware routes are characterized by method="*" and media="*".
 */
export type IsHttpMiddlewareRouteSet<RS> = RS extends
  RouteSet<infer Routes, any> ? Routes extends readonly [] ? true
  : Routes extends readonly Route<infer M, infer Media, any, any>[]
    ? M extends "*" ? Media extends "*" ? true
      : false
    : false
  : false
  : false

/**
 * Check if a handler is an HTTP middleware handler.
 */
export function isHttpMiddlewareHandler(h: unknown): boolean {
  return typeof h === "function"
    && RouteHttpTypeId in h
    && (h as Record<symbol, unknown>)[RouteHttpTypeId] === RouteHttpTypeId
}

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

  export type Error<T> = T extends RouteSet<infer Routes, any>
    ? Routes[number] extends Route<any, any, infer H, any>
      ? H extends RouteHandler<any, infer E, any> ? E : never
    : never
    : never

  export type Requirements<T> = T extends RouteSet<infer Routes, any>
    ? Routes[number] extends Route<any, any, infer H, any>
      ? H extends RouteHandler<any, any, infer R> ? R : never
    : never
    : never
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
  http: typeof http

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
 * Check if two routes match based on method and media type.
 * Returns true if both method and media type match, accounting for wildcards.
 */
export function overlaps(
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

export const schemaPathParams = makeSingleStringSchemaModifier("PathParams")

export const schemaUrlParams = makeMultiStringSchemaModifier("UrlParams")
export const schemaHeaders = makeMultiStringSchemaModifier("Headers")
export const schemaPayload = makeUnionSchemaModifier("Payload")
export const schemaSuccess = makeUnionSchemaModifier("Success")
export const schemaError = makeUnionSchemaModifier("Error")

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

export {
  http,
}

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
  http,

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

type RouteContextDecoded = {
  readonly pathParams?: Record<string, any>
  readonly urlParams?: Record<string, any>
  readonly payload?: any
  readonly headers?: Record<string, any>
}

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
    get url(): URL
    slots: Record<string, string>
    next: <E = unknown, R = unknown>() => Effect.Effect<Next, E, R>
  }
  & Input

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

export function makeSet<
  M extends ReadonlyArray<Route.Default> = [],
  Schemas extends RouteSchemas = RouteSchemas.Empty,
>(
  routes: M = [] as unknown as M,
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
 * Merge two RouteSets into one.
 * Combines route arrays.
 *
 * Rules:
 * - Multiple HttpMiddleware routes are allowed (they stack)
 * - Content routes with same method+media are allowed (for route-level middleware)
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
  readonly [...RoutesA, ...RoutesB],
  MergeSchemas<SchemasA, SchemasB>
> {
  const combined = [...self.set, ...other.set]
  const mergedSchemas = mergeSchemas(self.schema, other.schema)
  return makeSet(
    combined as unknown as readonly [...RoutesA, ...RoutesB],
    mergedSchemas,
  )
}
