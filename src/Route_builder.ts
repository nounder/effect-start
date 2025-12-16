import type * as HttpApp from "@effect/platform/HttpApp"
import type * as HttpMethod from "@effect/platform/HttpMethod"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
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
  RouteHttpTypeId,
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

/**
 * http() uses 4 overloads instead of a single signature with a union parameter type.
 *
 * With a union parameter like `handler: MiddlewareFunc<E,R> | Effect<A,E,R>`,
 * TypeScript attempts to infer E and R from both branches simultaneously.
 * When the branches have different structures, inference fails and falls back
 * to `unknown`. For example, passing a middleware function would yield
 * `Effect<HttpServerResponse, unknown, unknown>` instead of the actual types.
 *
 * Separate overloads give TypeScript a single, unambiguous inference path:
 * - Overloads 1-2: Function handlers → infer E, R from return type
 * - Overloads 3-4: Effect handlers → infer A, E, R from Effect type
 *
 * TypeScript checks overloads top-to-bottom until one matches, then infers
 * generics from that single signature without union ambiguity.
 */

/**
 * Helper type for http() return values.
 * Constructs a RouteSet with the new HTTP route appended to existing routes.
 */
type HttpRouteResult<
  Routes extends readonly Route.Default[],
  Schemas extends RouteSchemas,
  A,
  E,
  R,
> = RouteSet<
  [...Routes, Route<"*", "*", RouteHandler<A, E, R>, Schemas>],
  Schemas
>

// Accepts a middleware
export function http<
  S extends RouteSet<Route.Tuple, RouteSchemas> | RouteModule | undefined,
  E,
  R,
>(
  this: S,
  handler: (app: HttpApp.Default<never, never>) => HttpApp.Default<E, R>,
): S extends RouteSet<infer Routes, infer Schemas> ? HttpRouteResult<
    Routes,
    Schemas,
    HttpServerResponse.HttpServerResponse,
    E,
    R
  >
  : HttpRouteResult<
    [],
    RouteSchemas.Empty,
    HttpServerResponse.HttpServerResponse,
    E,
    R
  >
// Accepts Effect handler
export function http<
  S extends RouteSet<Route.Tuple, RouteSchemas> | RouteModule | undefined,
  A extends HttpServerResponse.HttpServerResponse,
  E,
  R,
>(
  this: S,
  handler: Effect.Effect<A, E, R>,
): S extends RouteSet<infer Routes, infer Schemas>
  ? HttpRouteResult<Routes, Schemas, A, E, R>
  : HttpRouteResult<[], RouteSchemas.Empty, A, E, R>
// Implementation
export function http<A extends HttpServerResponse.HttpServerResponse, E, R>(
  this: Self,
  handler:
    | ((app: HttpApp.Default<never, never>) => HttpApp.Default<E, R>)
    | Effect.Effect<A, E, R>,
): RouteSet<readonly Route.Default[], RouteSchemas> {
  const baseRoutes = isRouteSet(this)
    ? this.set
    : [] as const
  const baseSchema = isRouteSet(this)
    ? this.schema
    : {} as RouteSchemas.Empty

  const isMiddleware = typeof handler === "function"
    && !Effect.isEffect(handler)

  const routeHandler: RouteHandler<
    HttpServerResponse.HttpServerResponse,
    E,
    R | HttpServerRequest.HttpServerRequest
  > = isMiddleware
    ? (context: RouteContext) => {
      const innerApp: HttpApp.Default = context.next() as HttpApp.Default
      return (handler as HttpMiddlewareFunction)(innerApp)
    }
    : () => handler as Effect.Effect<A, E, R>

  Object.defineProperty(routeHandler, RouteHttpTypeId, {
    value: RouteHttpTypeId,
    enumerable: false,
    writable: false,
  })

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
  )
}
