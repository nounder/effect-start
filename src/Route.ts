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

type RouteThis =
  | RouteSet.Default
  | RouteModule

const TypeId: unique symbol = Symbol.for("effect-start/Route")

const RouteSetTypeId: unique symbol = Symbol.for("effect-start/RouteSet")

export type RouteMethod =
  | "*"
  | HttpMethod.HttpMethod

export type RoutePath = `/${string}`

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
  out Name extends string = "",
  out Method extends RouteMethod = "*",
  out Media extends RouteMedia = "*",
  out Handler extends RouteHandler = RouteHandler,
> extends RouteSet<[Route.Default]> {
  [TypeId]: typeof TypeId
  readonly name: Name
  readonly method: Method
  readonly media: Media
  readonly handler: Handler
}

export namespace Route {
  export type Data<
    Name extends string = string,
    Method extends RouteMethod = RouteMethod,
    Media extends RouteMedia = RouteMedia,
    Handler extends RouteHandler = RouteHandler,
  > = {
    readonly name: Name
    readonly method: Method
    readonly media: Media
    readonly handler: Handler
  }

  export type Default = Route<
    string,
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

export type RouteSet<
  M extends Route.Tuple,
> =
  & Pipeable.Pipeable
  & RouteSet.Instance<M>
  & {
    [RouteSetTypeId]: typeof RouteSetTypeId

    post: typeof post
    get: typeof get
    put: typeof put
    patch: typeof patch
    del: typeof del
    options: typeof options
    head: typeof head

    text: typeof text
    html: typeof html
  }

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
  makeValueHandler(HttpServerResponse.text),
)

export const html = makeMediaFunction(
  "GET",
  "text/html",
  makeValueHandler(HttpServerResponse.html),
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
  Name extends string = "",
  Method extends RouteMethod = "*",
  Media extends RouteMedia = "*",
  Handler extends RouteHandler = never,
>(
  input: Route.Data<
    Name,
    Method,
    Media,
    Handler
  >,
): Route<
  Name,
  Method,
  Media,
  Handler
> {
  const route = Object.assign(
    Object.create(RouteProto),
    {
      // @ts-expect-error: assigned below
      set: [],
      name: input.name,
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
  A extends string,
  E = never,
  R = never,
>(
  method: Method,
  media: Media,
  handlerFn: (
    handler: Effect.Effect<A, E, R>,
  ) => RouteHandler.Value<A, E, R>,
) {
  return function<
    This extends RouteThis,
  >(
    this: This,
    handler: Effect.Effect<A, E, R>,
  ): This extends RouteSet<infer Routes> ? RouteSet<[
      ...Routes,
      Route<
        "",
        Method,
        Media,
        RouteHandler.Value<A, E, R>
      >,
    ]>
    : RouteSet<[
      Route<
        "",
        Method,
        Media,
        RouteHandler.Value<A, E, R>
      >,
    ]>
  {
    return makeSet(
      ...(isRouteSet(this)
        ? this.set
        : []),
      make({
        name: "",
        method,
        media,
        handler: handlerFn(handler),
      }),
    ) as any
  }
}

function makeValueHandler(
  responseFn: (raw: string) => HttpServerResponse.HttpServerResponse,
) {
  return <A extends string, E = never, R = never>(
    handler: Effect.Effect<A, E, R>,
  ): RouteHandler.Value<A, E, R> => {
    return Effect.gen(function*() {
      const raw = Effect.isEffect(handler)
        ? yield* handler
        : handler
      const response = responseFn(raw)

      return {
        [HttpServerRespondable.symbol]: () => Effect.succeed(response),
        raw,
      }
    }) as RouteHandler.Value<A, E, R>
  }
}

/**
 * Factory function that changes method in RouteSet.
 */
function makeMethodModifier<M extends HttpMethod.HttpMethod>(method: M) {
  return function<
    This extends RouteThis,
    T extends Route.Tuple,
  >(
    this: This,
    routes: RouteSet<T>,
  ): This extends RouteSet<infer B> ? RouteSet<
      [
        ...B,
        ...{
          [K in keyof T]: T[K] extends
            Route<infer N, infer _, infer Media, infer H>
            ? Route<N, M, Media, H>
            : T[K]
        },
      ]
    >
    : RouteSet<
      {
        [K in keyof T]: T[K] extends
          Route<infer N, infer _, infer Media, infer H> ? Route<N, M, Media, H>
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

function routeThis(
  route: RouteThis,
) {
  return isRoute(route)
    ? route
    : make({
      name: "",
      method: "*",
      media: "*",
      handler: HttpServerResponse.text("empty route") as RouteHandler.Encoded,
    })
}
