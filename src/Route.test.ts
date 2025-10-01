import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Schema from "effect/Schema"
import * as Route from "./Route.ts"

test.it("makes JSON route", () => {
  const schemaUrlParams = Schema.Struct({
    id: Schema.String,
  })

  const route = Function.pipe(
    Route.empty,
    // route should provide Route.Request
    // View.Visit

    Route.schema({
      urlParams: schemaUrlParams,
    }),
    Route.json(
      Effect.succeed({
        username: "test",
      }),
    ),
  )

  test.expect(route).toMatchObject({
    schema: {
      urlParams: schemaUrlParams,
    },
    variants: [
      {
        method: "GET",
        type: "application/json",
      },
    ],
  })
})
