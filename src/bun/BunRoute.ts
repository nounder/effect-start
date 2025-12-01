import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import type * as Bun from "bun"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Predicate from "effect/Predicate"
import type * as Runtime from "effect/Runtime"
import * as HttpUtils from "../HttpUtils.ts"
import * as Random from "../Random.ts"
import * as Route from "../Route.ts"
import * as Router from "../Router.ts"
import * as RouteRender from "../RouteRender.ts"
import * as RouterPattern from "../RouterPattern.ts"

const TypeId: unique symbol = Symbol.for("effect-start/BunRoute")

export type BunRoute =
  & Route.Route
  & {
    [TypeId]: typeof TypeId
    load: () => Promise<Bun.HTMLBundle>
  }

export function loadBundle(
  load: () => Promise<Bun.HTMLBundle | { default: Bun.HTMLBundle }>,
): BunRoute {
  const route = Route.make({
    method: "GET",
    media: "text/html",
    handler: () => HttpServerResponse.text("Empty BunRoute"),
    schemas: {},
  })

  const bunRoute: BunRoute = Object.assign(
    Object.create(route),
    {
      [TypeId]: TypeId,
      load: () => load().then(mod => "default" in mod ? mod.default : mod),
    },
  )

  bunRoute.set = [bunRoute]

  return bunRoute
}

export function isBunRoute(input: unknown): input is BunRoute {
  return Predicate.hasProperty(input, TypeId)
}

function findMatchingLayerRoutes(
  route: Route.Route.Default,
  layers: Route.RouteLayer[],
): Route.Route.Default[] {
  const matchingRoutes: Route.Route.Default[] = []
  for (const layer of layers) {
    for (const layerRoute of layer.set) {
      if (Route.matches(layerRoute, route)) {
        matchingRoutes.push(layerRoute)
      }
    }
  }
  return matchingRoutes
}

