import type * as HttpApp from "@effect/platform/HttpApp"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as Route from "./Route.ts"
import * as RouteSet from "./RouteSet.ts"

/**
 * Symbol key for HTTP middleware type discriminant.
 */
export const RouteHttpTypeId: unique symbol = Symbol.for(
  "effect-start/RouteHttpTypeId",
)

/**
 * Function signature for HTTP middleware.
 * Takes an HttpApp and returns an HttpApp or Effect.
 */
export type HttpMiddlewareFunction<E = any, R = any> = <AppE, AppR>(
  app: HttpApp.Default<AppE, AppR>,
) => HttpApp.HttpApp<E | AppE, R | AppR>

/**
 * Type helper to check if all routes in a RouteSet are HttpMiddleware.
 * HTTP middleware routes are characterized by method="*" and media="*".
 */
export type IsHttpMiddlewareRouteSet<RS> = RS extends
  RouteSet.RouteSet<infer Routes, any> ? Routes extends readonly [] ? true
  : Routes extends readonly Route.Route<infer M, infer Media, any, any>[]
    ? M extends "*" ? Media extends "*" ? true
      : false
    : false
  : false
  : false

/**
 * Check if a handler is an HTTP middleware handler.
 */
export function isHttpMiddlewareHandler(h: unknown): boolean {
  return typeof h === "function"
    && RouteHttpTypeId in h
    && (h as Record<symbol, unknown>)[RouteHttpTypeId] === RouteHttpTypeId
}

type HttpRouteResult<
  Routes extends readonly Route.Route.Default[],
  Schemas extends Route.RouteSchemas,
  A,
  E,
  R,
> = RouteSet.RouteSet<
  [
    ...Routes,
    Route.Route<"*", "*", Route.RouteHandler<A, E, R>, Schemas>,
  ],
  Schemas
>

export function http<
  S extends Route.Self,
  E,
  R,
>(
  this: S,
  handler: (app: HttpApp.Default<never, never>) => HttpApp.Default<E, R>,
): S extends RouteSet.RouteSet<infer Routes, infer Schemas> ? HttpRouteResult<
    Routes,
    Schemas,
    HttpServerResponse.HttpServerResponse,
    E,
    R
  >
  : HttpRouteResult<
    [],
    Route.RouteSchemas.Empty,
    HttpServerResponse.HttpServerResponse,
    E,
    R
  >
export function http<
  S extends Route.Self,
  A extends HttpServerResponse.HttpServerResponse,
  E,
  R,
>(
  this: S,
  handler: Effect.Effect<A, E, R>,
): S extends RouteSet.RouteSet<infer Routes, infer Schemas>
  ? HttpRouteResult<Routes, Schemas, A, E, R>
  : HttpRouteResult<[], Route.RouteSchemas.Empty, A, E, R>
export function http<
  A extends HttpServerResponse.HttpServerResponse,
  E,
  R,
>(
  this: Route.Self,
  handler:
    | ((app: HttpApp.Default<never, never>) => HttpApp.Default<E, R>)
    | Effect.Effect<A, E, R>,
): RouteSet.RouteSet<readonly Route.Route.Default[], Route.RouteSchemas> {
  const baseRoutes = RouteSet.isRouteSet(this)
    ? RouteSet.items(this)
    : [] as const
  const baseSchema = RouteSet.isRouteSet(this)
    ? RouteSet.schemas(this)
    : {} as Route.RouteSchemas.Empty

  const isMiddleware = typeof handler === "function"
    && !Effect.isEffect(handler)

  const routeHandler: Route.RouteHandler<
    HttpServerResponse.HttpServerResponse,
    E,
    R | HttpServerRequest.HttpServerRequest
  > = isMiddleware
    ? (_context: Route.RouteContext, next: Route.RouteNext) => {
      const innerApp: HttpApp.Default = next() as HttpApp.Default
      return (handler as HttpMiddlewareFunction)(innerApp)
    }
    : (_context, _next) => handler as Effect.Effect<A, E, R>

  Object.defineProperty(routeHandler, RouteHttpTypeId, {
    value: RouteHttpTypeId,
    enumerable: false,
    writable: false,
  })

  return RouteSet.make(
    [
      ...baseRoutes,
      Route.make({
        method: "*",
        media: "*",
        handler: routeHandler,
        schemas: baseSchema,
      }),
    ],
    baseSchema,
  )
}
