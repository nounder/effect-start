import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as Runtime from "effect/Runtime"
import * as HttpAppExtra from "../HttpAppExtra.ts"
import * as HttpUtils from "../HttpUtils.ts"
import * as Hyper from "../hyper/Hyper.ts"
import * as HyperHtml from "../hyper/HyperHtml.ts"
import * as Route from "./Route.ts"
import * as Router from "./Router.ts"
import * as RouteSet from "./RouteSet.ts"
import { isHttpMiddlewareHandler } from "./RouteSet_http.ts"

export function render<E, R>(
  route: Route.Route<any, any, Route.RouteHandler<any, E, R>, any>,
  request: HttpServerRequest.HttpServerRequest,
): Effect.Effect<HttpServerResponse.HttpServerResponse, E, R> {
  return Effect.gen(function*() {
    const context = makeContext(HttpUtils.makeUrlFromRequest(request))
    const raw = yield* route.handler(context)

    if (HttpServerResponse.isServerResponse(raw)) {
      return raw
    }

    switch (route.media) {
      case "text/plain":
        return HttpServerResponse.text(raw as string)

      case "text/html":
        if (Hyper.isGenericJsxObject(raw)) {
          return HttpServerResponse.html(HyperHtml.renderToString(raw))
        }
        return HttpServerResponse.html(raw as string)

      case "application/json":
        return HttpServerResponse.unsafeJson(raw)

      case "*":
      default:
        return HttpServerResponse.raw(String(raw))
    }
  })
}

export const toHttpApp = (
  routeSet: RouteSet.Instance<
    ReadonlyArray<Route.Route.Default>,
    Route.RouteSchemas
  >,
): HttpApp.Default<any, any> => {
  const routes = routeSet.set

  const httpMiddleware = routes.filter((r) =>
    isHttpMiddlewareHandler(r.handler)
  )

  let app: HttpApp.Default<any, any> = Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const accept = request.headers.accept ?? ""

    const selectedRoute = Router.matchMedia(routeSet, accept)

    if (!selectedRoute) {
      return HttpServerResponse.empty({ status: 406 })
    }

    return yield* render(selectedRoute, request).pipe(
      Effect.catchAllCause((cause) => HttpAppExtra.renderError(cause, accept)),
    )
  })

  // Wrap with HttpMiddleware (first middleware is outermost)
  for (const mw of [...httpMiddleware].reverse()) {
    const inner = app
    app = mw.handler(
      { next: () => inner } as Route.RouteContext,
    ) as HttpApp.Default<any, any>
  }

  return app
}

export const toWebHandlerRuntime = <R>(
  runtime: Runtime.Runtime<R>,
) =>
(
  routeSet: RouteSet.Instance<
    ReadonlyArray<Route.Route.Default>,
    Route.RouteSchemas
  >,
  middlewareRouteSet?: RouteSet.Instance<
    ReadonlyArray<Route.Route.Default>,
    Route.RouteSchemas
  >,
): HttpUtils.FetchHandler => {
  let app = toHttpApp(routeSet)

  if (middlewareRouteSet) {
    const httpMiddleware = middlewareRouteSet.set.filter((r) =>
      isHttpMiddlewareHandler(r.handler)
    )

    for (const mw of [...httpMiddleware].reverse()) {
      const inner = app
      app = mw.handler(
        { next: () => inner } as Route.RouteContext,
      ) as HttpApp.Default<any, any>
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
    next: () => Effect.void,
  }
}
