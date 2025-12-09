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
import * as HttpAppExtra from "../HttpAppExtra.ts"
import * as HttpUtils from "../HttpUtils.ts"
import * as HyperHtml from "../HyperHtml.ts"
import * as Random from "../Random.ts"
import * as Route from "../Route.ts"
import * as Router from "../Router.ts"
import * as RouteRender from "../RouteRender.ts"
import * as RouterPattern from "../RouterPattern.ts"
import * as BunHttpServer from "./BunHttpServer.ts"

const TypeId: unique symbol = Symbol.for("effect-start/BunRoute")

const INTERNAL_FETCH_HEADER = "x-effect-start-internal-fetch"

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
    Router.RouterError,
    BunHttpServer.BunServer
  > = (context) =>
    Effect.gen(function*() {
      const originalRequest = context.request.source as Request

      if (
        originalRequest.headers.get(INTERNAL_FETCH_HEADER) === "true"
      ) {
        return yield* Effect.fail(
          new Router.RouterError({
            reason: "ProxyError",
            pattern: context.url.pathname,
            message:
              "Request to internal Bun server was caught by BunRoute handler. This should not happen. Please report a bug.",
          }),
        )
      }

      const bunServer = yield* BunHttpServer.BunServer
      const internalPath = `${internalPathPrefix}${context.url.pathname}`
      const internalUrl = new URL(internalPath, bunServer.server.url)

      const headers = new Headers(originalRequest.headers)
      headers.set(INTERNAL_FETCH_HEADER, "true")

      const proxyRequest = new Request(internalUrl, {
        method: originalRequest.method,
        headers,
      })

      const response = yield* Effect.tryPromise({
        try: () => fetch(proxyRequest),
        catch: (error) =>
          new Router.RouterError({
            reason: "ProxyError",
            pattern: internalPath,
            message: `Failed to fetch internal HTML bundle: ${String(error)}`,
          }),
      })

      let html = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: (error) =>
          new Router.RouterError({
            reason: "ProxyError",
            pattern: internalPath,
            message: String(error),
          }),
      })

      const children = yield* context.next<Router.RouterError, never>()
      let childrenHtml = ""
      if (children != null) {
        if (HttpServerResponse.isServerResponse(children)) {
          const webResponse = HttpServerResponse.toWeb(children)
          childrenHtml = yield* Effect.promise(() => webResponse.text())
        } else if (Route.isGenericJsxObject(children)) {
          childrenHtml = HyperHtml.renderToString(children)
        } else {
          childrenHtml = String(children)
        }
      }

      html = html.replace(/%yield%/g, childrenHtml)
      html = html.replace(/%slots\.(\w+)%/g, (_, name) =>
        context.slots[name] ?? "")

      return HttpServerResponse
        .html(html)
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

    return yield* RouteRender.render(selectedRoute, context).pipe(
      Effect.catchAllCause((cause) => HttpAppExtra.renderError(cause, accept)),
    )
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
 * Validates that a route pattern can be implemented with Bun.serve routes.
 *
 * Supported patterns (native or via multiple routes):
 * - /exact        - Exact match
 * - /users/:id    - Full-segment named param
 * - /path/*       - Directory wildcard
 * - /*            - Catch-all
 * - /[[id]]       - Optional param (implemented via `/` and `/:id`)
 * - /[[...rest]]  - Optional rest param (implemented via `/` and `/*`)
 *
 * Unsupported patterns (cannot be implemented in Bun):
 * - /pk_[id]   - Prefix before param
 * - /[id]_sfx  - Suffix after param
 * - /[id].json - Suffix with dot
 * - /[id]~test - Suffix with tilde
 * - /hello-*   - Inline prefix wildcard
 */

export function validateBunPattern(
  pattern: string,
): Option.Option<Router.RouterError> {
  const segments = RouterPattern.parse(pattern)

  const unsupported = Array.findFirst(segments, (seg) => {
    if (seg._tag === "ParamSegment") {
      return seg.prefix !== undefined || seg.suffix !== undefined
    }

    return false
  })

  if (Option.isSome(unsupported)) {
    return Option.some(
      new Router.RouterError({
        reason: "UnsupportedPattern",
        pattern,
        message:
          `Pattern "${pattern}" uses prefixed/suffixed params (prefix_[param] or [param]_suffix) `
          + `which cannot be implemented in Bun.serve.`,
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
      const { path, route: routeSet, layers } = entry

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

      for (const layer of layers) {
        for (const route of layer.set) {
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
    }

    for (const path of Object.keys(router.mounts)) {
      const routeSet = router.mounts[path]

      const validationError = validateBunPattern(path)
      if (Option.isSome(validationError)) {
        continue
      }

      const httpPaths = RouterPattern.toBun(path as Route.RoutePattern)

      const byMethod = new Map<Route.RouteMethod, Route.Route.Default[]>()
      for (const route of routeSet.set) {
        const existing = byMethod.get(route.method) ?? []
        existing.push(route)
        byMethod.set(route.method, existing)
      }

      const entry = router.entries.find((e) => e.path === path)
      const allMiddleware = (entry?.layers ?? [])
        .map((layer) => layer.httpMiddleware)
        .filter((m): m is Route.HttpMiddlewareFunction => m !== undefined)

      for (const [method, routes] of byMethod) {
        let httpApp: HttpApp.Default<any, any> = makeHandler(routes)

        for (const middleware of allMiddleware) {
          httpApp = middleware(httpApp)
        }

        const webHandler = HttpApp.toWebHandlerRuntime(rt)(httpApp)
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

export const isHTMLBundle = (handle: any) => {
  return (
    typeof handle === "object"
    && handle !== null
    && (handle.toString() === "[object HTMLBundle]"
      || typeof handle.index === "string")
  )
}
