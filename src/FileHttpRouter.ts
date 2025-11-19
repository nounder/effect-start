// @ts-nocheck
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as FileRouter from "./FileRouter.ts"
import * as Router from "./Router.ts"
import * as RouteServices from "./RouteServices.ts"

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
 * Converts file-based route path format to HttpRouter path format.
 * Examples:
 *   /movies/[id] -> /movies/:id
 *   /docs/[[...slug]] -> /docs/*
 *   /api/[...path] -> /api/*
 */
function convertPathFormat(path: string): string {
  return path
    // Convert required params: [id] -> :id
    .replace(/\[([^\]\.]+)\]/g, ":$1")
    // Convert optional rest params: [[...slug]] -> *
    .replace(/\[\[\.\.\.([^\]]+)\]\]/g, "*")
    // Convert required rest params: [...path] -> *
    .replace(/\[\.\.\.([^\]]+)\]/g, "*")
}

function buildRouteLayer(
  layerModules: ReadonlyArray<{ default?: any }>,
): Layer.Layer<any, never, never> {
  const layers = layerModules
    .map((mod) => mod.default)
    .filter((layer): layer is Layer.Layer<any> => layer !== undefined)

  if (layers.length === 0) {
    return Layer.empty
  }

  return Layer.mergeAll(...layers)
}

function wrapHandlerWithLayers(
  handler: Effect.Effect<any, any, any>,
  routeLayer: Layer.Layer<any, never, never>,
  routeContext: RouteServices.RouteContext,
): Effect.Effect<any, any, any> {
  return Effect.gen(function*() {
    const routeContextLayer = Layer.succeed(RouteServices.Route, routeContext)

    const fullLayer = Layer.merge(
      routeContextLayer,
      routeLayer,
    )

    return yield* handler.pipe(Effect.provide(fullLayer))
  })
}

/**
 * Makes a HttpRouter from file-based routes.
 */
export function make<Routes extends ReadonlyArray<FileRouter.RouteModule>>(
  routes: Routes,
): Effect.Effect<HttpRouter.HttpRouter<any, any>> {
  return Effect.gen(function*() {
    const loadedRoutes = yield* Effect.forEach(routes, (route) =>
      Effect.gen(function*() {
        const module = yield* Effect.tryPromise(() => route.load()).pipe(
          Effect.orDie,
        )

        const layerModules = route.layers
          ? yield* Effect.forEach(
            route.layers,
            (loadLayer) =>
              Effect.tryPromise(() => loadLayer()).pipe(Effect.orDie),
          )
          : []

        const routeLayer = buildRouteLayer(layerModules)

        return {
          path: route.path,
          module,
          routeLayer,
        }
      }))

    let router: HttpRouter.HttpRouter<any, any> = HttpRouter.empty

    for (const { path, module, routeLayer } of loadedRoutes) {
      const routeSet = module.default
      const httpRouterPath = convertPathFormat(path)

      for (const route of routeSet.set) {
        const wrappedHandler = Effect.gen(function*() {
          const request = yield* HttpServerRequest.HttpServerRequest
          const url = new URL(
            request.url,
            `http://${request.headers.host ?? "localhost"}`,
          )

          const routeContext: RouteServices.RouteContext = {
            request,
            url,
            path,
            params: {},
            slots: {},
          }

          return yield* wrapHandlerWithLayers(
            route.handler,
            routeLayer,
            routeContext,
          )
        })

        router = HttpRouter.route(route.method)(
          httpRouterPath,
          wrappedHandler as any,
        )(
          router,
        )
      }
    }

    return router
  })
}

export function middleware() {
  return HttpMiddleware.make((app) =>
    Effect.gen(function*() {
      const routerContext = yield* Router.Router
      const router = routerContext.httpRouter
      const res = yield* router.pipe(
        Effect.catchTag("RouteNotFound", () => app),
      )

      return res
    })
  )
}
