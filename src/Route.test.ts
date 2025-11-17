import { expect, it } from "bun:test"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Schema from "effect/Schema"
import * as Route from "./Route.ts"

it("types default routes", () => {
  const implicit = Route
    .text(
      Effect.succeed("hello"),
    )
    .html(
      Effect.succeed(""),
    )

  const explicit = Route
    .get(
      Route
        .text(
          Effect.succeed("hello"),
        )
        .html(
          Effect.succeed(""),
        ),
    )

  type Expected = Route.RouteSet<[
    Route.Route<"GET", "text/plain">,
    Route.Route<"GET", "text/html">,
  ]>

  Function.satisfies<Expected>()(implicit)
  Function.satisfies<Expected>()(explicit)
})

it("types GET & POST routes", () => {
  const implicit = Route
    .text(
      Effect.succeed("hello"),
    )
    .html(
      Effect.succeed(""),
    )
    .post(
      Route.json(
        Effect.succeed({
          message: "created",
        }),
      ),
    )

  const explicit = Route
    .get(
      Route
        .text(
          Effect.succeed("hello"),
        )
        .html(
          Effect.succeed(""),
        ),
    )
    .post(
      Route.json(
        Effect.succeed({
          message: "created",
        }),
      ),
    )

  type Expected = Route.RouteSet<[
    Route.Route<"GET", "text/plain">,
    Route.Route<"GET", "text/html">,
    Route.Route<"POST", "application/json">,
  ]>

  Function.satisfies<Expected>()(implicit)
  Function.satisfies<Expected>()(explicit)
})

it("schema propagates from RouteSet to Route on schemaPayload", () => {
  const payloadSchema = Schema.Struct({
    name: Schema.String,
    age: Schema.Number,
  })

  const route = Route
    .schemaPayload(payloadSchema)
    .text(Effect.succeed("ok"))

  const [textRoute] = route.set

  // Text route should have the schemaPayload from RouteSet
  expect(textRoute.schemaPayload)
    .toBe(payloadSchema)
})

it("schema propagates from RouteSet to Route on schemaPathParams", () => {
  const pathSchema = Schema.Struct({
    id: Schema.String,
  })

  const route = Route
    .schemaPathParams(pathSchema)
    .json(Effect.succeed({ id: "123" }))

  const [jsonRoute] = route.set

  expect(jsonRoute.schemaPathParams)
    .toBe(pathSchema)
})

it("multiple schemas propagate from RouteSet to Route", () => {
  const pathSchema = Schema.Struct({
    id: Schema.String,
  })
  const payloadSchema = Schema.Struct({
    name: Schema.String,
  })
  const headersSchema = Schema.Struct({
    "x-custom": Schema.String,
  })

  const route = Route
    .schemaPathParams(pathSchema)
    .schemaPayload(payloadSchema)
    .schemaHeaders(headersSchema)
    .post(Route.json(Effect.succeed({ success: true })))

  const [postRoute] = route.set

  expect(postRoute.schemaPathParams)
    .toBe(pathSchema)

  expect(postRoute.schemaPayload)
    .toBe(payloadSchema)

  expect(postRoute.schemaHeaders)
    .toBe(headersSchema)
})

it("schemas propagate through method modifiers", () => {
  const payloadSchema = Schema.Struct({
    data: Schema.String,
  })

  const route = Route
    .schemaPayload(payloadSchema)
    .get(Route.text(Effect.succeed("hello")))
    .post(Route.json(Effect.succeed({ ok: true })))

  const [getRoute, postRoute] = route.set

  expect(getRoute.schemaPayload)
    .toBe(payloadSchema)

  expect(postRoute.schemaPayload)
    .toBe(payloadSchema)
})

it("schemas are maintained when chaining multiple schemas", () => {
  const pathSchema = Schema.Struct({ id: Schema.String })
  const payloadSchema = Schema.Struct({ name: Schema.String })
  const successSchema = Schema.Struct({ id: Schema.String })

  const route = Route
    .schemaPathParams(pathSchema)
    .schemaPayload(payloadSchema)
    .schemaSuccess(successSchema)
    .post(Route.json(Effect.succeed({ id: "123" })))

  const [postRoute] = route.set

  expect(postRoute.schemaPathParams)
    .toBe(pathSchema)

  expect(postRoute.schemaPayload)
    .toBe(payloadSchema)

  expect(postRoute.schemaSuccess)
    .toBe(successSchema)
})

it("schema type information is preserved in RouteContext", () => {
  const pathSchema = Schema.Struct({
    id: Schema.String,
  })

  // This test verifies type checking - the handler should receive pathParams
  const route = Route
    .schemaPathParams(pathSchema)
    .text(
      function*(context) {
        // With pathSchema defined, context should have pathParams property
        // This is a type-level test - if TypeScript complains, the test fails
        type ContextType = typeof context
        type HasPathParams = "pathParams" extends keyof ContextType ? true : false
        const _: HasPathParams = true

        return yield* Effect.succeed("ok")
      },
    )

  // Just verify the route was created successfully
  expect(route.set.length)
    .toBe(1)
})

it("all schema methods return RouteSet", () => {
  const schema = Schema.Struct({ test: Schema.String })

  const pathParamsSet = Route.schemaPathParams(schema)
  const urlParamsSet = Route.schemaUrlParams(schema)
  const payloadSet = Route.schemaPayload(schema)
  const successSet = Route.schemaSuccess(schema)
  const errorSet = Route.schemaError(schema)
  const headersSet = Route.schemaHeaders(schema)

  expect(Route.isRouteSet(pathParamsSet))
    .toBe(true)

  expect(Route.isRouteSet(urlParamsSet))
    .toBe(true)

  expect(Route.isRouteSet(payloadSet))
    .toBe(true)

  expect(Route.isRouteSet(successSet))
    .toBe(true)

  expect(Route.isRouteSet(errorSet))
    .toBe(true)

  expect(Route.isRouteSet(headersSet))
    .toBe(true)
})

it("schema methods can be chained in any order", () => {
  const pathSchema = Schema.Struct({ id: Schema.String })
  const payloadSchema = Schema.Struct({ data: Schema.String })
  const headerSchema = Schema.Struct({ auth: Schema.String })

  // Test different ordering
  const route1 = Route
    .schemaPayload(payloadSchema)
    .schemaPathParams(pathSchema)
    .schemaHeaders(headerSchema)
    .post(Route.json(Effect.succeed({ ok: true })))

  const route2 = Route
    .schemaPathParams(pathSchema)
    .schemaHeaders(headerSchema)
    .schemaPayload(payloadSchema)
    .post(Route.json(Effect.succeed({ ok: true })))

  const [route1Handler] = route1.set
  const [route2Handler] = route2.set

  // Both should have all schemas
  expect(route1Handler.schemaPayload)
    .toBe(payloadSchema)

  expect(route1Handler.schemaPathParams)
    .toBe(pathSchema)

  expect(route1Handler.schemaHeaders)
    .toBe(headerSchema)

  expect(route2Handler.schemaPayload)
    .toBe(payloadSchema)

  expect(route2Handler.schemaPathParams)
    .toBe(pathSchema)

  expect(route2Handler.schemaHeaders)
    .toBe(headerSchema)
})
