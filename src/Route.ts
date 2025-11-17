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
 * Schemas for validating route data.
 */
export type RouteSchemas = {
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
  out Schemas extends RouteSchemas = {},
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
    Schemas extends RouteSchemas = {},
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
  Schemas extends RouteSchemas = {},
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
    Schemas extends RouteSchemas = {},
  > = {
    set: M
    schemas: Schemas
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

/**
 * Factory to create schema setter methods.
 */
function makeSchemaMethod<K extends keyof RouteSchemas>(key: K) {
  return function<
    S extends Self,
    SchemaType extends Schema.Schema.Any,
  >(
    this: S,
    schema: SchemaType,
  ): S extends RouteSet<infer Routes, infer Schemas> ? RouteSet<
      Routes,
      Schemas & { [P in K]: SchemaType }
    >
    : RouteSet<
      [],
      { [P in K]: SchemaType }
    >
  {
    const baseRoutes = isRouteSet(this) ? this.set : []
    const baseSchemas = isRouteSet(this) ? this.schemas : {}

    return makeSet(
      baseRoutes,
      {
        ...baseSchemas,
        [key]: schema,
      } as any,
    ) as any
  }
}

export const schemaPathParams = makeSchemaMethod("pathParams")
export const schemaUrlParams = makeSchemaMethod("urlParams")
export const schemaPayload = makeSchemaMethod("payload")
export const schemaSuccess = makeSchemaMethod("success")
export const schemaError = makeSchemaMethod("error")
export const schemaHeaders = makeSchemaMethod("headers")

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
 * Validated properties from schemas.
 */
type ValidatedSchemaProps<Schemas extends RouteSchemas> =
  & (Schemas["pathParams"] extends Schema.Schema.Any ? {
      pathParams: Schema.Schema.Type<Schemas["pathParams"]>
    }
    : {})
  & (Schemas["urlParams"] extends Schema.Schema.Any ? {
      urlParams: Schema.Schema.Type<Schemas["urlParams"]>
    }
    : {})
  & (Schemas["payload"] extends Schema.Schema.Any ? {
      payload: Schema.Schema.Type<Schemas["payload"]>
    }
    : {})
  & (Schemas["headers"] extends Schema.Schema.Any ? {
      headers: Schema.Schema.Type<Schemas["headers"]>
    }
    : {})

/**
 * Context passed to route handler generator functions.
 */
export type RouteContext<Schemas extends RouteSchemas = {}> =
  & {
    request: HttpServerRequest.HttpServerRequest
    get url(): URL
  }
  & ValidatedSchemaProps<Schemas>

function make<
  Method extends RouteMethod = "*",
  Media extends RouteMedia = "*",
  Handler extends RouteHandler = never,
  Schemas extends RouteSchemas = {},
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
      // @ts-expect-error: assigned below
      set: [],
      // @ts-expect-error: assigned below
      schemas: {},
      method: input.method,
      media: input.media,
      handler: input.handler,
      schemas: input.schemas,
    } satisfies Route.Data<Method, Media, Handler, Schemas>,
  )

  route.set = [
    route,
  ]
  route.schemas = input.schemas

  return route
}

function makeSet<
  M extends Route.Tuple,
  Schemas extends RouteSchemas = {},
>(
  routes: M,
  schemas?: Schemas,
): RouteSet<M, Schemas> {
  return Object.assign(
    Object.create(SetProto),
    {
      set: routes,
      schemas: schemas ?? {},
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
        context: RouteContext<any>,
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
    ], {}>
  {
    const schemas = isRouteSet(this) ? this.schemas : {}

    const effect = typeof handler === "function"
      ? Effect.gen(function*() {
        const request = yield* HttpServerRequest.HttpServerRequest
        const context: RouteContext<any> = {
          request,
          get url() {
            return makeUrlFromRequest(request)
          },
        }
        return yield* Effect.gen(() => handler(context))
      })
      : handler

    return makeSet(
      [
        ...(isRouteSet(this)
          ? this.set
          : []),
        make({
          method,
          media,
          handler: handlerFn(effect as any) as any,
          schemas: schemas as any,
        }),
      ],
      schemas as any,
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
 * Merges two schemas for the same property.
 * If both exist, creates a union. Otherwise returns the one that exists.
 */
function mergeSchemaProperty(
  base: Schema.Schema.Any | undefined,
  route: Schema.Schema.Any | undefined,
): Schema.Schema.Any | undefined {
  if (base && route) {
    return Schema.Union(base, route)
  }
  return base ?? route
}

/**
 * Merges schemas from RouteSet and Route.
 * If both have the same schema property, they are unionized.
 */
function mergeSchemas(
  baseSchemas: RouteSchemas,
  routeSchemas: RouteSchemas,
): RouteSchemas {
  return {
    pathParams: mergeSchemaProperty(
      baseSchemas.pathParams,
      routeSchemas.pathParams,
    ),
    urlParams: mergeSchemaProperty(
      baseSchemas.urlParams,
      routeSchemas.urlParams,
    ),
    payload: mergeSchemaProperty(baseSchemas.payload, routeSchemas.payload),
    success: mergeSchemaProperty(baseSchemas.success, routeSchemas.success),
    error: mergeSchemaProperty(baseSchemas.error, routeSchemas.error),
    headers: mergeSchemaProperty(baseSchemas.headers, routeSchemas.headers),
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
    Schemas extends RouteSchemas,
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
            infer S
          > ? Route<
              M,
              Media,
              H,
              S
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
          infer S
        > ? Route<
            M,
            Media,
            H,
            S
          >
          : T[K]
      },
      Schemas
    >
  {
    const baseRoutes = isRouteSet(this)
      ? this.set
      : [] as const
    const baseSchemas = isRouteSet(this) ? this.schemas : {}

    return makeSet(
      [
        ...baseRoutes,
        ...routes.set.map(route => {
          const mergedSchemas = mergeSchemas(baseSchemas, route.schemas)
          return make({
            ...route,
            method,
            schemas: mergedSchemas as any,
          })
        }),
      ],
      baseSchemas as any,
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
