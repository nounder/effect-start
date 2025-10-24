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
  | Handler.Value<A, E, R>
  /**
   * A handler returns `HttpServerResponse`.
   * Should not be consumed with caution: if body is a stream,
   * consuming it in another handler may break the stream.
   */
  | Handler.Encoded<E, R>

export namespace Handler {
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

export type RouteSet<
  M extends Route.Tuple,
> =
  & Pipeable.Pipeable
  & RouteSet.Instance<M>
  & {
    [RouteSetTypeId]: typeof RouteSetTypeId

    post: typeof post

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

const SetProto = {
  [RouteSetTypeId]: RouteSetTypeId,

  post,

  text,
  html,
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

export function text<
  This extends RouteThis,
  A extends string,
  E = never,
  R = never,
>(
  this: This,
  handler: Effect.Effect<A, E, R>,
): This extends RouteSet<infer Routes> ? RouteSet<[
    ...Routes,
    Route<
      "",
      "GET",
      "text/plain",
      Handler.Value<A, E, R>
    >,
  ]>
  : RouteSet<[
    Route<
      "",
      "GET",
      "text/plain",
      Handler.Value<A, E, R>
    >,
  ]>
{
  return makeSet(
    ...(isRouteSet(this)
      ? this.set
      : []),
    make({
      name: "",
      method: "GET",
      media: "text/plain",
      handler: Effect.gen(function*() {
        const raw = Effect.isEffect(handler)
          ? yield* handler
          : handler
        const response = HttpServerResponse.html(raw)

        return {
          [HttpServerRespondable.symbol]: () => Effect.succeed(response),
          raw,
        }
      }) as Handler.Value<A, E, R>,
    }),
  ) as any
}

/**
 * TODO: Support streaming
 */
export function html<
  This extends RouteThis,
  A extends string,
  E = never,
  R = never,
>(
  this: This,
  handler: Effect.Effect<A, E, R>,
): This extends RouteSet<infer Routes> ? RouteSet<[
    ...Routes,
    Route<
      "",
      "GET",
      "text/html",
      Handler.Value<A, E, R>
    >,
  ]>
  : RouteSet<[
    Route<
      "",
      "GET",
      "text/html",
      Handler.Value<A, E, R>
    >,
  ]>
{
  return [
    ...(isRouteSet(this)
      ? this.set
      : []),
    make({
      name: "",
      method: "GET",
      media: "text/html",
      handler: Effect.gen(function*() {
        const raw = Effect.isEffect(handler)
          ? yield* handler
          : handler
        const response = HttpServerResponse.html(raw)

        return {
          [HttpServerRespondable.symbol]: () => Effect.succeed(response),
          raw,
        }
      }) as Handler.Value<A, E, R>,
    }),
  ] as any
}

export function post<
  This extends RouteThis,
  T extends Route.Tuple,
>(
  this: This,
  routes: RouteSet<T>,
): This extends RouteSet<infer B> ? RouteSet<
    [
      ...B,
      ...{
        [K in keyof T]: T[K] extends Route<infer N, infer _, infer M, infer H>
          ? Route<N, "POST", M, H>
          : T[K]
      },
    ]
  >
  : RouteSet<
    {
      [K in keyof T]: T[K] extends Route<infer N, infer _, infer M, infer H>
        ? Route<N, "POST", M, H>
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
        method: "POST",
      })
    }),
  ) as any
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

function routeThis(
  route: RouteThis,
) {
  return isRoute(route)
    ? route
    : make({
      name: "",
      method: "*",
      media: "*",
      handler: HttpServerResponse.text("empty route") as Handler.Encoded,
    })
}
