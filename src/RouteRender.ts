import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as HyperHtml from "./HyperHtml.ts"
import * as Route from "./Route.ts"

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

    switch (route.media) {
      case "text/plain":
        return HttpServerResponse.text(raw as string)

      case "text/html":
        if (Route.isJsxObject(raw)) {
          return HttpServerResponse.html(HyperHtml.renderToString(raw))
        }
        return HttpServerResponse.html(raw as string)

      case "application/json":
        return HttpServerResponse.unsafeJson(raw)

      case "*":
      default:
        if (HttpServerResponse.isServerResponse(raw)) {
          return raw
        }
        return HttpServerResponse.text(String(raw))
    }
  })
}
