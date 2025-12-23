import * as test from "bun:test"
import {
  Effect,
  Schema,
} from "effect"
import * as Route from "./Route.ts"
import * as RouteMount from "./RouteMount.ts"
import * as RouteSchema from "./RouteSchema.ts"

test.describe(`${RouteSchema.schemaHeaders.name}()`, () => {
  test.it("passes bindings and parses value", async () => {
    const headers = {
      "x-hello": "test-value",
    }
    type ExpectedBindings = {
      headers: typeof headers
    }

    const route = RouteMount.get(
      RouteSchema.schemaHeaders(
        Schema.Struct({
          "x-hello": Schema.String,
        }),
      ),
      Route.text((context) =>
        Effect.gen(function*() {
          test
            .expectTypeOf(context)
            .toExtend<ExpectedBindings>()

          test
            .expect(context)
            .toMatchObject({
              headers,
            })

          return "Hello, World!"
        })
      ),
    )

    test
      .expectTypeOf<Route.Route.Bindings<typeof route>>()
      .toExtend<ExpectedBindings>()
  })
})
