import type * as HttpMethod from "@effect/platform/HttpMethod"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"
import {
  makeMediaFunction,
  makeMethodModifier,
} from "./Route_builder.ts"
import {
  type DecodeRouteSchemas,
  makeMultiStringSchemaModifier,
  makeSingleStringSchemaModifier,
  makeUnionSchemaModifier,
  type MergeSchemas,
  mergeSchemas,
} from "./Route_schema.ts"

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
      const selectedRoute = RouteRender.selectRouteByMedia(allRoutes, accept)

      if (selectedRoute) {
        return yield* RouteRender.render(selectedRoute, context)
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
