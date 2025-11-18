import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Schema from "effect/Schema"
import * as Route from "./Route.ts"

t.it("types default routes", () => {
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

t.it("types GET & POST routes", () => {
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

t.it("schemaPathParams adds schema to RouteSet", () => {
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

t.it("schemaPathParams accepts struct fields directly", () => {
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

t.it("schemaPathParams with struct fields types context correctly", () => {
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

t.it("schemaPayload propagates to all routes", () => {
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

t.it("context is typed with pathParams when schemaPathParams is provided", () => {
  const IdSchema = Schema.Struct({
    id: Schema.String,
  })

  Route
    .schemaPathParams(IdSchema)
    .text(
      (context) => {
        type ContextType = typeof context

        type Expected = Route.RouteContext<{
          pathParams: {
            id: string
          }
        }>

        Function.satisfies<Expected>()(context)

        Function.satisfies<string>()(context.pathParams.id)

        return Effect.succeed("hello")
      },
    )
})

t.it("context is typed with urlParams when schemaUrlParams is provided", () => {
  const QuerySchema = Schema.Struct({
    page: Schema.NumberFromString,
    limit: Schema.NumberFromString,
  })

  Route
    .schemaUrlParams(QuerySchema)
    .text(
      (context) => {
        type Expected = Route.RouteContext<{
          urlParams: {
            page: number
            limit: number
          }
        }>

        Function.satisfies<Expected>()(context)

        Function.satisfies<number>()(context.urlParams.page)

        Function.satisfies<number>()(context.urlParams.limit)

        return Effect.succeed("hello")
      },
    )
})

t.it("context is typed with payload when schemaPayload is provided", () => {
  const PayloadSchema = Schema.Struct({
    name: Schema.String,
    age: Schema.Number,
  })

  Route
    .schemaPayload(PayloadSchema)
    .text(
      (context) => {
        type Expected = Route.RouteContext<{
          payload: {
            name: string
            age: number
          }
        }>

        Function.satisfies<Expected>()(context)

        Function.satisfies<string>()(context.payload.name)

        Function.satisfies<number>()(context.payload.age)

        return Effect.succeed("hello")
      },
    )
})

t.it("context is typed with headers when schemaHeaders is provided", () => {
  const HeadersSchema = Schema.Struct({
    authorization: Schema.String,
  })

  Route
    .schemaHeaders(HeadersSchema)
    .text(
      (context) => {
        type Expected = Route.RouteContext<{
          headers: {
            authorization: string
          }
        }>

        Function.satisfies<Expected>()(context)

        Function.satisfies<string>()(context.headers.authorization)

        return Effect.succeed("hello")
      },
    )
})

t.it("context is typed with multiple schemas", () => {
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
          pathParams: {
            id: string
          }
          urlParams: {
            page: number
          }
          payload: {
            name: string
          }
        }>

        Function.satisfies<Expected>()(context)

        Function.satisfies<string>()(context.pathParams.id)

        Function.satisfies<number>()(context.urlParams.page)

        Function.satisfies<string>()(context.payload.name)

        return Effect.succeed("hello")
      },
    )
})

t.it("schemaSuccess and schemaError are stored in RouteSet", () => {
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

t.it("all schema methods work together", () => {
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

t.it("schemas merge when RouteSet and Route both define same schema", () => {
  const BaseSchema = Schema.Struct({
    id: Schema.String,
  })

  const ExtendedSchema = Schema.Struct({
    name: Schema.String,
  })

  const routes = Route
    .schemaPathParams(BaseSchema)
    .get(
      Route
        .schemaPathParams(ExtendedSchema)
        .text(Effect.succeed("hello")),
    )

  type Expected = Route.RouteSet<
    [
      Route.Route<
        "GET",
        "text/plain",
        any,
        {
          readonly PathParams: Schema.Struct<
            {
              id: typeof Schema.String
              name: typeof Schema.String
            }
          >
        }
      >,
    ],
    {
      readonly PathParams: typeof BaseSchema
    }
  >

  Function.satisfies<Expected>()(routes)
})

t.it("context has only request and url when no schemas provided", () => {
  Route
    .text(
      (context) => {
        type Expected = Route.RouteContext<{}>

        Function.satisfies<Expected>()(context)

        Function.satisfies<typeof context.request>()(context.request)

        Function.satisfies<URL>()(context.url)

        // @ts-expect-error - pathParams should not exist
        context.pathParams

        return Effect.succeed("hello")
      },
    )
})

t.it("schemas work with all media types", () => {
  const PathSchema = Schema.Struct({
    id: Schema.String,
  })

  Route
    .schemaPathParams(PathSchema)
    .html(
      (context) => {
        Function.satisfies<string>()(context.pathParams.id)

        return Effect.succeed("<h1>Hello</h1>")
      },
    )

  Route
    .schemaPathParams(PathSchema)
    .json(
      (context) => {
        Function.satisfies<string>()(context.pathParams.id)

        return Effect.succeed({ message: "hello" })
      },
    )
})

t.it("schemas work with generator functions", () => {
  const IdSchema = Schema.Struct({
    id: Schema.String,
  })

  Route
    .schemaPathParams(IdSchema)
    .text(
      function*(context) {
        Function.satisfies<string>()(context.pathParams.id)

        return "hello"
      },
    )
})

t.it("schema property is correctly set on RouteSet", () => {
  const PathSchema = Schema.Struct({
    id: Schema.String,
  })

  const routes = Route
    .schemaPathParams(PathSchema)
    .text(Effect.succeed("hello"))

  type Expected = {
    readonly PathParams: typeof PathSchema
  }

  Function.satisfies<Expected>()(routes.schema)
})

t.it("schemas don't leak between independent route chains", () => {
  const Schema1 = Schema.Struct({
    id: Schema.String,
  })

  const Schema2 = Schema.Struct({
    userId: Schema.String,
  })

  const route1 = Route
    .schemaPathParams(Schema1)
    .text(Effect.succeed("route1"))

  const route2 = Route
    .schemaPathParams(Schema2)
    .text(Effect.succeed("route2"))

  type Expected1 = Route.RouteSet<
    [
      Route.Route<
        "GET",
        "text/plain",
        any,
        { readonly PathParams: typeof Schema1 }
      >,
    ],
    { readonly PathParams: typeof Schema1 }
  >

  type Expected2 = Route.RouteSet<
    [
      Route.Route<
        "GET",
        "text/plain",
        any,
        { readonly PathParams: typeof Schema2 }
      >,
    ],
    { readonly PathParams: typeof Schema2 }
  >

  Function.satisfies<Expected1>()(route1)
  Function.satisfies<Expected2>()(route2)
})

t.it("schema order doesn't matter", () => {
  const PathSchema = Schema.Struct({
    id: Schema.String,
  })

  const PayloadSchema = Schema.Struct({
    name: Schema.String,
  })

  const routes1 = Route
    .schemaPathParams(PathSchema)
    .schemaPayload(PayloadSchema)
    .text(Effect.succeed("hello"))

  const routes2 = Route
    .schemaPayload(PayloadSchema)
    .schemaPathParams(PathSchema)
    .text(Effect.succeed("hello"))

  type Expected = {
    readonly PathParams: typeof PathSchema
    readonly Payload: typeof PayloadSchema
  }

  Function.satisfies<Expected>()(routes1.schema)
  Function.satisfies<Expected>()(routes2.schema)
})

t.it("multiple routes in RouteSet each get the schema", () => {
  const PathSchema = Schema.Struct({
    id: Schema.String,
  })

  const routes = Route
    .schemaPathParams(PathSchema)
    .text(Effect.succeed("text"))
    .html(Effect.succeed("<p>html</p>"))
    .json(Effect.succeed({ data: "json" }))

  type ExpectedSchemas = {
    readonly PathParams: typeof PathSchema
  }

  type Expected = Route.RouteSet<
    [
      Route.Route<"GET", "text/plain", any, ExpectedSchemas>,
      Route.Route<"GET", "text/html", any, ExpectedSchemas>,
      Route.Route<"GET", "application/json", any, ExpectedSchemas>,
    ],
    ExpectedSchemas
  >

  Function.satisfies<Expected>()(routes)
})

t.it("schemas merge correctly with struct fields syntax", () => {
  const routes = Route
    .schemaPathParams({ id: Schema.String })
    .get(
      Route
        .schemaPathParams({ userId: Schema.String })
        .text(Effect.succeed("hello")),
    )

  routes
    .set[0]
    .text(
      (context) => {
        Function.satisfies<string>()(context.pathParams.id)
        Function.satisfies<string>()(context.pathParams.userId)

        return Effect.succeed("hello")
      },
    )
})

t.it("method modifiers preserve and merge schemas", () => {
  const PathSchema = Schema.Struct({
    id: Schema.String,
  })

  const PayloadSchema = Schema.Struct({
    name: Schema.String,
  })

  const routes = Route
    .schemaPathParams(PathSchema)
    .post(
      Route
        .schemaPayload(PayloadSchema)
        .text(Effect.succeed("created")),
    )

  type Expected = Route.RouteSet<
    [
      Route.Route<
        "POST",
        "text/plain",
        any,
        {
          readonly PathParams: typeof PathSchema
          readonly Payload: typeof PayloadSchema
        }
      >,
    ],
    {
      readonly PathParams: typeof PathSchema
    }
  >

  Function.satisfies<Expected>()(routes)
})

t.it("method modifiers require routes with handlers", () => {
  const PathSchema = Schema.Struct({
    id: Schema.String,
  })

  Route
    .schemaPathParams(PathSchema)
    .get(
      Route
        .schemaPathParams({ userId: Schema.String })
        .text(Effect.succeed("hello")),
    )

  Route
    .schemaPathParams(PathSchema)
    .get(
      // @ts-expect-error - method modifiers should reject empty RouteSet
      Route.schemaPathParams({ userId: Schema.String }),
    )
})

t.it("method modifiers preserve proper types when nesting schemas", () => {
  const PathSchema = Schema.Struct({
    id: Schema.String,
  })

  const route = Route
    .schemaPathParams(PathSchema)
    .get(
      Route
        .schemaPathParams({ userId: Schema.String })
        .text(Effect.succeed("hello")),
    )

  type BaseSchemas = {
    readonly PathParams: typeof PathSchema
  }

  type MergedPathParams = Schema.Struct<{
    id: typeof Schema.String
    userId: typeof Schema.String
  }>

  type Expected = Route.RouteSet<
    [
      Route.Route<"GET", "text/plain", any, {
        readonly PathParams: MergedPathParams
      }>,
    ],
    BaseSchemas
  >

  Function.satisfies<Expected>()(route)
})

t.it("schemaUrlParams accepts optional fields", () => {
  const routes = Route
    .schemaUrlParams({
      hello: Function.pipe(
        Schema.String,
        Schema.optional,
      ),
    })
    .html(
      (ctx) => {
        Function.satisfies<string | undefined>()(ctx.urlParams.hello)

        const page = ctx.urlParams.hello ?? "default"

        return Effect.succeed(`<div><h1>About ${page}</h1></div>`)
      },
    )

  type ExpectedSchemas = {
    readonly UrlParams: Schema.Struct<{
      hello: Schema.optional<typeof Schema.String>
    }>
  }

  type Expected = Route.RouteSet<
    [Route.Route<"GET", "text/html", any, ExpectedSchemas>],
    ExpectedSchemas
  >

  Function.satisfies<Expected>()(routes)
})
