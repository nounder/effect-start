import { it } from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Route from "./Route"

const SampleModule = {
  GET: Route.make({
    success: Schema.Struct({
      id: Schema.UUID,
    }),

    handler: (req) =>
      Effect.gen(function*() {
        return {
          id: crypto.randomUUID(),
        }
      }),
  }),

  POST: Route.make({
    handler: (req) =>
      Effect.gen(function*() {
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
