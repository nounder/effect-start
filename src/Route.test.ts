import { it } from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Route from "./Route"
import { effectFn } from "./testing"

const effect = effectFn()

const SampleModule = {
  GET: Route.define({
    success: Schema.Struct({
      id: Schema.UUID,
    }),

    handler: Effect.gen(function*() {
      return {
        id: crypto.randomUUID(),
      }
    }),
  }),

  POST: Route.define({
    success: Schema.Array(
      Schema.Struct({
        id: Schema.String,
      }),
    ),

    handler: Effect.gen(function*() {
      return [{
        id: "a",
      }]
    }),
  }),
}

it("from HttpApiEndpoint", () => {
  const route = Route.bind(SampleModule.GET, {
    path: "/",
    method: "GET",
  })
  const ep = Route.toHttpApiEndpoint(route)
})
