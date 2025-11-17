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

test.it("schema methods set schemas on RouteSet", () => {
  const PathParamsSchema = Schema.Struct({
    id: Schema.String,
  })

  const routeSet = Route
    .schemaPathParams(PathParamsSchema)

  test
    .expect(routeSet.schemas.pathParams)
    .toBe(PathParamsSchema)
})

test.it("schema propagates from RouteSet to Route", () => {
  const PathParamsSchema = Schema.Struct({
    id: Schema.String,
  })

  const routeSet = Route
    .schemaPathParams(PathParamsSchema)
    .text(
      Effect.succeed("hello"),
    )

  const route = routeSet.set[0]

  test
    .expect(route)
    .toBeDefined()

  test
    .expect(route?.schemas.pathParams)
    .toBe(PathParamsSchema)
})

test.it("multiple schemas can be set on RouteSet", () => {
  const PathParamsSchema = Schema.Struct({
    id: Schema.String,
  })

  const PayloadSchema = Schema.Struct({
    name: Schema.String,
  })

  const routeSet = Route
    .schemaPathParams(PathParamsSchema)
    .schemaPayload(PayloadSchema)

  test
    .expect(routeSet.schemas.pathParams)
    .toBe(PathParamsSchema)

  test
    .expect(routeSet.schemas.payload)
    .toBe(PayloadSchema)
})

test.it("schemas propagate to all routes in RouteSet", () => {
  const PathParamsSchema = Schema.Struct({
    id: Schema.String,
  })

  const routeSet = Route
    .schemaPathParams(PathParamsSchema)
    .get(
      Route
        .text(
          Effect.succeed("hello"),
        )
        .html(
          Effect.succeed("<div>hello</div>"),
        ),
    )

  const textRoute = routeSet.set[0]
  const htmlRoute = routeSet.set[1]

  test
    .expect(textRoute?.schemas.pathParams)
    .toBe(PathParamsSchema)

  test
    .expect(htmlRoute?.schemas.pathParams)
    .toBe(PathParamsSchema)
})

test.it("schema from RouteSet and Route are merged when both exist", () => {
  const PathParamsSchema1 = Schema.Struct({
    id: Schema.String,
  })

  const PathParamsSchema2 = Schema.Struct({
    slug: Schema.String,
  })

  const routeSet = Route
    .schemaPathParams(PathParamsSchema1)
    .get(
      Route
        .schemaPathParams(PathParamsSchema2)
        .text(
          Effect.succeed("hello"),
        ),
    )

  const route = routeSet.set[0]

  test
    .expect(route?.schemas.pathParams)
    .toBeDefined()

  test
    .expect(route?.schemas.pathParams?.ast._tag)
    .toBe("Union")
})

test.it("types context with pathParams schema", () => {
  const PathParamsSchema = Schema.Struct({
    id: Schema.String,
  })

  Route
    .schemaPathParams(PathParamsSchema)
    .text((context) => {
      type ContextType = typeof context
      type ExpectedContext = Route.RouteContext<{
        pathParams: typeof PathParamsSchema
      }>

      Function.satisfies<ExpectedContext>()(context)

      return Effect.succeed("hello")
    })
})

test.it("types context with multiple schemas", () => {
  const PathParamsSchema = Schema.Struct({
    id: Schema.String,
  })

  const PayloadSchema = Schema.Struct({
    name: Schema.String,
    email: Schema.String,
  })

  Route
    .schemaPathParams(PathParamsSchema)
    .schemaPayload(PayloadSchema)
    .json((context) => {
      type ExpectedContext = Route.RouteContext<{
        pathParams: typeof PathParamsSchema
        payload: typeof PayloadSchema
      }>

      Function.satisfies<ExpectedContext>()(context)

      return Effect.succeed({
        message: "ok",
      })
    })
})

test.it("context includes validated pathParams property", () => {
  const PathParamsSchema = Schema.Struct({
    id: Schema.String,
  })

  Route
    .schemaPathParams(PathParamsSchema)
    .text((context) => {
      const pathParams: {
        id: string
      } = context.pathParams

      Function.satisfies<{
        id: string
      }>()(pathParams)

      return Effect.succeed("hello")
    })
})

