import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import type * as Bun from "bun"
import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import type * as Runtime from "effect/Runtime"
import * as HttpUtils from "../HttpUtils.ts"
import * as Random from "../Random.ts"
import * as Route from "../Route.ts"
import * as Router from "../Router.ts"
import * as RouteRender from "../RouteRender.ts"
import * as RouterPattern from "../RouterPattern.ts"
import * as BunHttpServer from "./BunHttpServer.ts"

const TypeId: unique symbol = Symbol.for("effect-start/BunRoute")

export type BunRoute =
  & Route.Route
  & {
    [TypeId]: typeof TypeId
    // Prefix because Bun.serve routes ignore everything after `*` in wildcard patterns.
    // A suffix like `/*~internal` would match the same as `/*`, shadowing the internal route.
    internalPathPrefix: string
    load: () => Promise<Bun.HTMLBundle>
  }

export function html(
  load: () => Promise<Bun.HTMLBundle | { default: Bun.HTMLBundle }>,
): BunRoute {
  const internalPathPrefix = `/.BunRoute-${Random.token(6)}`

  const handler: Route.RouteHandler<
    HttpServerResponse.HttpServerResponse,
    never,
    BunHttpServer.BunServer
  > = (context) =>
    Effect.gen(function*() {
      const bunServer = yield* BunHttpServer.BunServer
      const internalPath = `${internalPathPrefix}${context.url.pathname}`
      const internalUrl = new URL(internalPath, bunServer.server.url)

      const originalRequest = context.request.source as Request
      const proxyRequest = new Request(internalUrl, {
        method: originalRequest.method,
        headers: originalRequest.headers,
      })

      // Use fetch() instead of bunServer.server.fetch() because server.fetch()
      // bypasses Bun's route matching and goes directly to the fetch handler
      const response = yield* Effect.promise(() => fetch(proxyRequest))

      return HttpServerResponse.raw(response)
    })

  const route = Route.make({
    method: "*",
    media: "text/html",
    handler,
    schemas: {},
  })

  const bunRoute: BunRoute = Object.assign(
    Object.create(route),
    {
      [TypeId]: TypeId,
      internalPathPrefix,
      load: () => load().then(mod => "default" in mod ? mod.default : mod),
      set: [],
    },
  )

  bunRoute.set.push(bunRoute)

  return bunRoute
}

export function isBunRoute(input: unknown): input is BunRoute {
  return Predicate.hasProperty(input, TypeId)
}

function makeHandler(routes: Route.Route.Default[]) {
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

    const context: Route.RouteContext = {
      request,
      get url() {
        return HttpUtils.makeUrlFromRequest(request)
      },
      slots: {},
      next: () => Effect.void,
    }

    return yield* RouteRender.render(selectedRoute, context)
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
              const httpPath = RouterPattern.toBun(path)

              return [
                httpPath,
                bundle,
              ] as const
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
 * Validates that a route pattern is supported by Bun.serve.
 *
 * Supported patterns:
 * - /exact     - Exact match
 * - /users/:id - Full-segment named param
 * - /path/*    - Directory wildcard
 * - /*         - Catch-all
 *
 * Unsupported patterns:
 * - /pk_:id    - Prefix before param
 * - /:id_sfx   - Suffix after param
 * - /:id.json  - Suffix with dot (Bun treats as param name)
 * - /:id~test  - Suffix with tilde (Bun treats as param name)
 * - /:id?      - Optional param
 * - /hello-*   - Inline prefix wildcard
 * - /*~suffix  - Suffix after wildcard
 */
export function validateBunPattern(
  pattern: string,
): Option.Option<Router.RouterError> {
  const segments = RouterPattern.parse(pattern)

  const unsupported = Array.findFirst(segments, (seg) => {
    if (seg._tag === "ParamSegment") {
      return seg.optional === true
        || seg.prefix !== undefined
        || seg.suffix !== undefined
    }

    return false
  })

  if (Option.isSome(unsupported)) {
    const seg = unsupported.value
    const reason = seg._tag === "ParamSegment"
      ? seg.optional
        ? "optional params ([[param]])"
        : "prefixed/suffixed params (prefix_[param] or [param]_suffix)"
      : "optional rest params ([[...rest]])"

    return Option.some(
      new Router.RouterError({
        reason: "UnsupportedPattern",
        pattern,
        message:
          `Pattern "${pattern}" uses ${reason} which is not supported by Bun.serve. `
          + `Bun only supports full-segment params ([id]) and trailing wildcards ([...rest]).`,
      }),
    )
  }

  return Option.none()
}

/**
 * Converts a RouterBuilder into Bun-compatible routes passed to {@link Bun.serve}.
 *
 * For BunRoutes (HtmlBundle), creates two routes:
 * - An internal route at `${path}~BunRoute-${nonce}:${path}` holding the actual HtmlBundle
 * - A proxy route at the original path that forwards requests to the internal route
 *
 * This allows middleware to be attached to the proxy route while Bun handles
 * the HtmlBundle natively on the internal route.
 */
export function routesFromRouter(
  router: Router.RouterBuilder.Any,
  runtime?: Runtime.Runtime<BunHttpServer.BunServer>,
): Effect.Effect<BunRoutes, Router.RouterError, BunHttpServer.BunServer> {
  return Effect.gen(function*() {
    const rt = runtime ?? (yield* Effect.runtime<BunHttpServer.BunServer>())

    const result: BunRoutes = {}

    for (const entry of router.entries) {
      const { path, route: routeSet } = entry

      const validationError = validateBunPattern(path)
      if (Option.isSome(validationError)) {
        return yield* Effect.fail(validationError.value)
      }

      for (const route of routeSet.set) {
        if (isBunRoute(route)) {
          const bundle = yield* Effect.promise(() => route.load())
          const bunPaths = RouterPattern.toBun(path)
          for (const bunPath of bunPaths) {
            const internalPath = `${route.internalPathPrefix}${bunPath}`
            result[internalPath] = bundle
          }
        }
      }
    }

    for (const path of Object.keys(router.mounts) as Array<`/${string}`>) {
      const routeSet = router.mounts[path]

      const validationError = validateBunPattern(path)
      if (Option.isSome(validationError)) {
        return yield* Effect.fail(validationError.value)
      }

      const httpPaths = RouterPattern.toBun(path)

      const byMethod = new Map<Route.RouteMethod, Route.Route.Default[]>()
      for (const route of routeSet.set) {
        const existing = byMethod.get(route.method) ?? []
        existing.push(route)
        byMethod.set(route.method, existing)
      }

      for (const [method, routes] of byMethod) {
        const httpApp = makeHandler(routes)
        const webHandler = HttpApp.toWebHandlerRuntime(rt)(httpApp)
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
