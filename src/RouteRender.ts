import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as ContentNegotiation from "./Accept.ts"
import * as HyperHtml from "./HyperHtml.ts"
import * as Route from "./Route.ts"

const WILDCARD_PRIORITY: Route.RouteMedia[] = [
  "application/json",
  "text/plain",
  "text/html",
]

export function selectRouteByMedia(
  routes: Route.Route.Default[],
  accept: string,
): Route.Route.Default | undefined {
  const availableMedia = routes
    .map((r) => r.media)
    .filter((m): m is Exclude<Route.RouteMedia, "*"> => m !== "*")

  const normalizedAccept = accept || "*/*"
  const hasWildcard = normalizedAccept.includes("*")
  const preferred = ContentNegotiation.media(normalizedAccept, availableMedia)

  if (preferred.length > 0) {
    if (hasWildcard) {
      for (const media of WILDCARD_PRIORITY) {
        if (preferred.includes(media)) {
          return routes.find((r) => r.media === media)
        }
      }
    }
    return routes.find((r) => r.media === preferred[0])
  }

  return routes.find((r) => r.media === "*") ?? routes[0]
}

/**
 * Renders a route handler to an HttpServerResponse.
 * Converts the raw handler value to a response based on the route's media type.
 */
export function render<E, R>(
  route: Route.Route<any, any, Route.RouteHandler<any, E, R>, any>,
  context: Route.RouteContext,
): Effect.Effect<HttpServerResponse.HttpServerResponse, E, R> {
  return Effect.gen(function*() {
    const raw = yield* route.handler(context)

    // Allow handlers to return HttpServerResponse directly (e.g. BunRoute proxy)
    if (HttpServerResponse.isServerResponse(raw)) {
      return raw
    }

    switch (route.media) {
      case "text/plain":
        return HttpServerResponse.text(raw as string)

      case "text/html":
        if (Route.isGenericJsxObject(raw)) {
          return HttpServerResponse.html(HyperHtml.renderToString(raw))
        }
        return HttpServerResponse.html(raw as string)

      case "application/json":
        return HttpServerResponse.unsafeJson(raw)

      case "*":
      default:
        return HttpServerResponse.text(String(raw))
    }
  })
}
