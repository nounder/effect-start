import * as HttpMethod from "@effect/platform/HttpMethod"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerRespondable from "@effect/platform/HttpServerRespondable"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"
import type { YieldWrap } from "effect/Utils"
import * as HyperHtml from "./HyperHtml.ts"

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

export type RoutePath = `/${string}`

/**
 * Route media type used for content negotiation.
 * This allows to create routes that serve different media types
 * for the same path & method, depending on the `Accept` header
 * of the request.
 */
type RouteMedia =
  | "*"
  | "text/plain"
  | "text/html"
  | "application/json"

export type RouteHandler<
  A = unknown,
  E = any,
  R = any,
> =
  /**
   * A handler that contains raw value.
   * Can be consumed from other handlers to build more complex responses.
   * For example, a Route can render markdown for API/AI consumption
   * and another Route can wrap it in HTML for browsers.
   */
  | RouteHandler.Value<A, E, R>
  /**
   * A handler returns `HttpServerResponse`.
   * Should not be consumed with caution: if body is a stream,
   * consuming it in another handler may break the stream.
   */
  | RouteHandler.Encoded<E, R>

export namespace RouteHandler {
  export type Value<
    A = unknown,
    E = any,
    R = any,
  > = Effect.Effect<
    {
      [HttpServerRespondable.symbol]: () => Effect.Effect<
        HttpServerResponse.HttpServerResponse,
        E,
        R
      >
      raw: A
    },
    E,
    R
  >

  export type Encoded<E = any, R = any> = Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E,
    R
  >
}

export interface Route<
  out Method extends RouteMethod = "*",
  out Media extends RouteMedia = "*",
  out Handler extends RouteHandler = RouteHandler,
  out SchemaPathParams extends Schema.Schema.Any = never,
  out SchemaUrlParams extends Schema.Schema.Any = never,
  out SchemaPayload extends Schema.Schema.Any = never,
  out SchemaSuccess extends Schema.Schema.Any = never,
  out SchemaError extends Schema.Schema.Any = never,
  out SchemaHeaders extends Schema.Schema.Any = never,
