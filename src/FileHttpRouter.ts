// @ts-nocheck
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as HttpUtils from "./HttpUtils.ts"
import * as Route from "./Route.ts"
import * as Router from "./Router.ts"
import * as RouteRender from "./RouteRender.ts"
import * as RouterPattern from "./RouterPattern.ts"

/**
 * Combines Effect error channel from a record of effects.
 */
type RecordEffectError<A> = A extends Record<string, any> ? Exclude<
    {
      [K in keyof A]: A[K] extends Effect.Effect<any, infer E, any> ? E
        : never
    }[keyof A],
    undefined
  >
  : never

/**
 * Combines Effect requirement channel from a record of effects.
 */
type RecordEffectRequirements<A> = A extends Record<string, any> ? Exclude<
    {
      [K in keyof A]: A[K] extends Effect.Effect<any, any, infer R> ? R
        : never
    }[keyof A],
    undefined
  >
  : never

/**
 * Infers the HttpRouter type from an array of ServerRoutes
 */
export type HttpRouterFromServerRoutes<
  Routes extends ReadonlyArray<Router.ServerRoute>,
> = HttpRouter.HttpRouter<
  (Routes extends ReadonlyArray<infer Route>
    ? Route extends Router.ServerRoute
      ? RecordEffectError<Awaited<ReturnType<Route["load"]>>>
    : never
    : never),
  Exclude<
    Routes extends ReadonlyArray<infer Route>
      ? Route extends Router.ServerRoute
        ? RecordEffectRequirements<Awaited<ReturnType<Route["load"]>>>
      : never
      : never,
    // exclude HttpServerRequest since HttpRouter already has it
    HttpServerRequest.HttpServerRequest
  >
>

/**
 * Find layer routes that match a given route's method and media type.
 */
function findMatchingLayerRoutes(
  route: Route.Route.Default,
  layerRouteSets: Route.RouteSet.Default[],
): Route.Route.Default[] {
  const matchingRoutes: Route.Route.Default[] = []

  for (const layerRouteSet of layerRouteSets) {
    for (const layerRoute of layerRouteSet.set) {
      if (Route.matches(layerRoute, route)) {
        matchingRoutes.push(layerRoute)
      }
    }
  }

  return matchingRoutes
}

/**
 * Wrap an inner route with a layer route.
 * Returns a new route that, when executed, provides next() to call the inner route.
 */
function wrapWithLayerRoute(
  innerRoute: Route.Route.Default,
  layerRoute: Route.Route.Default,
): Route.Route.Default {
  const handler: Route.RouteHandler = (context) => {
    const innerNext = () => innerRoute.handler(context)

    const contextWithNext: Route.RouteContext = {
      ...context,
      next: innerNext,
    }

    return layerRoute.handler(contextWithNext)
  }

  return Route.make({
    method: layerRoute.method,
    media: layerRoute.media,
    handler,
    schemas: {},
  })
}

/**
 * Makes a HttpRouter from file-based routes.
 */

export function make<
  Routes extends ReadonlyArray<Router.ServerRoute>,
>(
  routes: Routes,
): Effect.Effect<HttpRouterFromServerRoutes<Routes>> {
  return Effect.gen(function*() {
    const routesWithModules = yield* Effect.forEach(
      routes,
      (route) =>
        Effect.gen(function*() {
          const module = yield* Effect.tryPromise(() => route.load()).pipe(
            Effect.orDie,
          )

          const layerModules = route.layers
            ? yield* Effect.forEach(
              route.layers,
              (layerLoad) =>
                Effect.tryPromise(() => layerLoad()).pipe(Effect.orDie),
            )
            : []

          const layerRouteSets = layerModules
            .map((mod: any) => mod.default)
            .filter(Route.isRouteSet)

          return {
            path: route.path,
            routeSet: module.default,
            layerRouteSets,
          }
        }),
    )

    let router: HttpRouter.HttpRouter<any, any> = HttpRouter.empty

    for (const { path, routeSet, layerRouteSets } of routesWithModules) {
      for (const route of routeSet.set) {
        const matchingLayerRoutes = findMatchingLayerRoutes(
          route,
          layerRouteSets,
        )

        let wrappedRoute = route
        // Reverse so first layer in array becomes outermost wrapper.
        // Example: [outerLayer, innerLayer] wraps as outer(inner(route))
        for (const layerRoute of matchingLayerRoutes.reverse()) {
          wrappedRoute = wrapWithLayerRoute(wrappedRoute, layerRoute)
        }

        const wrappedHandler: HttpApp.Default = Effect.gen(function*() {
          const request = yield* HttpServerRequest.HttpServerRequest

          const context: Route.RouteContext = {
            request,
            get url() {
              return HttpUtils.makeUrlFromRequest(request)
            },
            slots: {},
            next: () => Effect.void,
          }

          return yield* RouteRender.render(wrappedRoute, context)
        })

        // Extract HTTP middleware routes
        const allMiddleware: Route.HttpMiddlewareFunction[] = []
        for (const layerRouteSet of layerRouteSets) {
          for (const layerRoute of layerRouteSet.set) {
            if (Route.isHttpMiddlewareHandler(layerRoute.handler)) {
              allMiddleware.push(
                layerRoute.handler as unknown as Route.HttpMiddlewareFunction,
              )
            }
          }
        }

        let finalHandler = wrappedHandler
        for (const middleware of allMiddleware) {
          finalHandler = middleware(finalHandler)
        }

        for (const pattern of RouterPattern.toEffect(path)) {
          router = HttpRouter.route(route.method)(
            pattern,
            finalHandler as any,
          )(router)
        }
      }
    }

    return router as HttpRouterFromServerRoutes<Routes>
  })
}