function wrapWithLayerRoute(
  innerRoute: Route.Route.Default,
  layerRoute: Route.Route.Default,
): Route.Route.Default {
  const handler: Route.RouteHandler = (context) => {
    const contextWithNext: Route.RouteContext = {
      ...context,
      next: () => innerRoute.handler(context),
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

function makeHandler(
  routes: Route.Route.Default[],
  layers: Route.RouteLayer[],
) {
  return Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const accept = request.headers.accept ?? ""

    let selectedRoute: Route.Route.Default | undefined

    if (accept.includes("application/json")) {
      selectedRoute = routes.find((r) => r.media === "application/json")
    }
    if (!selectedRoute && accept.includes("text/plain")) {
      selectedRoute = routes.find((r) => r.media === "text/plain")
    }
    if (
      !selectedRoute
      && (accept.includes("text/html")
        || accept.includes("*/*")
        || !accept)
    ) {
      selectedRoute = routes.find((r) => r.media === "text/html")
    }
    if (!selectedRoute) {
      selectedRoute = routes[0]
    }

    if (!selectedRoute) {
      return HttpServerResponse.empty({ status: 406 })
    }

    const matchingLayerRoutes = findMatchingLayerRoutes(
      selectedRoute,
      layers,
    )
    let wrappedRoute = selectedRoute
    for (const layerRoute of matchingLayerRoutes.reverse()) {
      wrappedRoute = wrapWithLayerRoute(wrappedRoute, layerRoute)
    }

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
}


/**
 * Finds BunRoutes in the Router and returns
 * a mapping of paths to their bundles that can be passed
 * to Bun's `serve` function.
 */
export function bundlesFromRouter(
  router: Router.RouterContext,
): Effect.Effect<Record<string, Bun.HTMLBundle>> {
  return Function.pipe(
    Effect.forEach(
      router.routes,
      (mod) =>
        Effect.promise(() =>
          mod.load().then((m) => ({ path: mod.path, exported: m.default }))
        ),
    ),
    Effect.map((modules) =>
      modules.flatMap(({ path, exported }) => {
        if (Route.isRouteSet(exported)) {
          return [...exported.set]
            .filter(isBunRoute)
            .map((route) =>
              [
                path,
                route,
              ] as const
            )
        }

        return []
      })
    ),
    Effect.flatMap((bunRoutes) =>
      Effect.forEach(
        bunRoutes,
        ([path, route]) =>
          Effect.promise(() =>
            route.load().then((bundle) => {
              const httpPath = RouterPattern.toHttpPath(path)

              return [httpPath, bundle] as const
            })
          ),
        { concurrency: "unbounded" },
      )
    ),
    Effect.map((entries) =>
      Object.fromEntries(entries) as Record<string, Bun.HTMLBundle>
    ),
  )
}

type BunServerFetchHandler = (
  request: Request,
  server: Bun.Server<unknown>,
) => Response | Promise<Response>

type BunServerRouteHandler =
  | Bun.HTMLBundle
  | BunServerFetchHandler
  | Partial<Record<Bun.Serve.HTTPMethod, BunServerFetchHandler>>

export type BunRoutes = Record<string, BunServerRouteHandler>

type MethodHandlers = Partial<
  Record<Bun.Serve.HTTPMethod, BunServerFetchHandler>
>

function isMethodHandlers(value: unknown): value is MethodHandlers {
  return typeof value === "object" && value !== null && !("index" in value)
}

/**
 * Converts a Router into Bun-compatible routes passed to {@link Bun.serve}.
 *
 * For BunRoutes (HtmlBundle), creates two routes:
 * - An internal route at `${path}~BunRoute-${nonce}:${path}` holding the actual HtmlBundle
 * - A proxy route at the original path that forwards requests to the internal route
 *
 * This allows middleware to be attached to the proxy route while Bun handles
 * the HtmlBundle natively on the internal route.
 */
export function routesFromRouter(
  router: Router.RouterContext,
  runtime?: Runtime.Runtime<never>,
): Effect.Effect<BunRoutes> {
  return Effect.gen(function*() {
    const rt = runtime ?? (yield* Effect.runtime<never>())
    const nonce = Random.token(6)

    const loadedRoutes = yield* Effect.forEach(
      router.routes,
      (mod) =>
        Effect.gen(function*() {
          const routeModule = yield* Effect.promise(() => mod.load())

          const layerModules = mod.layers
            ? yield* Effect.forEach(
              mod.layers,
              (layerLoad) => Effect.promise(() => layerLoad()),
            )
            : []

          const layers = layerModules
            .map((m: any) => m.default)
            .filter(Route.isRouteLayer)

          return {
            path: mod.path,
            exported: routeModule.default,
            layers,
          }
        }),
    )

    const result: BunRoutes = {}

    for (const { path, exported, layers } of loadedRoutes) {
      const httpPaths = RouterPattern.toBun(path)

      const byMethod = new Map<Route.RouteMethod, Route.Route.Default[]>()
      for (const route of exported.set) {
        if (isBunRoute(route)) {
          const bundle = yield* Effect.promise(() => route.load())
          const internalPath = `${path}~BunRoute-${nonce}`

          result[internalPath] = bundle

          const proxyHandler: BunServerFetchHandler = (request) => {
            const url = new URL(internalPath, request.url)
            return fetch(new Request(url, request))
          }

          for (const httpPath of httpPaths) {
            if (!(httpPath in result)) {
              result[httpPath] = proxyHandler
            }
          }
        } else {
          const existing = byMethod.get(route.method) ?? []
          existing.push(route)
          byMethod.set(route.method, existing)
        }
      }

      for (const [method, routes] of byMethod) {
        const httpApp = makeHandler(routes, layers)

        const allMiddleware = layers
          .map((layer) => layer.httpMiddleware)
          .filter((m): m is Route.HttpMiddlewareFunction => m !== undefined)

        let finalHandler = httpApp
        for (const middleware of allMiddleware) {
          finalHandler = middleware(finalHandler)
        }

        const webHandler = HttpApp.toWebHandlerRuntime(rt)(finalHandler)
        const handler: BunServerFetchHandler = (request) => webHandler(request)

        for (const httpPath of httpPaths) {
          if (method === "*") {
            if (!(httpPath in result)) {
              result[httpPath] = handler
            }
          } else {
            const existing = result[httpPath]
            if (isMethodHandlers(existing)) {
              existing[method] = handler
            } else if (!(httpPath in result)) {
              result[httpPath] = { [method]: handler }
            }
          }
        }
      }
    }

    return result
  })
}

export const isHTMLBundle = (handle: any) => {
  return (
    typeof handle === "object"
    && handle !== null
    && (handle.toString() === "[object HTMLBundle]"
      || typeof handle.index === "string")
  )
}
