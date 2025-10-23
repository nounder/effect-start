import * as HttpMethod from "@effect/platform/HttpMethod"
import * as HttpServerRespondable from "@effect/platform/HttpServerRespondable"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"

export {
  pipe,
} from "effect/Function"

type RouteModule = typeof import("./Route.ts")

type RouteThis = Route | RouteModule

const TypeId: unique symbol = Symbol.for("effect-start/Route")

export type RouteMethod =
  | "*"
  | HttpMethod.HttpMethod

export type RoutePath = `/${string}`

type RouteMedia =
  | "*"
  | "text/plain"
  | "text/html"
  | "application/json"

type ValueHandler<
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

type HttpHandler<E = any, R = any> = Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  E,
  R
>

type Handler<
  A = unknown,
  E = any,
  R = any,
> =
  | ValueHandler<A, E, R>
  | HttpHandler<E, R>

const SetProto = {
  post,

  setName<
    Name extends string,
    M extends ReadonlyArray<
      Route<string, RouteMethod, RouteMedia, Handler>
    >,
  >(
    this: Set<M>,
    name: Name,
  ): Set<
    {
      [K in keyof M]: M[K] extends
        Route<infer _, infer Method, infer Media, infer H>
        ? Route<Name, Method, Media, H>
        : M[K]
    }
  > {
    return Object.assign(
      Object.create(SetProto),
      {
        set: this.set.map(route => {
          return {
            ...route,
            name: name,
          }
        }),
      },
    ) as Set<
      {
        [K in keyof M]: M[K] extends
          Route<infer _, infer Method, infer Media, infer H>
          ? Route<Name, Method, Media, H>
          : M[K]
      }
    >
  },
}

export type Set<
  M extends ReadonlyArray<
    Route<string, RouteMethod, RouteMedia, Handler>
  >,
> =
  & Pipeable.Pipeable
  & Set.Instance<M>
  & {
    post: typeof SetProto.post
    setName: typeof SetProto.setName
  }

export namespace Set {
  export type Instance<
    M extends ReadonlyArray<
      Route<string, RouteMethod, RouteMedia, Handler>
    > = [Route.Instance],
  > = {
    set: M
  }
}

type RouteBuilder = {
  text: typeof text
}

export interface Route<
  out Name extends string = "",
  out Method extends RouteMethod = "*",
  out Media extends RouteMedia = "*",
  out _Handler extends Handler = never,
> extends
  Route.Instance<
    Name,
    Method,
    Media
  >,
  RouteBuilder
{
  [TypeId]: typeof TypeId
  readonly handler: _Handler
}

export namespace Route {
  export type Instance<
    Name extends string,
    Method extends RouteMethod,
    Media extends RouteMedia,
  > =
    & Set.Instance<[
      Route<
        Name,
        Method,
        Media
      >,
    ]>
    & {
      readonly name: Name
      readonly method: Method
      readonly media: Media
    }

  export type Default = Instance<string, RouteMethod, RouteMedia>
}

type RouteProto =
  & Pipeable.Pipeable
  & RouteBuilder
  & {
    [TypeId]: typeof TypeId
  }

const RouteProto = Object.assign(
  Object.create(SetProto),
  {
    [TypeId]: TypeId,

    pipe() {
      return Pipeable.pipeArguments(this, arguments)
    },

    text,
  } satisfies RouteProto,
)

export function isRoute(input: unknown): input is Route {
  return Predicate.hasProperty(input, TypeId)
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

export const empty = {}

export function text<
  A extends string,
  Base extends Route,
  _Handler extends ValueHandler<A, E, R>,
  E = never,
  R = never,
>(
  this: RouteThis,
  handler: Effect.Effect<A, E, R>,
): Set<[
  Route<
    Base["name"],
    Base["method"],
    "text/plain",
    _Handler
  >,
]> {
  const route = Object.assign(
    Object.create(RouteProto),
    {
      ...routeThis(this),
      // @ts-expect-error: we're setting this variable below
      set: [],
      method: "GET",
      path: "/",
      media: "text/plain",
      handler: Effect.gen(function*() {
        const raw = Effect.isEffect(handler)
          ? yield* handler
          : handler
        const response = HttpServerResponse.text(raw)

        return {
          [HttpServerRespondable.symbol]: () => Effect.succeed(response),
          raw,
        }
      }),
    } satisfies Route.Default,
  )

  route.set = [route]

  return route
}

export function post<
  M extends ReadonlyArray<
    Route<string, RouteMethod, RouteMedia, Handler>
  >,
  R extends ReadonlyArray<
    Route<string, RouteMethod, RouteMedia, Handler>
  >,
>(
  this: Set<M> | undefined,
  route: Set<R>,
): Set<
  [
    ...M,
    ...{
      [K in keyof R]: R[K] extends Route<infer N, infer _, infer M, infer H>
        ? Route<N, "POST", M, H>
        : R[K]
    },
  ]
> {
  return Object.assign(
    Object.create(SetProto),
    {
      set: [
        ...(this?.set ?? []),
        ...route.set.map(r => ({
          ...r,
          method: "POST",
        })),
      ],
    },
  ) as Set<
    [
      ...M,
      ...{
        [K in keyof R]: R[K] extends
          Route<infer Name, infer _, infer Media, infer H>
          ? Route<Name, "POST", Media, H>
          : R[K]
      },
    ]
  >
}

function routeThis(route: Route | RouteModule) {
  return isRoute(route)
    ? route
    : {}
}
