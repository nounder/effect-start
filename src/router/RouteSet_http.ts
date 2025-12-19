import type * as HttpApp from "@effect/platform/HttpApp"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as Route from "./Route.ts"
import * as RouteSet from "./RouteSet.ts"

/**
 * Function signature for HTTP middleware.
 * Takes an HttpApp and returns an HttpApp or Effect.
 */
export type HttpMiddlewareFunction<E = any, R = any> = <AppE, AppR>(
  app: HttpApp.Default<AppE, AppR>,
) => HttpApp.HttpApp<E | AppE, R | AppR>

export function http<
  S extends Route.Self,
  E,
  R,
>(
  this: S,
  handler: (app: HttpApp.Default<never, never>) => HttpApp.Default<E, R>,
): S extends RouteSet.RouteSet<infer Routes, infer Schemas> ? RouteSet.RouteSet<
    [
      ...Routes,
      Route.Route<
        "*",
        "http",
        Route.RouteHandler<HttpServerResponse.HttpServerResponse, E, R>,
        Schemas
      >,
    ],
    Schemas
  >
  : RouteSet.RouteSet<
    [
      Route.Route<
        "*",
        "http",
        Route.RouteHandler<HttpServerResponse.HttpServerResponse, E, R>,
        Route.RouteSchemas.Empty
      >,
    ],
    Route.RouteSchemas.Empty
  >
export function http<
  S extends Route.Self,
  A extends HttpServerResponse.HttpServerResponse,
  E,
  R,
>(
  this: S,
  handler: Effect.Effect<A, E, R>,
): S extends RouteSet.RouteSet<infer Routes, infer Schemas> ? RouteSet.RouteSet<
    [
      ...Routes,
      Route.Route<"*", "http", Route.RouteHandler<A, E, R>, Schemas>,
    ],
    Schemas
  >
  : RouteSet.RouteSet<
    [
      Route.Route<
        "*",
        "http",
        Route.RouteHandler<A, E, R>,
        Route.RouteSchemas.Empty
      >,
    ],
    Route.RouteSchemas.Empty
  >
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

  return RouteSet.make(
    [
      ...baseRoutes,
      Route.make({
        method: "*",
        kind: "http",
        handler: routeHandler,
        schemas: baseSchema,
      }),
    ],
    baseSchema,
  )
}
