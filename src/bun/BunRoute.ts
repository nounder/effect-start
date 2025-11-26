import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpServerRespondable from "@effect/platform/HttpServerRespondable"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import type * as Bun from "bun"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Predicate from "effect/Predicate"
import type * as Runtime from "effect/Runtime"
import * as Random from "../Random.ts"
import * as Route from "../Route.ts"
import * as Router from "../Router.ts"
import * as BunRouteSyntax from "./BunRouteSyntax.ts"

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
    handler: HttpServerResponse.text("Empty BunRoute"),
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
      router.modules,
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
              const bunPath = BunRouteSyntax.toBunPath(path)

              return [bunPath, bundle] as const
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

    const modules = yield* Effect.forEach(
      router.modules,
      (mod) =>
        Effect.promise(() =>
          mod.load().then((m) => ({
            path: mod.path,
            exported: m.default,
          }))
        ),
    )

    const allRoutes = modules.flatMap(({ path, exported }) => {
      if (Route.isRouteSet(exported)) {
        return [...exported.set].map((route) => [path, route] as const)
      }
      return []
    })

    const result: BunRoutes = {}

    for (const [path, route] of allRoutes) {
      const bunPath = BunRouteSyntax.toBunPath(path)

      if (isBunRoute(route)) {
        const bundle = yield* Effect.promise(() => route.load())
        const internalPath = `${path}~BunRoute-${nonce}`

        result[internalPath] = bundle

        const proxyHandler: BunServerFetchHandler = (request) => {
          const url = new URL(internalPath, request.url)
          return fetch(new Request(url, request))
        }

        result[bunPath] = proxyHandler
      } else {
        const httpApp = Effect.gen(function*() {
          const res = yield* route.handler
          if (HttpServerResponse.isServerResponse(res)) {
            return res
          }
          return yield* res[HttpServerRespondable.symbol]()
        })

        const webHandler = HttpApp.toWebHandlerRuntime(rt)(httpApp)
        const handler: BunServerFetchHandler = (request) => webHandler(request)

        if (route.method === "*" || isBunRoute(route)) {
          result[bunPath] = handler
        } else {
          const existing = result[bunPath]
          if (isMethodHandlers(existing)) {
            existing[route.method] = handler
          } else {
            result[bunPath] = { [route.method]: handler }
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
