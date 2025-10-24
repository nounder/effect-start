import * as HttpMethod from "@effect/platform/HttpMethod"
import * as HttpServerRespondable from "@effect/platform/HttpServerRespondable"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"

export {
  pipe,
} from "effect/Function"

type RouteModule = typeof import("./Route.ts")

/**
 * 'this' argument type for {@link RouteBuilder} functions.
 * Its value depend on how the function is called as described below.
 */
type RouteThis =
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
> extends RouteSet<[Route.Default]> {
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
  > = {
    readonly method: Method
    readonly media: Media
    readonly handler: Handler
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
 * that have `this` parameter as {@link RouteThis}.
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
  }

  export type Default = RouteSet<Route.Tuple>
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
  makeValueHandler<string>(HttpServerResponse.html),
)

export const json = makeMediaFunction(
  "GET",
  "application/json",
  makeValueHandler<JsonValue>((raw) => HttpServerResponse.unsafeJson(raw)),
)

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
}

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

function make<
  Method extends RouteMethod = "*",
  Media extends RouteMedia = "*",
  Handler extends RouteHandler = never,
>(
  input: Route.Data<
    Method,
    Media,
    Handler
  >,
): Route<
  Method,
  Media,
  Handler
> {
  const route = Object.assign(
    Object.create(RouteProto),
    {
      // @ts-expect-error: assigned below
      set: [],
      method: input.method,
      media: input.media,
      handler: input.handler,
    } satisfies Route.Data,
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
): RouteSet<M> {
  return Object.assign(
    Object.create(SetProto),
    {
      set: routes,
    },
  ) as RouteSet<M>
}

/**
 * Factory function that creates Route for a specific method & media.
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
    This extends RouteThis,
    A,
    E = never,
    R = never,
  >(
    this: This,
    handler: Effect.Effect<A, E, R>,
  ): This extends RouteSet<infer Routes> ? RouteSet<[
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
    return makeSet(
      ...(isRouteSet(this)
        ? this.set
        : []),
      make({
        method,
        media,
        handler: handlerFn(handler as any) as any,
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
    This extends RouteThis,
    T extends Route.Tuple,
  >(
    this: This,
    routes: RouteSet<T>,
  ): This extends RouteSet<infer B>
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
    const baseRoutes = isRouteSet(this)
      ? this.set
      : [] as const

    return makeSet(
      ...baseRoutes,
      ...routes.set.map(route => {
        return make({
          ...route,
          method,
        })
      }),
    ) as any
  }
}
