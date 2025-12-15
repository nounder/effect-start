import type * as HttpApp from "@effect/platform/HttpApp"
import type * as HttpMethod from "@effect/platform/HttpMethod"
import * as Effect from "effect/Effect"
import type { YieldWrap } from "effect/Utils"

import type {
  HttpMiddlewareFunction,
  Route,
  RouteContext,
  RouteHandler,
  RouteMedia,
  RouteSchemas,
  RouteSet,
} from "./Route.ts"
import {
  isRouteSet,
  make,
  makeSet,
  RouteHttpKind,
} from "./Route.ts"

import type {
  DecodeRouteSchemas,
  MergeSchemas,
} from "./Route_schema.ts"
import { mergeSchemas } from "./Route_schema.ts"

type RouteModule = typeof import("./Route.ts")

type Self =
  | RouteSet.Default
  | RouteSet<Route.Empty, RouteSchemas>
  | RouteModule
  | undefined

export type HandlerInput<A, E, R> =
  | A
  | Effect.Effect<A, E, R>
  | ((context: RouteContext) =>
    | Effect.Effect<A, E, R>
    | Generator<YieldWrap<Effect.Effect<A, E, R>>, A, never>)

export function normalizeHandler<A, E, R>(
  handler: HandlerInput<A, E, R>,
): RouteHandler<A, E, R> {
  if (typeof handler === "function") {
    const wrapper = (context: RouteContext): Effect.Effect<A, E, R> => {
      const result = (handler as Function)(context)
      if (Effect.isEffect(result)) {
        return result as Effect.Effect<A, E, R>
      }
      return Effect.gen(() => result) as Effect.Effect<A, E, R>
    }
    return Object.assign(wrapper, handler)
  }
  if (Effect.isEffect(handler)) {
    return () => handler
  }
  return () => Effect.succeed(handler as A)
}

export function makeMediaFunction<
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

    // Cast required: TypeScript cannot narrow generic S based on isRouteSet(this) runtime check.
    // The conditional return type is correct for callers; this is a TS limitation with generic narrowing.
    return makeSet(
      [
        ...baseRoutes,
        make({
          method,
          media,
          handler: normalizeHandler(handler),
          schemas: baseSchema,
        }),
      ],
      baseSchema,
    ) as never
  }
}

export function makeMethodModifier<
  M extends HttpMethod.HttpMethod,
>(method: M) {
  return function<
    S extends Self,
    T extends Route.Tuple,
    InSchemas extends RouteSchemas,
  >(
    this: S,
    routes: RouteSet<T, InSchemas>,
  ): S extends RouteSet<infer B, infer BaseSchemas> ? RouteSet<
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

    // Cast required: TypeScript cannot narrow generic S based on isRouteSet(this) runtime check.
    // The conditional return type is correct for callers; this is a TS limitation with generic narrowing.
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
      ],
      baseSchema,
    ) as never
  }
}

export function makeHttpFunction() {
  return function<
    S extends Self,
    A,
    E,
    R,
  >(
    this: S,
    handler: HttpMiddlewareFunction | Effect.Effect<A, E, R>,
  ): S extends RouteSet<infer Routes, infer Schemas> ? RouteSet<[
      ...Routes,
      Route<
        "*",
        "*",
        RouteHandler<A, E, R>,
        Schemas
      >,
    ], Schemas>
    : RouteSet<[
      Route<
        "*",
        "*",
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

    const isMiddleware = typeof handler === "function"
      && !Effect.isEffect(handler)

    const routeHandler: RouteHandler = isMiddleware
      ? (context: RouteContext) => {
        const innerApp: HttpApp.Default = context.next() as HttpApp.Default
        return (handler as HttpMiddlewareFunction)(innerApp)
      }
      : () => handler as Effect.Effect<A, E, R>

    Object.defineProperty(routeHandler, RouteHttpKind, {
      value: isMiddleware ? "HttpMiddleware" : "HttpHandler",
      enumerable: false,
      writable: false,
    })

    // Cast required: TypeScript cannot narrow generic S based on isRouteSet(this) runtime check.
    // The conditional return type is correct for callers; this is a TS limitation with generic narrowing.
    return makeSet(
      [
        ...baseRoutes,
        make({
          method: "*",
          media: "*",
          handler: routeHandler,
          schemas: baseSchema,
        }),
      ],
      baseSchema,
    ) as never
  }
}