> extends RouteSet<[Route.Default]> {
  [TypeId]: typeof TypeId
  readonly method: Method
  readonly media: Media
  readonly handler: Handler
  readonly schemaPathParams?: SchemaPathParams
  readonly schemaUrlParams?: SchemaUrlParams
  readonly schemaPayload?: SchemaPayload
  readonly schemaSuccess?: SchemaSuccess
  readonly schemaError?: SchemaError
  readonly schemaHeaders?: SchemaHeaders
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
    SchemaPathParams extends Schema.Schema.Any = never,
    SchemaUrlParams extends Schema.Schema.Any = never,
    SchemaPayload extends Schema.Schema.Any = never,
    SchemaSuccess extends Schema.Schema.Any = never,
    SchemaError extends Schema.Schema.Any = never,
    SchemaHeaders extends Schema.Schema.Any = never,
  > = {
    readonly method: Method
    readonly media: Media
    readonly handler: Handler
    readonly schemaPathParams?: SchemaPathParams
    readonly schemaUrlParams?: SchemaUrlParams
    readonly schemaPayload?: SchemaPayload
    readonly schemaSuccess?: SchemaSuccess
    readonly schemaError?: SchemaError
    readonly schemaHeaders?: SchemaHeaders
  }

  export type Default = Route<
    RouteMethod,
    RouteMedia
  >

  export type Tuple<T = Default> = ReadonlyArray<T>

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
  M extends Route.Tuple,
> =
  & Pipeable.Pipeable
  & RouteSet.Instance<M>
  & {
    [RouteSetTypeId]: typeof RouteSetTypeId
  }
  & RouteBuilder

export namespace RouteSet {
  export type Instance<
    M extends Route.Tuple = Route.Tuple,
  > = {
    set: M
    readonly schemaPathParams?: Schema.Schema.Any
    readonly schemaUrlParams?: Schema.Schema.Any
    readonly schemaPayload?: Schema.Schema.Any
    readonly schemaSuccess?: Schema.Schema.Any
    readonly schemaError?: Schema.Schema.Any
    readonly schemaHeaders?: Schema.Schema.Any
  }

  export type Default = RouteSet<Route.Tuple>

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

export const text = makeMediaFunction(
  "GET",
  "text/plain",
  makeValueHandler<string>(HttpServerResponse.text),
)

export const html = makeMediaFunction(
  "GET",
  "text/html",
  makeValueHandler<string | JsxObject>((raw) => {
    // Check if it's a JSX element (has type and props properties)
    if (isJsxObject(raw)) {
      return HttpServerResponse.html(HyperHtml.renderToString(raw))
    }
    return HttpServerResponse.html(raw as string)
  }),
)

export const json = makeMediaFunction(
  "GET",
  "application/json",
  makeValueHandler<JsonValue>((raw) => HttpServerResponse.unsafeJson(raw)),
)

function schemaPathParams<S extends Self>(
  this: S,
  schema: Schema.Schema.Any,
): S extends RouteSet<infer Routes> ? RouteSet<Routes> : RouteSet<[]> {
  const baseSet = isRouteSet(this)
    ? (this as RouteSet.Default)
    : undefined

  const set = baseSet?.set ?? ([] as const)
  const schemasObj: Record<string, any> = {
    schemaPathParams: schema,
  }
  if (baseSet?.schemaUrlParams)
    schemasObj.schemaUrlParams = baseSet.schemaUrlParams
  if (baseSet?.schemaPayload)
    schemasObj.schemaPayload = baseSet.schemaPayload
  if (baseSet?.schemaSuccess)
    schemasObj.schemaSuccess = baseSet.schemaSuccess
  if (baseSet?.schemaError)
    schemasObj.schemaError = baseSet.schemaError
  if (baseSet?.schemaHeaders)
    schemasObj.schemaHeaders = baseSet.schemaHeaders

  return makeSet(schemasObj, ...(set as any)) as any
}

function schemaUrlParams<S extends Self>(
  this: S,
  schema: Schema.Schema.Any,
): S extends RouteSet<infer Routes> ? RouteSet<Routes> : RouteSet<[]> {
  const baseSet = isRouteSet(this)
    ? (this as RouteSet.Default)
    : undefined

  const set = baseSet?.set ?? ([] as const)
  const schemasObj: Record<string, any> = {
    schemaUrlParams: schema,
  }
  if (baseSet?.schemaPathParams)
    schemasObj.schemaPathParams = baseSet.schemaPathParams
  if (baseSet?.schemaPayload)
    schemasObj.schemaPayload = baseSet.schemaPayload
  if (baseSet?.schemaSuccess)
    schemasObj.schemaSuccess = baseSet.schemaSuccess
  if (baseSet?.schemaError)
    schemasObj.schemaError = baseSet.schemaError
  if (baseSet?.schemaHeaders)
    schemasObj.schemaHeaders = baseSet.schemaHeaders

  return makeSet(schemasObj, ...(set as any)) as any
}

function schemaPayload<S extends Self>(
  this: S,
  schema: Schema.Schema.Any,
): S extends RouteSet<infer Routes> ? RouteSet<Routes> : RouteSet<[]> {
  const baseSet = isRouteSet(this)
    ? (this as RouteSet.Default)
    : undefined

  const set = baseSet?.set ?? ([] as const)
  const schemasObj: Record<string, any> = {
    schemaPayload: schema,
  }
  if (baseSet?.schemaPathParams)
    schemasObj.schemaPathParams = baseSet.schemaPathParams
  if (baseSet?.schemaUrlParams)
    schemasObj.schemaUrlParams = baseSet.schemaUrlParams
  if (baseSet?.schemaSuccess)
    schemasObj.schemaSuccess = baseSet.schemaSuccess
  if (baseSet?.schemaError)
    schemasObj.schemaError = baseSet.schemaError
  if (baseSet?.schemaHeaders)
    schemasObj.schemaHeaders = baseSet.schemaHeaders

  return makeSet(schemasObj, ...(set as any)) as any
}

function schemaSuccess<S extends Self>(
  this: S,
  schema: Schema.Schema.Any,
): S extends RouteSet<infer Routes> ? RouteSet<Routes> : RouteSet<[]> {
  const baseSet = isRouteSet(this)
    ? (this as RouteSet.Default)
    : undefined

  const set = baseSet?.set ?? ([] as const)
  const schemasObj: Record<string, any> = {
    schemaSuccess: schema,
  }
  if (baseSet?.schemaPathParams)
    schemasObj.schemaPathParams = baseSet.schemaPathParams
  if (baseSet?.schemaUrlParams)
    schemasObj.schemaUrlParams = baseSet.schemaUrlParams
  if (baseSet?.schemaPayload)
    schemasObj.schemaPayload = baseSet.schemaPayload
  if (baseSet?.schemaError)
    schemasObj.schemaError = baseSet.schemaError
  if (baseSet?.schemaHeaders)
    schemasObj.schemaHeaders = baseSet.schemaHeaders

  return makeSet(schemasObj, ...(set as any)) as any
}

function schemaError<S extends Self>(
  this: S,
  schema: Schema.Schema.Any,
): S extends RouteSet<infer Routes> ? RouteSet<Routes> : RouteSet<[]> {
  const baseSet = isRouteSet(this)
    ? (this as RouteSet.Default)
    : undefined

  const set = baseSet?.set ?? ([] as const)
  const schemasObj: Record<string, any> = {
    schemaError: schema,
  }
  if (baseSet?.schemaPathParams)
    schemasObj.schemaPathParams = baseSet.schemaPathParams
  if (baseSet?.schemaUrlParams)
    schemasObj.schemaUrlParams = baseSet.schemaUrlParams
  if (baseSet?.schemaPayload)
    schemasObj.schemaPayload = baseSet.schemaPayload
  if (baseSet?.schemaSuccess)
    schemasObj.schemaSuccess = baseSet.schemaSuccess
  if (baseSet?.schemaHeaders)
    schemasObj.schemaHeaders = baseSet.schemaHeaders

  return makeSet(schemasObj, ...(set as any)) as any
}

function schemaHeaders<S extends Self>(
  this: S,
  schema: Schema.Schema.Any,
): S extends RouteSet<infer Routes> ? RouteSet<Routes> : RouteSet<[]> {
  const baseSet = isRouteSet(this)
    ? (this as RouteSet.Default)
    : undefined

  const set = baseSet?.set ?? ([] as const)
  const schemasObj: Record<string, any> = {
    schemaHeaders: schema,
  }
  if (baseSet?.schemaPathParams)
    schemasObj.schemaPathParams = baseSet.schemaPathParams
  if (baseSet?.schemaUrlParams)
    schemasObj.schemaUrlParams = baseSet.schemaUrlParams
  if (baseSet?.schemaPayload)
    schemasObj.schemaPayload = baseSet.schemaPayload
  if (baseSet?.schemaSuccess)
    schemasObj.schemaSuccess = baseSet.schemaSuccess
  if (baseSet?.schemaError)
    schemasObj.schemaError = baseSet.schemaError

  return makeSet(schemasObj, ...(set as any)) as any
}

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

/**
 * Context passed to route handler generator functions.
 * Extended with validated schema properties when schemaPathParams, schemaUrlParams,
 * schemaPayload, and schemaHeaders are defined.
 */
export type RouteContext<
  SchemaPathParams extends Schema.Schema.Any = never,
  SchemaUrlParams extends Schema.Schema.Any = never,
  SchemaPayload extends Schema.Schema.Any = never,
  SchemaHeaders extends Schema.Schema.Any = never,
> = {
  request: HttpServerRequest.HttpServerRequest
  get url(): URL
} & (SchemaPathParams extends never ? {} : {
  pathParams: Schema.Schema.Type<SchemaPathParams>
}) & (SchemaUrlParams extends never ? {} : {
  urlParams: Schema.Schema.Type<SchemaUrlParams>
}) & (SchemaPayload extends never ? {} : {
  payload: Schema.Schema.Type<SchemaPayload>
}) & (SchemaHeaders extends never ? {} : {
  headers: Schema.Schema.Type<SchemaHeaders>
})

function make<
  Method extends RouteMethod = "*",
  Media extends RouteMedia = "*",
  Handler extends RouteHandler = never,
  SchemaPathParams extends Schema.Schema.Any = never,
  SchemaUrlParams extends Schema.Schema.Any = never,
  SchemaPayload extends Schema.Schema.Any = never,
  SchemaSuccess extends Schema.Schema.Any = never,
  SchemaError extends Schema.Schema.Any = never,
  SchemaHeaders extends Schema.Schema.Any = never,
>(
  input: Route.Data<
    Method,
    Media,
    Handler,
    SchemaPathParams,
    SchemaUrlParams,
    SchemaPayload,
    SchemaSuccess,
    SchemaError,
    SchemaHeaders
  >,
): Route<
  Method,
  Media,
  Handler,
  SchemaPathParams,
  SchemaUrlParams,
  SchemaPayload,
  SchemaSuccess,
  SchemaError,
  SchemaHeaders
> {
  const routeData: Record<string, any> = {
    set: [],
    method: input.method,
    media: input.media,
    handler: input.handler,
  }

  if (input.schemaPathParams)
    routeData.schemaPathParams = input.schemaPathParams
  if (input.schemaUrlParams)
    routeData.schemaUrlParams = input.schemaUrlParams
  if (input.schemaPayload)
    routeData.schemaPayload = input.schemaPayload
  if (input.schemaSuccess)
    routeData.schemaSuccess = input.schemaSuccess
  if (input.schemaError)
    routeData.schemaError = input.schemaError
  if (input.schemaHeaders)
    routeData.schemaHeaders = input.schemaHeaders

  const route = Object.assign(
    Object.create(RouteProto),
    routeData,
  )

  route.set = [
    route,
  ]

  return route
}

function makeSet<
  M extends Route.Tuple,
>(
  ...routes: M
): RouteSet<M>
function makeSet<
  M extends Route.Tuple,
>(
  schemas: {
    schemaPathParams?: Schema.Schema.Any
    schemaUrlParams?: Schema.Schema.Any
    schemaPayload?: Schema.Schema.Any
    schemaSuccess?: Schema.Schema.Any
    schemaError?: Schema.Schema.Any
    schemaHeaders?: Schema.Schema.Any
  },
  ...routes: M
): RouteSet<M>
function makeSet<
  M extends Route.Tuple,
>(
  schemasOrRoute?: any,
  ...rest: any[]
): RouteSet<M> {
  let schemas = {}
  let routes: M

  // Check if first argument is a schemas object
  if (
    schemasOrRoute && typeof schemasOrRoute === "object"
    && !Array.isArray(schemasOrRoute)
    && !Predicate.hasProperty(schemasOrRoute, TypeId)
    && !Predicate.hasProperty(schemasOrRoute, RouteSetTypeId)
  ) {
    schemas = schemasOrRoute
    routes = rest as M
  } else {
    routes = schemasOrRoute ? [schemasOrRoute, ...rest] : ([] as unknown as M)
  }

  return Object.assign(
    Object.create(SetProto),
    {
      set: routes,
      ...schemas,
    },
  ) as RouteSet<M>
}

/**
 * Factory function that creates Route for a specific method & media.
 * Supports both Effect values and generator functions that receive context.
 */
function makeMediaFunction<
  Method extends HttpMethod.HttpMethod,
  Media extends RouteMedia,
  HandlerFn extends (
    handler: any,
  ) => any,
>(
  method: Method,
  media: Media,
  handlerFn: HandlerFn,
) {
  return function<
    S extends Self,
    A,
    E = never,
    R = never,
  >(
    this: S,
    handler:
      | Effect.Effect<A, E, R>
      | ((
        context: RouteContext<any, any, any, any>,
      ) => Generator<YieldWrap<Effect.Effect<A, E, R>>, A, never>),
  ): S extends RouteSet<infer Routes> ? RouteSet<[
      ...Routes,
      Route<
        Method,
        Media,
        ReturnType<HandlerFn>
      >,
    ]>
    : RouteSet<[
      Route<
        Method,
        Media,
        ReturnType<HandlerFn>
      >,
    ]>
  {
    const baseSet = isRouteSet(this)
      ? (this as RouteSet.Default)
      : undefined

    const effect = typeof handler === "function"
      ? Effect.gen(function*() {
        const request = yield* HttpServerRequest.HttpServerRequest
        const context: RouteContext<any, any, any, any> = {
          request,
          get url() {
            return makeUrlFromRequest(request)
          },
        } as any
        return yield* Effect.gen(() => handler(context))
      })
      : handler

    // Merge schemas from RouteSet to Route
    const mergedSchemas: Record<string, any> = {}
    if (baseSet?.schemaPathParams)
      mergedSchemas.schemaPathParams = baseSet.schemaPathParams
    if (baseSet?.schemaUrlParams)
      mergedSchemas.schemaUrlParams = baseSet.schemaUrlParams
    if (baseSet?.schemaPayload)
      mergedSchemas.schemaPayload = baseSet.schemaPayload
    if (baseSet?.schemaSuccess)
      mergedSchemas.schemaSuccess = baseSet.schemaSuccess
    if (baseSet?.schemaError)
      mergedSchemas.schemaError = baseSet.schemaError
    if (baseSet?.schemaHeaders)
      mergedSchemas.schemaHeaders = baseSet.schemaHeaders

    const schemasForSet: Record<string, any> = {}
    if (baseSet?.schemaPathParams)
      schemasForSet.schemaPathParams = baseSet.schemaPathParams
    if (baseSet?.schemaUrlParams)
      schemasForSet.schemaUrlParams = baseSet.schemaUrlParams
    if (baseSet?.schemaPayload)
      schemasForSet.schemaPayload = baseSet.schemaPayload
    if (baseSet?.schemaSuccess)
      schemasForSet.schemaSuccess = baseSet.schemaSuccess
    if (baseSet?.schemaError)
      schemasForSet.schemaError = baseSet.schemaError
    if (baseSet?.schemaHeaders)
      schemasForSet.schemaHeaders = baseSet.schemaHeaders

    return makeSet(
      Object.keys(schemasForSet).length > 0 ? schemasForSet : {},
      ...(baseSet
        ? baseSet.set
        : []),
      make({
        method,
        media,
        handler: handlerFn(effect as any) as any,
        ...mergedSchemas,
      }),
    ) as any
  }
}

/**
 * Factory to create RouteHandler.Value.
 * Useful for structural handlers like JSON
 * or content that can be embedded in other formats,
 * like text or HTML.
 */
function makeValueHandler<ExpectedRaw = string>(
  responseFn: (raw: ExpectedRaw) => HttpServerResponse.HttpServerResponse,
) {
  return <A extends ExpectedRaw, E = never, R = never>(
    handler: Effect.Effect<A, E, R>,
  ): RouteHandler.Value<A, E, R> => {
    return Effect.gen(function*() {
      const raw = yield* handler

      return {
        [HttpServerRespondable.symbol]: () =>
          Effect.succeed(responseFn(raw as ExpectedRaw)),
        raw,
      }
    }) as RouteHandler.Value<A, E, R>
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
  >(
    this: S,
    routes: RouteSet<T>,
  ): S extends RouteSet<infer B>
    // append to existing RouteSet
    ? RouteSet<
      [
        ...B,
        ...{
          [K in keyof T]: T[K] extends Route<
            infer _,
            infer Media,
            infer H
          > ? Route<
              M,
              Media,
              H
            >
            : T[K]
        },
      ]
    >
    // otherwise create new RouteSet
    : RouteSet<
      {
        [K in keyof T]: T[K] extends Route<
          infer _,
          infer Media,
          infer H
        > ? Route<
            M,
            Media,
            H
          >
          : T[K]
      }
    >
  {
    const baseSet = isRouteSet(this)
      ? (this as RouteSet.Default)
      : undefined
    const baseRoutes = baseSet?.set ?? ([] as const)

    const schemasForSet: Record<string, any> = {}
    if (baseSet?.schemaPathParams)
      schemasForSet.schemaPathParams = baseSet.schemaPathParams
    if (baseSet?.schemaUrlParams)
      schemasForSet.schemaUrlParams = baseSet.schemaUrlParams
    if (baseSet?.schemaPayload)
      schemasForSet.schemaPayload = baseSet.schemaPayload
    if (baseSet?.schemaSuccess)
      schemasForSet.schemaSuccess = baseSet.schemaSuccess
    if (baseSet?.schemaError)
      schemasForSet.schemaError = baseSet.schemaError
    if (baseSet?.schemaHeaders)
      schemasForSet.schemaHeaders = baseSet.schemaHeaders

    return makeSet(
      Object.keys(schemasForSet).length > 0 ? schemasForSet : {},
      ...(baseRoutes as any),
      ...routes.set.map(route => {
        const routeMergedSchemas: Record<string, any> = {}
        const hasOwnProp = (obj: any, prop: string): boolean =>
          Object.prototype.hasOwnProperty.call(obj, prop)

        // Prioritize route own schemas, then routes schemas, then baseSet schemas
        if (hasOwnProp(route, "schemaPathParams"))
          routeMergedSchemas.schemaPathParams = route.schemaPathParams
        else if (hasOwnProp(routes, "schemaPathParams"))
          routeMergedSchemas.schemaPathParams = routes.schemaPathParams
        else if (hasOwnProp(baseSet, "schemaPathParams"))
          routeMergedSchemas.schemaPathParams = baseSet.schemaPathParams

        if (hasOwnProp(route, "schemaUrlParams"))
          routeMergedSchemas.schemaUrlParams = route.schemaUrlParams
        else if (hasOwnProp(routes, "schemaUrlParams"))
          routeMergedSchemas.schemaUrlParams = routes.schemaUrlParams
        else if (hasOwnProp(baseSet, "schemaUrlParams"))
          routeMergedSchemas.schemaUrlParams = baseSet.schemaUrlParams

        if (hasOwnProp(route, "schemaPayload"))
          routeMergedSchemas.schemaPayload = route.schemaPayload
        else if (hasOwnProp(routes, "schemaPayload"))
          routeMergedSchemas.schemaPayload = routes.schemaPayload
        else if (hasOwnProp(baseSet, "schemaPayload"))
          routeMergedSchemas.schemaPayload = baseSet.schemaPayload

        if (hasOwnProp(route, "schemaSuccess"))
          routeMergedSchemas.schemaSuccess = route.schemaSuccess
        else if (hasOwnProp(routes, "schemaSuccess"))
          routeMergedSchemas.schemaSuccess = routes.schemaSuccess
        else if (hasOwnProp(baseSet, "schemaSuccess"))
          routeMergedSchemas.schemaSuccess = baseSet.schemaSuccess

        if (hasOwnProp(route, "schemaError"))
          routeMergedSchemas.schemaError = route.schemaError
        else if (hasOwnProp(routes, "schemaError"))
          routeMergedSchemas.schemaError = routes.schemaError
        else if (hasOwnProp(baseSet, "schemaError"))
          routeMergedSchemas.schemaError = baseSet.schemaError

        if (hasOwnProp(route, "schemaHeaders"))
          routeMergedSchemas.schemaHeaders = route.schemaHeaders
        else if (hasOwnProp(routes, "schemaHeaders"))
          routeMergedSchemas.schemaHeaders = routes.schemaHeaders
        else if (hasOwnProp(baseSet, "schemaHeaders"))
          routeMergedSchemas.schemaHeaders = baseSet.schemaHeaders

        return make({
          ...route,
          method,
          ...routeMergedSchemas,
        })
      }),
    ) as any
  }
}

type JsxObject = {
  type: any
  props: any
}

function isJsxObject(value: any) {
  return typeof value === "object"
    && value !== null
    && "type" in value
    && "props" in value
}

// Export schema methods explicitly for module-level access
export {
  schemaPathParams,
  schemaUrlParams,
  schemaPayload,
  schemaSuccess,
  schemaError,
  schemaHeaders,
}