test.it("context includes validated payload property", () => {
  const PayloadSchema = Schema.Struct({
    name: Schema.String,
    age: Schema.Number,
  })

  Route
    .schemaPayload(PayloadSchema)
    .json((context) => {
      const payload: {
        name: string
        age: number
      } = context.payload

      Function.satisfies<{
        name: string
        age: number
      }>()(payload)

      return Effect.succeed({
        ok: true,
      })
    })
})

test.it("schemas work with method modifiers", () => {
  const PathParamsSchema = Schema.Struct({
    id: Schema.String,
  })

  const routeSet = Route
    .schemaPathParams(PathParamsSchema)
    .post(
      Route.json(
        Effect.succeed({
          message: "created",
        }),
      ),
    )

  const route = routeSet.set[0]

  test
    .expect(route?.method)
    .toBe("POST")

  test
    .expect(route?.schemas.pathParams)
    .toBe(PathParamsSchema)
})

test.it("all schema methods can be chained", () => {
  const PathParamsSchema = Schema.Struct({
    id: Schema.String,
  })
  const UrlParamsSchema = Schema.Struct({
    page: Schema.Number,
  })
  const PayloadSchema = Schema.Struct({
    name: Schema.String,
  })
  const SuccessSchema = Schema.Struct({
    message: Schema.String,
  })
  const ErrorSchema = Schema.Struct({
    error: Schema.String,
  })
  const HeadersSchema = Schema.Struct({
    authorization: Schema.String,
  })

  const routeSet = Route
    .schemaPathParams(PathParamsSchema)
    .schemaUrlParams(UrlParamsSchema)
    .schemaPayload(PayloadSchema)
    .schemaSuccess(SuccessSchema)
    .schemaError(ErrorSchema)
    .schemaHeaders(HeadersSchema)

  test
    .expect(routeSet.schemas.pathParams)
    .toBe(PathParamsSchema)

  test
    .expect(routeSet.schemas.urlParams)
    .toBe(UrlParamsSchema)

  test
    .expect(routeSet.schemas.payload)
    .toBe(PayloadSchema)

  test
    .expect(routeSet.schemas.success)
    .toBe(SuccessSchema)

  test
    .expect(routeSet.schemas.error)
    .toBe(ErrorSchema)

  test
    .expect(routeSet.schemas.headers)
    .toBe(HeadersSchema)
})

test.it("complex scenario: schema propagation and merging", () => {
  const BasePathParams = Schema.Struct({
    id: Schema.String,
  })

  const RoutePathParams = Schema.Struct({
    slug: Schema.String,
  })

  const PayloadSchema = Schema.Struct({
    title: Schema.String,
  })

  const routeSet = Route
    .schemaPathParams(BasePathParams)
    .schemaPayload(PayloadSchema)
    .get(
      Route
        .text(
          Effect.succeed("list"),
        )
        .html(
          Effect.succeed("<div>list</div>"),
        ),
    )
    .post(
      Route
        .schemaPathParams(RoutePathParams)
        .json(
          Effect.succeed({
            created: true,
          }),
        ),
    )

  const getTextRoute = routeSet.set[0]
  const getHtmlRoute = routeSet.set[1]
  const postRoute = routeSet.set[2]

  test
    .expect(getTextRoute?.schemas.pathParams)
    .toBe(BasePathParams)

  test
    .expect(getTextRoute?.schemas.payload)
    .toBe(PayloadSchema)

  test
    .expect(getHtmlRoute?.schemas.pathParams)
    .toBe(BasePathParams)

  test
    .expect(getHtmlRoute?.schemas.payload)
    .toBe(PayloadSchema)

  test
    .expect(postRoute?.schemas.pathParams?.ast._tag)
    .toBe("Union")

  test
    .expect(postRoute?.schemas.payload)
    .toBe(PayloadSchema)
})
