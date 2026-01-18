import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Effect from "effect/Effect"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import * as Route from "./Route.ts"
import * as RouteHook from "./RouteHook.ts"

export function schemaHeaders<
  A,
  I extends Readonly<Record<string, string | undefined>>,
  R,
>(
  fields: Schema.Schema<A, I, R>,
): <
  D extends Route.RouteDescriptor.Any,
  SB extends {},
  P extends Route.RouteSet.Tuple,
>(
  self: Route.RouteSet.RouteSet<D, SB, P>,
) => Route.RouteSet.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route.Route<
      {},
      { headers: A },
      void,
      ParseResult.ParseError,
      R | HttpServerRequest.HttpServerRequest
    >,
  ]
> {
  return RouteHook.filter((_ctx) =>
    Effect.map(
      HttpServerRequest.schemaHeaders(fields),
      (headers) => ({
        context: {
          headers,
        },
      }),
    )
  )
}
