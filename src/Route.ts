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

/**
 * Schema configuration object type containing all schema types.
 */
export type SchemaConfig = {
  readonly pathParams?: Schema.Schema.Any
  readonly urlParams?: Schema.Schema.Any
  readonly payload?: Schema.Schema.Any
  readonly success?: Schema.Schema.Any
  readonly error?: Schema.Schema.Any
  readonly headers?: Schema.Schema.Any
}

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
  out Schemas extends SchemaConfig = {},
> extends RouteSet<[Route.Default], Schemas> {
  [TypeId]: typeof TypeId
  readonly method: Method
  readonly media: Media
  readonly handler: Handler
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
    Schemas extends SchemaConfig = {},
  > = {
    readonly method: Method
    readonly media: Media
    readonly handler: Handler
  } & Schemas

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
  Schemas extends SchemaConfig = {},
> =
  & Pipeable.Pipeable
  & RouteSet.Instance<M, Schemas>
  & {
    [RouteSetTypeId]: typeof RouteSetTypeId
  }
  & RouteBuilder

export namespace RouteSet {
  export type Instance<
    M extends Route.Tuple = Route.Tuple,
    Schemas extends SchemaConfig = {},
  > = {
    set: M
  } & Schemas

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
): S extends RouteSet<infer Routes, infer Schemas> ? RouteSet<Routes, Schemas & { pathParams: typeof schema }> : RouteSet<[], { pathParams: typeof schema }> {
  const baseSet = isRouteSet(this)
    ? (this as RouteSet.Default)
    : undefined

  const set = baseSet?.set ?? ([] as const)
  const schemasObj: SchemaConfig = {
    pathParams: schema,
  }
  if (baseSet?.urlParams)
    schemasObj.urlParams = baseSet.urlParams
  if (baseSet?.payload)
    schemasObj.payload = baseSet.payload
  if (baseSet?.success)
    schemasObj.success = baseSet.success
  if (baseSet?.error)
    schemasObj.error = baseSet.error
  if (baseSet?.headers)
    schemasObj.headers = baseSet.headers

  return makeSet(schemasObj, ...(set as any)) as any
}

function schemaUrlParams<S extends Self>(
  this: S,
  schema: Schema.Schema.Any,
): S extends RouteSet<infer Routes, infer Schemas> ? RouteSet<Routes, Schemas & { urlParams: typeof schema }> : RouteSet<[], { urlParams: typeof schema }> {
  const baseSet = isRouteSet(this)
    ? (this as RouteSet.Default)
    : undefined

  const set = baseSet?.set ?? ([] as const)
  const schemasObj: SchemaConfig = {
    urlParams: schema,
  }
  if (baseSet?.pathParams)
    schemasObj.pathParams = baseSet.pathParams
  if (baseSet?.payload)
    schemasObj.payload = baseSet.payload
  if (baseSet?.success)
    schemasObj.success = baseSet.success
  if (baseSet?.error)
    schemasObj.error = baseSet.error
  if (baseSet?.headers)
    schemasObj.headers = baseSet.headers

  return makeSet(schemasObj, ...(set as any)) as any
}

function schemaPayload<S extends Self>(
  this: S,
  schema: Schema.Schema.Any,
): S extends RouteSet<infer Routes, infer Schemas> ? RouteSet<Routes, Schemas & { payload: typeof schema }> : RouteSet<[], { payload: typeof schema }> {
  const baseSet = isRouteSet(this)
    ? (this as RouteSet.Default)
    : undefined

  const set = baseSet?.set ?? ([] as const)
  const schemasObj: SchemaConfig = {
    payload: schema,
  }
  if (baseSet?.pathParams)
    schemasObj.pathParams = baseSet.pathParams
  if (baseSet?.urlParams)
    schemasObj.urlParams = baseSet.urlParams
  if (baseSet?.success)
    schemasObj.success = baseSet.success
  if (baseSet?.error)
    schemasObj.error = baseSet.error
  if (baseSet?.headers)
    schemasObj.headers = baseSet.headers

  return makeSet(schemasObj, ...(set as any)) as any
}

function schemaSuccess<S extends Self>(
  this: S,
  schema: Schema.Schema.Any,
): S extends RouteSet<infer Routes, infer Schemas> ? RouteSet<Routes, Schemas & { success: typeof schema }> : RouteSet<[], { success: typeof schema }> {
  const baseSet = isRouteSet(this)
    ? (this as RouteSet.Default)
    : undefined

  const set = baseSet?.set ?? ([] as const)
  const schemasObj: SchemaConfig = {
    success: schema,
  }
  if (baseSet?.pathParams)
    schemasObj.pathParams = baseSet.pathParams
  if (baseSet?.urlParams)
    schemasObj.urlParams = baseSet.urlParams
  if (baseSet?.payload)
    schemasObj.payload = baseSet.payload
  if (baseSet?.error)
    schemasObj.error = baseSet.error
  if (baseSet?.headers)
    schemasObj.headers = baseSet.headers

  return makeSet(schemasObj, ...(set as any)) as any
}

function schemaError<S extends Self>(
  this: S,
  schema: Schema.Schema.Any,
): S extends RouteSet<infer Routes, infer Schemas> ? RouteSet<Routes, Schemas & { error: typeof schema }> : RouteSet<[], { error: typeof schema }> {
  const baseSet = isRouteSet(this)
    ? (this as RouteSet.Default)
    : undefined

  const set = baseSet?.set ?? ([] as const)
  const schemasObj: SchemaConfig = {
    error: schema,
  }
  if (baseSet?.pathParams)
    schemasObj.pathParams = baseSet.pathParams
  if (baseSet?.urlParams)
    schemasObj.urlParams = baseSet.urlParams
  if (baseSet?.payload)
    schemasObj.payload = baseSet.payload
  if (baseSet?.success)
    schemasObj.success = baseSet.success
  if (baseSet?.headers)
    schemasObj.headers = baseSet.headers

  return makeSet(schemasObj, ...(set as any)) as any
}

function schemaHeaders<S extends Self>(
  this: S,
  schema: Schema.Schema.Any,
): S extends RouteSet<infer Routes, infer Schemas> ? RouteSet<Routes, Schemas & { headers: typeof schema }> : RouteSet<[], { headers: typeof schema }> {
  const baseSet = isRouteSet(this)
    ? (this as RouteSet.Default)
    : undefined

  const set = baseSet?.set ?? ([] as const)
  const schemasObj: SchemaConfig = {
    headers: schema,
  }
  if (baseSet?.pathParams)
    schemasObj.pathParams = baseSet.pathParams
  if (baseSet?.urlParams)
    schemasObj.urlParams = baseSet.urlParams
  if (baseSet?.payload)
    schemasObj.payload = baseSet.payload
  if (baseSet?.success)
    schemasObj.success = baseSet.success
  if (baseSet?.error)
    schemasObj.error = baseSet.error

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
 * Extended with validated schema properties when defined in SchemaConfig.
 */
export type RouteContext<
  Schemas extends SchemaConfig = {},
> = {
  request: HttpServerRequest.HttpServerRequest
  get url(): URL
} & (Schemas["pathParams"] extends never ? {} : {
  pathParams: Schema.Schema.Type<Schemas["pathParams"]>
}) & (Schemas["urlParams"] extends never ? {} : {
  urlParams: Schema.Schema.Type<Schemas["urlParams"]>
}) & (Schemas["payload"] extends never ? {} : {
  payload: Schema.Schema.Type<Schemas["payload"]>
}) & (Schemas["headers"] extends never ? {} : {
  headers: Schema.Schema.Type<Schemas["headers"]>
})

function make<
  Method extends RouteMethod = "*",
  Media extends RouteMedia = "*",
  Handler extends RouteHandler = never,
  Schemas extends SchemaConfig = {},
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
  const routeData: Record<string, any> = {
    set: [],
    method: input.method,
    media: input.media,
    handler: input.handler,
  }

  // Copy schema properties from input to routeData
  if (input.pathParams)
    routeData.pathParams = input.pathParams
  if (input.urlParams)
    routeData.urlParams = input.urlParams
  if (input.payload)
    routeData.payload = input.payload
  if (input.success)
    routeData.success = input.success
  if (input.error)
    routeData.error = input.error
  if (input.headers)
    routeData.headers = input.headers

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
  Schemas extends SchemaConfig = {},
>(
  ...routes: M
): RouteSet<M, Schemas>
function makeSet<
  M extends Route.Tuple,
  Schemas extends SchemaConfig = {},
>(
  schemas: Schemas,
  ...routes: M
): RouteSet<M, Schemas>
function makeSet<
  M extends Route.Tuple,
  Schemas extends SchemaConfig = {},
>(
  schemasOrRoute?: any,
  ...rest: any[]
): RouteSet<M, Schemas> {
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
  ) as RouteSet<M, Schemas>
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
        context: RouteContext,
      ) => Generator<YieldWrap<Effect.Effect<A, E, R>>, A, never>),
  ): S extends RouteSet<infer Routes, infer Schemas> ? RouteSet<[
      ...Routes,
      Route<
        Method,
        Media,
        ReturnType<HandlerFn>,
        Schemas
      >,
    ], Schemas>
    : RouteSet<[
      Route<
        Method,
        Media,
        ReturnType<HandlerFn>,
        {}
      >,
    ]>
  {
    const baseSet = isRouteSet(this)
      ? (this as RouteSet.Default)
      : undefined

    const effect = typeof handler === "function"
      ? Effect.gen(function*() {
        const request = yield* HttpServerRequest.HttpServerRequest
        const context: RouteContext = {
          request,
          get url() {
            return makeUrlFromRequest(request)
          },
        } as any
        return yield* Effect.gen(() => handler(context))
      })
      : handler

    // Build schema config for both RouteSet and Route
    const schemasConfig: SchemaConfig = {}
    if (baseSet?.pathParams)
      schemasConfig.pathParams = baseSet.pathParams
    if (baseSet?.urlParams)
      schemasConfig.urlParams = baseSet.urlParams
    if (baseSet?.payload)
      schemasConfig.payload = baseSet.payload
    if (baseSet?.success)
      schemasConfig.success = baseSet.success
    if (baseSet?.error)
      schemasConfig.error = baseSet.error
    if (baseSet?.headers)
      schemasConfig.headers = baseSet.headers

    const mergedSchemas: any = {}
    if (schemasConfig.pathParams) {
      mergedSchemas.pathParams = schemasConfig.pathParams
    }
    if (schemasConfig.urlParams) {
      mergedSchemas.urlParams = schemasConfig.urlParams
    }
    if (schemasConfig.payload) {
      mergedSchemas.payload = schemasConfig.payload
    }
    if (schemasConfig.success) {
      mergedSchemas.success = schemasConfig.success
    }
    if (schemasConfig.error) {
      mergedSchemas.error = schemasConfig.error
    }
    if (schemasConfig.headers) {
      mergedSchemas.headers = schemasConfig.headers
    }

    return makeSet(
      Object.keys(schemasConfig).length > 0 ? schemasConfig : {},
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
    Schemas extends SchemaConfig = {},
  >(
    this: S,
    routes: RouteSet<T, Schemas>,
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
            infer RouteSch
          > ? Route<
              M,
              Media,
              H,
              RouteSch
            >
            : T[K]
        },
      ],
      Schemas & BaseSchemas
    >
    // otherwise create new RouteSet
    : RouteSet<
      {
        [K in keyof T]: T[K] extends Route<
          infer _,
          infer Media,
          infer H,
          infer RouteSch
        > ? Route<
            M,
            Media,
            H,
            RouteSch
          >
          : T[K]
      },
      Schemas
    >
  {
    const baseSet = isRouteSet(this)
      ? (this as RouteSet.Default)
      : undefined
    const baseRoutes = baseSet?.set ?? ([] as const)

    const schemasConfig: SchemaConfig = {}
    if (baseSet?.pathParams)
      schemasConfig.pathParams = baseSet.pathParams
    if (baseSet?.urlParams)
      schemasConfig.urlParams = baseSet.urlParams
    if (baseSet?.payload)
      schemasConfig.payload = baseSet.payload
    if (baseSet?.success)
      schemasConfig.success = baseSet.success
    if (baseSet?.error)
      schemasConfig.error = baseSet.error
    if (baseSet?.headers)
      schemasConfig.headers = baseSet.headers

    return makeSet(
      Object.keys(schemasConfig).length > 0 ? schemasConfig : {},
      ...(baseRoutes as any),
      ...routes.set.map(route => {
        const routeMergedSchemas: any = {}
        const hasOwnProp = (obj: any, prop: string): boolean =>
          Object.prototype.hasOwnProperty.call(obj, prop)

        // Prioritize route own schemas, then routes schemas, then baseSet schemas
        if (hasOwnProp(route, "pathParams"))
          routeMergedSchemas.pathParams = route.pathParams
        else if (hasOwnProp(routes, "pathParams"))
          routeMergedSchemas.pathParams = routes.pathParams
        else if (baseSet && hasOwnProp(baseSet, "pathParams"))
          routeMergedSchemas.pathParams = baseSet.pathParams

        if (hasOwnProp(route, "urlParams"))
          routeMergedSchemas.urlParams = route.urlParams
        else if (hasOwnProp(routes, "urlParams"))
          routeMergedSchemas.urlParams = routes.urlParams
        else if (baseSet && hasOwnProp(baseSet, "urlParams"))
          routeMergedSchemas.urlParams = baseSet.urlParams

        if (hasOwnProp(route, "payload"))
          routeMergedSchemas.payload = route.payload
        else if (hasOwnProp(routes, "payload"))
          routeMergedSchemas.payload = routes.payload
        else if (baseSet && hasOwnProp(baseSet, "payload"))
          routeMergedSchemas.payload = baseSet.payload

        if (hasOwnProp(route, "success"))
          routeMergedSchemas.success = route.success
        else if (hasOwnProp(routes, "success"))
          routeMergedSchemas.success = routes.success
        else if (baseSet && hasOwnProp(baseSet, "success"))
          routeMergedSchemas.success = baseSet.success

        if (hasOwnProp(route, "error"))
          routeMergedSchemas.error = route.error
        else if (hasOwnProp(routes, "error"))
          routeMergedSchemas.error = routes.error
        else if (baseSet && hasOwnProp(baseSet, "error"))
          routeMergedSchemas.error = baseSet.error

        if (hasOwnProp(route, "headers"))
          routeMergedSchemas.headers = route.headers
        else if (hasOwnProp(routes, "headers"))
          routeMergedSchemas.headers = routes.headers
        else if (baseSet && hasOwnProp(baseSet, "headers"))
          routeMergedSchemas.headers = baseSet.headers

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
