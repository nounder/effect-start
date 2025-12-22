import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as RouteHook from "./RouteHook.ts"

export function schemaHeaders<
  A,
  I extends Readonly<Record<string, string | undefined>>,
  R,
>(
  fields: Schema.Schema<A, I, R>,
) {
  return RouteHook.filter(() =>
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
