import type * as Bun from "bun"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Route from "../router/Route.ts"
import * as RouteHttp from "../router/RouteHttp.ts"
import * as Router from "../router/Router.ts"
import * as RouterPattern from "../router/RouterPattern.ts"
import * as RouteSet from "../router/RouteSet.ts"
import * as BunHttpServer from "./BunHttpServer.ts"
import {
  type BunHandler,
  type BunRoutes,
  isBunHandler,
  validateBunPattern,
} from "./BunRoute.ts"

type BunServerFetchHandler = (
  request: Request,
  server: Bun.Server<unknown>,
) => Response | Promise<Response>

type MethodHandlers = Partial<
  Record<Bun.Serve.HTTPMethod, BunServerFetchHandler>
>

function isMethodHandlers(value: unknown): value is MethodHandlers {
  return typeof value === "object" && value !== null && !("index" in value)
}

export function routesFrom(
  router: Router.Router.Any,
): Effect.Effect<BunRoutes, Router.RouterError, BunHttpServer.BunHttpServer> {
  return Effect.gen(function*() {
    const result: BunRoutes = {}

    for (const path of Object.keys(router.mounts)) {
      const routeSet = router.mounts[path as `/${string}`]

      const validationError = validateBunPattern(path)
      if (Option.isSome(validationError)) {
        return yield* Effect.fail(validationError.value)
      }

      // Check for BunHandlers in the routeSet
      for (const route of RouteSet.items(routeSet)) {
        if (isBunHandler(route.handler)) {
          const bunHandler = route.handler as BunHandler
          const bundle = yield* Effect.promise(() => bunHandler.load())
          const bunPaths = RouterPattern.toBun(
            path as RouterPattern.RouterPattern,
          )
          for (const bunPath of bunPaths) {
            const internalPath = `${bunHandler.internalPathPrefix}${bunPath}`
            result[internalPath] = bundle
          }
        }
      }

      const httpPaths = RouterPattern.toBun(path as RouterPattern.RouterPattern)

      // Group content routes by method
      const byMethod = new Map<Route.RouteMethod, Route.Route.Default[]>()
      for (const route of RouteSet.items(routeSet)) {
        if (route.kind === "http") continue
        const existing = byMethod.get(route.method) ?? []
        existing.push(route)
        byMethod.set(route.method, existing)
      }

      for (const [method, routes] of byMethod) {
        // toHttpApp handles content negotiation, toWebHandler applies middleware
        const webHandler = RouteHttp.toWebHandler(
          RouteSet.make(routes, {}),
          routeSet,
        )

        const handler: BunServerFetchHandler = (request) => {
          const url = new URL(request.url)
          if (url.pathname.startsWith("/.BunRoute-")) {
            return new Response(
              "Internal routing error: BunRoute internal path was not matched. "
                + "This indicates the HTMLBundle route was not registered. Please report a bug.",
              { status: 500 },
            )
          }
          return webHandler(request)
        }

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
