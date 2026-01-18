import * as test from "bun:test"
import {
  Effect,
  Schema,
} from "effect"
import * as Route from "./Route.ts"
import * as RouteMount from "./RouteMount.ts"
import * as RouteSchema from "./RouteSchema.ts"

test.describe(`${RouteSchema.schemaHeaders.name}()`, () => {
  test.it(`${RouteSchema.schemaHeaders.name} merges`, () => {
    type ExpectedBindings = {
      hello: string
      "x-custom-header": string
    }
    const route = Route
      .use(
        RouteSchema.schemaHeaders(
          Schema.Struct({
            "hello": Schema.String,
          }),
        ),
      )
      .get(
        RouteSchema.schemaHeaders(
          Schema.Struct({
            "x-custom-header": Schema.String,
          }),
        ),
        Route.html(function*(ctx) {
          test
            .expectTypeOf(ctx.headers)
            .toExtend<ExpectedBindings>()

          return `<h1>Hello, world!</h1>`
        }),
      )

    test
      .expectTypeOf<Route.Route.Bindings<typeof route>>()
      .toExtend<{
        headers: ExpectedBindings
      }>()
  })

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
