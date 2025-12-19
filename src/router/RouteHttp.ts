import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as Runtime from "effect/Runtime"
import * as ContentNegotiation from "../ContentNegotiation.ts"
import * as HttpAppExtra from "../HttpAppExtra.ts"
import * as HttpUtils from "../HttpUtils.ts"
import * as Hyper from "../hyper/Hyper.ts"
import * as HyperHtml from "../hyper/HyperHtml.ts"
import * as Route from "./Route.ts"
import * as RouteSet from "./RouteSet.ts"

const noopNext: Route.RouteNext = () => Effect.void

const MEDIA_PRIORITY = [
  "application/json",
  "text/plain",
  "text/html",
]

const kindToMime: Record<Route.RouteKind, string> = {
  text: "text/plain",
  html: "text/html",
  json: "application/json",
  http: "*/*",
}

const mimeToKind: Record<string, Route.RouteKind> = {
  "text/plain": "text",
  "text/html": "html",
  "application/json": "json",
}

export function render<E, R>(
  route: Route.Route<any, any, Route.RouteHandler<any, E, R>, any>,
  request: HttpServerRequest.HttpServerRequest,
): Effect.Effect<HttpServerResponse.HttpServerResponse, E, R> {
  return Effect.gen(function*() {
    const context = makeContext(HttpUtils.makeUrlFromRequest(request))
    const raw = yield* route.handler(context, noopNext)

    if (HttpServerResponse.isServerResponse(raw)) {
      return raw
    }

    switch (route.kind) {
      case "text":
        return HttpServerResponse.text(raw as string)

      case "html":
        if (Hyper.isGenericJsxObject(raw)) {
          return HttpServerResponse.html(HyperHtml.renderToString(raw))
        }
        return HttpServerResponse.html(raw as string)

      case "json":
        return HttpServerResponse.unsafeJson(raw)

      case "http":
      default:
        return HttpServerResponse.raw(String(raw))
    }
  })
}

export function matchKind(
  routeSet: RouteSet.RouteSet.Data<
    Route.Route.Array,
    Route.RouteSchemas
  >,
  accept: string,
): Route.Route.Default | undefined {
  const routes = RouteSet.items(routeSet)

  const contentRoutes = routes.filter((r) => r.kind !== "http")

  if (contentRoutes.length === 0) return undefined

  const availableKinds = contentRoutes
    .map((r) => r.kind)
    .filter((k): k is Exclude<Route.RouteKind, "http"> => k !== "http")

  const availableMimes = availableKinds.map((k) => kindToMime[k])

  const normalizedAccept = accept || "*/*"
  const hasWildcard = normalizedAccept.includes("*")
  const preferred = ContentNegotiation.media(normalizedAccept, availableMimes)

  if (preferred.length > 0) {
    if (hasWildcard) {
      for (const mime of MEDIA_PRIORITY) {
        if (preferred.includes(mime)) {
          const kind = mimeToKind[mime]
          return contentRoutes.find((r) => r.kind === kind)
        }
      }
    }
    const preferredKind = mimeToKind[preferred[0]]
    if (preferredKind) {
      return contentRoutes.find((r) => r.kind === preferredKind)
    }
  }

  return contentRoutes[0]
}

export const toHttpApp = (
  routeSet: RouteSet.RouteSet.Data<
    Route.Route.Array,
    Route.RouteSchemas
  >,
): HttpApp.Default<any, any> => {
  const routes = RouteSet.items(routeSet)

  const httpMiddleware = routes.filter((r) => r.kind === "http")

  let app: HttpApp.Default<any, any> = Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const accept = request.headers.accept ?? ""

    const selectedRoute = matchKind(routeSet, accept)

    if (!selectedRoute) {
      return HttpServerResponse.empty({ status: 406 })
    }

    return yield* render(selectedRoute, request).pipe(
      Effect.catchAllCause((cause) => HttpAppExtra.renderError(cause, accept)),
    )
  })

  for (const mw of [...httpMiddleware].reverse()) {
    const inner = app
    const next: Route.RouteNext = () => inner
    app = mw.handler({} as Route.RouteContext, next) as HttpApp.Default<
      any,
      any
    >
  }

  return app
}

export const toWebHandlerRuntime = <R>(
  runtime: Runtime.Runtime<R>,
) =>
(
  routeSet: RouteSet.RouteSet.Data<
    Route.Route.Array,
    Route.RouteSchemas
  >,
  middlewareRouteSet?: RouteSet.RouteSet.Data<
    Route.Route.Array,
    Route.RouteSchemas
  >,
): HttpUtils.FetchHandler => {
  let app = toHttpApp(routeSet)

  if (middlewareRouteSet) {
    const httpMiddleware = RouteSet.items(middlewareRouteSet).filter((r) =>
      r.kind === "http"
    )

    for (const mw of [...httpMiddleware].reverse()) {
      const inner = app
      const next: Route.RouteNext = () => inner
      app = mw.handler({} as Route.RouteContext, next) as HttpApp.Default<
        any,
        any
      >
    }
  }

  return HttpApp.toWebHandlerRuntime(runtime)(app)
}

export const toWebHandler = toWebHandlerRuntime(Runtime.defaultRuntime)

function makeContext(url: URL): Route.RouteContext {
  return {
    get url() {
      return url
    },
    slots: {},
  }
}
