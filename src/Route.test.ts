import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Schema from "effect/Schema"
import * as Route from "./Route.ts"

const schemaUrlParams = Schema.Struct({
  id: Schema.String,
})

const schemaSuccess = Schema.Struct({
  username: Schema.String,
})

test.it("creates a data route", () => {
  const z = Route.schema({
    pathParams: Schema.String,
    headers: Schema.String,
  })(Route.empty)

  const route = Function.pipe(
    Route.empty,
    // route should provide Route.Request
    // View.Visit

    Route.schema({
      pathParams: Schema.String,
    }),
    // Route.data(
    //   Effect.succeed({ username: "user" }),
    // ),
  )

  test.expect(route).toMatchObject({
    schema: {
      UrlParams: schemaUrlParams,
      Success: schemaSuccess,
    },
    variants: [
      {
        method: "GET",
        type: "application/json",
      },
    ],
  })
})
