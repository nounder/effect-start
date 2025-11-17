import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Schema from "effect/Schema"
import * as Route from "./Route.ts"

test.it("types default routes", () => {
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

test.it("types GET & POST routes", () => {
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

test.it("schemaPathParams adds schema to RouteSet", () => {
  const IdSchema = Schema.Struct({
    id: Schema.String,
  })

  const routes = Route
    .schemaPathParams(IdSchema)
    .text(
      Effect.succeed("hello"),
    )

  type ExpectedSchemas = {
    readonly PathParams: typeof IdSchema
  }

  type Expected = Route.RouteSet<
    [Route.Route<"GET", "text/plain", any, ExpectedSchemas>],
    ExpectedSchemas
  >

  Function.satisfies<Expected>()(routes)
})

test.it("schemaPathParams accepts struct fields directly", () => {
  const routes = Route
    .schemaPathParams({
      id: Schema.String,
    })
    .text(
      Effect.succeed("hello"),
    )

  type ExpectedSchemas = {
    readonly PathParams: Schema.Struct<{
      id: typeof Schema.String
    }>
  }

  type Expected = Route.RouteSet<
    [Route.Route<"GET", "text/plain", any, ExpectedSchemas>],
    ExpectedSchemas
  >

  Function.satisfies<Expected>()(routes)
})

test.it("schemaPathParams with struct fields types context correctly", () => {
  Route
    .schemaPathParams({
      id: Schema.String,
    })
    .text(
      (context) => {
        Function.satisfies<string>()(context.pathParams.id)

        return Effect.succeed("hello")
      },
    )
})

test.it("schemaPayload propagates to all routes", () => {
  const PayloadSchema = Schema.Struct({
    name: Schema.String,
    age: Schema.Number,
  })

  const routes = Route
    .schemaPayload(PayloadSchema)
    .get(
      Route.text(
        Effect.succeed("get"),
      ),
    )
    .post(
      Route.text(
        Effect.succeed("post"),
      ),
    )

  type ExpectedSchemas = {
    readonly Payload: typeof PayloadSchema
  }

  type Expected = Route.RouteSet<
    [
      Route.Route<"GET", "text/plain", any, ExpectedSchemas>,
      Route.Route<"POST", "text/plain", any, ExpectedSchemas>,
    ],
    ExpectedSchemas
  >

  Function.satisfies<Expected>()(routes)
})

test.it("context is typed with pathParams when schemaPathParams is provided", () => {
  const IdSchema = Schema.Struct({
    id: Schema.String,
  })

  Route
    .schemaPathParams(IdSchema)
    .text(
      (context) => {
        type ContextType = typeof context

        type Expected = Route.RouteContext<{
          readonly PathParams: typeof IdSchema
        }>

        Function.satisfies<Expected>()(context)

        Function.satisfies<string>()(context.pathParams.id)

        return Effect.succeed("hello")
      },
    )
})

test.it("context is typed with urlParams when schemaUrlParams is provided", () => {
  const QuerySchema = Schema.Struct({
    page: Schema.NumberFromString,
    limit: Schema.NumberFromString,
  })

  Route
    .schemaUrlParams(QuerySchema)
    .text(
      (context) => {
        type Expected = Route.RouteContext<{
          readonly UrlParams: typeof QuerySchema
        }>

        Function.satisfies<Expected>()(context)

        Function.satisfies<number>()(context.urlParams.page)

        Function.satisfies<number>()(context.urlParams.limit)

        return Effect.succeed("hello")
      },
    )
})

test.it("context is typed with payload when schemaPayload is provided", () => {
  const PayloadSchema = Schema.Struct({
    name: Schema.String,
    age: Schema.Number,
  })

  Route
    .schemaPayload(PayloadSchema)
    .text(
      (context) => {
        type Expected = Route.RouteContext<{
          readonly Payload: typeof PayloadSchema
        }>

        Function.satisfies<Expected>()(context)

        Function.satisfies<string>()(context.payload.name)

        Function.satisfies<number>()(context.payload.age)

        return Effect.succeed("hello")
      },
    )
})

test.it("context is typed with headers when schemaHeaders is provided", () => {
  const HeadersSchema = Schema.Struct({
    authorization: Schema.String,
  })

  Route
    .schemaHeaders(HeadersSchema)
    .text(
      (context) => {
        type Expected = Route.RouteContext<{
          readonly Headers: typeof HeadersSchema
        }>

        Function.satisfies<Expected>()(context)

        Function.satisfies<string>()(context.headers.authorization)

        return Effect.succeed("hello")
      },
    )
})

test.it("context is typed with multiple schemas", () => {
  const IdSchema = Schema.Struct({
    id: Schema.String,
  })

  const QuerySchema = Schema.Struct({
    page: Schema.NumberFromString,
  })

  const PayloadSchema = Schema.Struct({
    name: Schema.String,
  })

  Route
    .schemaPathParams(IdSchema)
    .schemaUrlParams(QuerySchema)
    .schemaPayload(PayloadSchema)
    .text(
      (context) => {
        type Expected = Route.RouteContext<{
          readonly PathParams: typeof IdSchema
          readonly UrlParams: typeof QuerySchema
          readonly Payload: typeof PayloadSchema
        }>

        Function.satisfies<Expected>()(context)

        Function.satisfies<string>()(context.pathParams.id)

        Function.satisfies<number>()(context.urlParams.page)

        Function.satisfies<string>()(context.payload.name)

        return Effect.succeed("hello")
      },
    )
})

test.it("schemaSuccess and schemaError are stored in RouteSet", () => {
  const SuccessSchema = Schema.Struct({
    ok: Schema.Boolean,
  })

  const ErrorSchema = Schema.Struct({
    error: Schema.String,
  })

  const routes = Route
    .schemaSuccess(SuccessSchema)
    .schemaError(ErrorSchema)
    .text(
      Effect.succeed("hello"),
    )

  type ExpectedSchemas = {
    readonly Success: typeof SuccessSchema
    readonly Error: typeof ErrorSchema
  }

  type Expected = Route.RouteSet<
    [Route.Route<"GET", "text/plain", any, ExpectedSchemas>],
    ExpectedSchemas
  >

  Function.satisfies<Expected>()(routes)
})

test.it("all schema methods work together", () => {
  const PathSchema = Schema.Struct({
    id: Schema.String,
  })

  const QuerySchema = Schema.Struct({
    page: Schema.NumberFromString,
  })

  const PayloadSchema = Schema.Struct({
    name: Schema.String,
  })

  const SuccessSchema = Schema.Struct({
    ok: Schema.Boolean,
  })

  const ErrorSchema = Schema.Struct({
    error: Schema.String,
  })

  const HeadersSchema = Schema.Struct({
    authorization: Schema.String,
  })

  const routes = Route
    .schemaPathParams(PathSchema)
    .schemaUrlParams(QuerySchema)
    .schemaPayload(PayloadSchema)
    .schemaSuccess(SuccessSchema)
    .schemaError(ErrorSchema)
    .schemaHeaders(HeadersSchema)
    .text(
      Effect.succeed("hello"),
    )

  type ExpectedSchemas = {
    readonly PathParams: typeof PathSchema
    readonly UrlParams: typeof QuerySchema
    readonly Payload: typeof PayloadSchema
    readonly Success: typeof SuccessSchema
    readonly Error: typeof ErrorSchema
    readonly Headers: typeof HeadersSchema
  }

  type Expected = Route.RouteSet<
    [Route.Route<"GET", "text/plain", any, ExpectedSchemas>],
    ExpectedSchemas
  >

  Function.satisfies<Expected>()(routes)
})
