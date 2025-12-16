import {
  HttpApp,
  HttpServerRequest,
} from "@effect/platform"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as t from "bun:test"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Schema from "effect/Schema"
import * as Types from "effect/Types"
import * as Hyper from "./Hyper.ts"
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

t.it(
  "context is typed with pathParams when schemaPathParams is provided",
  () => {
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
  },
)

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

t.it("context has only url when no schemas provided", () => {
  Route
    .text(
      (context) => {
        type Expected = Route.RouteContext<{}>

        Function.satisfies<Expected>()(context)

        Function.satisfies<URL>()(context.url)

        // @ts-expect-error - pathParams should not exist
        context.pathParams

        return Effect.succeed("hello")
      },
    )
})

t.it("context.next() returns correct type for text handler", () => {
  Route.text(function*(context) {
    const next = context.next()
    type NextType = Effect.Effect.Success<typeof next>
    type _check = [NextType] extends [string] ? true : false
    const _assert: _check = true
    return "hello"
  })
})

t.it("context.next() returns correct type for html handler", () => {
  Route.html(function*(context) {
    const next = context.next()
    type NextType = Effect.Effect.Success<typeof next>
    type _check = [NextType] extends [string | Hyper.GenericJsxObject] ? true
      : false
    const _assert: _check = true
    return "<div>hello</div>"
  })
})

t.it("context.next() returns correct type for json handler", () => {
  Route.json(function*(context) {
    const next = context.next()
    type NextType = Effect.Effect.Success<typeof next>
    type _check = [NextType] extends [Route.JsonValue] ? true : false
    const _assert: _check = true
    return { message: "hello" }
  })
})

t.it("schemas work with all media types", () => {
  const PathSchema = Schema.Struct({
    id: Schema.String,
  })

  Route
    .schemaPathParams(PathSchema)
    .html((context) => {
      Function.satisfies<string>()(context.pathParams.id)

      return Effect.succeed("<h1>Hello</h1>")
    })

  Route
    .schemaPathParams(PathSchema)
    .json((context) => {
      Function.satisfies<string>()(context.pathParams.id)

      return Effect.succeed({ message: "hello" })
    })
})

t.it("schemas work with generator functions", () => {
  const IdSchema = Schema.Struct({
    id: Schema.String,
  })

  Route
    .schemaPathParams(IdSchema)
    .text(function*(context) {
      Function.satisfies<string>()(context.pathParams.id)

      return "hello"
    })
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

t.it("schemaPathParams only accepts string-encoded schemas", () => {
  Route
    .schemaPathParams({
      id: Schema.String,
    })
    .text(Effect.succeed("ok"))

  Route
    .schemaPathParams({
      id: Schema.NumberFromString,
    })
    .text(Effect.succeed("ok"))

  Route
    .schemaPathParams({
      // @ts-expect-error - Schema.Number is not string-encoded
      id: Schema.Number,
    })
    .text(Effect.succeed("ok"))

  Route
    .schemaPathParams({
      // @ts-expect-error - Schema.Struct is not string-encoded
      nested: Schema.Struct({
        field: Schema.String,
      }),
    })
    .text(Effect.succeed("ok"))
})

t.it("schemaUrlParams accepts string and string array encoded schemas", () => {
  Route
    .schemaUrlParams({
      page: Schema.String,
    })
    .text(Effect.succeed("ok"))

  Route
    .schemaUrlParams({
      page: Schema.NumberFromString,
    })
    .text(Effect.succeed("ok"))

  Route
    .schemaUrlParams({
      tags: Schema.Array(Schema.String),
    })
    .text(Effect.succeed("ok"))

  Route
    .schemaUrlParams({
      // @ts-expect-error - Schema.Number is not string-encoded
      page: Schema.Number,
    })
    .text(Effect.succeed("ok"))

  Route
    .schemaUrlParams({
      // @ts-expect-error - Schema.Struct is not string-encoded
      nested: Schema.Struct({
        field: Schema.String,
      }),
    })
    .text(Effect.succeed("ok"))
})

t.it("schemaHeaders accepts string and string array encoded schemas", () => {
  Route
    .schemaHeaders({
      authorization: Schema.String,
    })
    .text(Effect.succeed("ok"))

  Route
    .schemaHeaders({
      "x-custom-header": Schema.NumberFromString,
    })
    .text(Effect.succeed("ok"))

  Route
    .schemaHeaders({
      "accept-encoding": Schema.Array(Schema.String),
    })
    .text(Effect.succeed("ok"))

  Route
    .schemaHeaders({
      // @ts-expect-error - Schema.Number is not string-encoded
      "x-count": Schema.Number,
    })
    .text(Effect.succeed("ok"))

  Route
    .schemaHeaders({
      // @ts-expect-error - Schema.Struct is not string-encoded
      "x-metadata": Schema.Struct({
        field: Schema.String,
      }),
    })
    .text(Effect.succeed("ok"))
})

t.it(
  "Route.http creates RouteSet with HttpMiddleware handler for HttpServerResponse",
  () => {
    const response = HttpServerResponse.text("static response")
    const routes = Route.http(response)

    t.expect(Route.isRouteSet(routes)).toBe(true)
    t.expect(routes.set.length).toBe(1)
    t.expect(routes.set[0]!.media).toBe("*")
    t.expect(routes.set[0]!.method).toBe("*")
    t.expect(Route.isHttpMiddlewareHandler(routes.set[0]!.handler)).toBe(true)
  },
)

t.it("Route.http with HttpServerResponse returns the response", async () => {
  const response = HttpServerResponse.text("static response")
  const routes = Route.http(response)

  const handler = routes.set[0]!.handler
  const mockNext = Effect.succeed(HttpServerResponse.text("inner"))
  const context: Route.RouteContext = {
    get url() {
      return new URL("http://localhost")
    },
    slots: {},
    next: () => mockNext,
  }

  const effect = handler(context) as Effect.Effect<
    HttpServerResponse.HttpServerResponse
  >
  const result = await Effect.runPromise(effect)
  t.expect(HttpServerResponse.isServerResponse(result)).toBe(true)
  t.expect(result).toBe(response)
})

t.it("Route.http can be chained with other media functions", () => {
  const middleware = (app: any) => app

  const routes = Route
    .http(middleware)
    .html(Effect.succeed("<div>test</div>"))
    .json({ data: "test" })

  t.expect(Route.isRouteSet(routes)).toBe(true)
  t.expect(routes.set.length).toBe(3)
  t.expect(routes.set[0]!.media).toBe("*")
  t.expect(Route.isHttpMiddlewareHandler(routes.set[0]!.handler)).toBe(true)
  t.expect(routes.set[1]!.media).toBe("text/html")
  t.expect(routes.set[2]!.media).toBe("application/json")
})

t.it("Route.matches returns true for exact method and media match", () => {
  const route1 = Route.get(Route.html(Effect.succeed("<div>test</div>")))
  const route2 = Route.get(Route.html(Effect.succeed("<div>other</div>")))

  t.expect(Route.overlaps(route1.set[0]!, route2.set[0]!)).toBe(true)
})

t.it("Route.matches returns false for different methods", () => {
  const route1 = Route.get(Route.html(Effect.succeed("<div>test</div>")))
  const route2 = Route.post(Route.html(Effect.succeed("<div>other</div>")))

  t.expect(Route.overlaps(route1.set[0]!, route2.set[0]!)).toBe(false)
})

t.it("Route.matches returns false for different media types", () => {
  const route1 = Route.get(Route.html(Effect.succeed("<div>test</div>")))
  const route2 = Route.get(Route.json({ data: "test" }))

  t.expect(Route.overlaps(route1.set[0]!, route2.set[0]!)).toBe(false)
})

t.it("Route.matches returns true when method is wildcard", () => {
  const route1 = Route.html(Effect.succeed("<div>test</div>"))
  const route2 = Route.get(Route.html(Effect.succeed("<div>other</div>")))

  t.expect(Route.overlaps(route1.set[0]!, route2.set[0]!)).toBe(true)
  t.expect(Route.overlaps(route2.set[0]!, route1.set[0]!)).toBe(true)
})

t.it("Route.matches returns true when one route has wildcard method", () => {
  const wildcardRoute = Route.html(Effect.succeed("<div>test</div>"))
  const specificRoute = Route.get(
    Route.html(Effect.succeed("<div>other</div>")),
  )

  t.expect(Route.overlaps(wildcardRoute.set[0]!, specificRoute.set[0]!)).toBe(
    true,
  )
})

t.describe("Route.merge", () => {
  t.it("combines routes into a single RouteSet", () => {
    const textRoute = Route.text("hello")
    const htmlRoute = Route.html(Effect.succeed("<div>world</div>"))

    const merged = Route.merge(textRoute, htmlRoute)

    t.expect(merged.set).toHaveLength(2)
    t.expect(merged.set[0].media).toBe("text/plain")
    t.expect(merged.set[1].media).toBe("text/html")
  })

  t.it("types merged routes preserving individual routes", () => {
    const textRoute = Route.text("hello")
    const htmlRoute = Route.html(Effect.succeed("<div>world</div>"))

    const merged = Route.merge(textRoute, htmlRoute)

    type Expected = Route.RouteSet<
      readonly [
        Route.Route<
          "GET",
          "text/plain",
          Route.RouteHandler<"hello", never, never>
        >,
        Route.Route<
          "GET",
          "text/html",
          Route.RouteHandler<string, never, never>
        >,
      ]
    >

    const _check: Expected = merged
  })

  t.it("types merged schemas using MergeSchemas", () => {
    const routeA = Route
      .schemaPathParams({ id: Schema.NumberFromString })
      .text(Effect.succeed("a"))

    const routeB = Route
      .schemaUrlParams({ page: Schema.NumberFromString })
      .html(Effect.succeed("<div>b</div>"))

    const merged = Route.merge(routeA, routeB)

    type MergedSchemas = typeof merged.schema

    type ExpectedPathParams = {
      readonly id: typeof Schema.NumberFromString
    }
    type ExpectedUrlParams = {
      readonly page: typeof Schema.NumberFromString
    }

    type CheckPathParams = MergedSchemas["PathParams"] extends
      Schema.Struct<ExpectedPathParams> ? true : false
    type CheckUrlParams = MergedSchemas["UrlParams"] extends
      Schema.Struct<ExpectedUrlParams> ? true : false

    const _pathParamsCheck: CheckPathParams = true
    const _urlParamsCheck: CheckUrlParams = true
  })

  t.it(
    "allows multiple content routes with same method+media for layering",
    () => {
      const wrapper = Route.html(function*(_c) {
        return "<wrap>content</wrap>"
      })
      const content = Route.html("<div>content</div>")

      const merged = Route.merge(wrapper, content)
      t.expect(merged.set).toHaveLength(2)
    },
  )

  t.it("allows multiple HttpMiddleware routes", () => {
    // HttpMiddleware is created by passing a function (not an Effect)
    const middleware1 = Route.http(
      HttpMiddleware.make(() => HttpServerResponse.empty()),
    )
    const middleware2 = Route.http(
      HttpMiddleware.make(() => HttpServerResponse.empty()),
    )

    const merged = Route.merge(middleware1, middleware2)
    t.expect(merged.set).toHaveLength(2)
  })
})

t.describe("Route.http type inference", () => {
  class TestService extends Context.Tag("TestService")<
    TestService,
    { getValue: () => string }
  >() {}

  class TestError extends Data.TaggedError("TestError")<{
    message: string
  }> {}

  t.it("infers error type from middleware function", () => {
    const routes = Route.http((app) =>
      Effect.gen(function*() {
        const shouldFail = Math.random() > 0.5
        if (shouldFail) {
          return yield* Effect.fail(new TestError({ message: "failed" }))
        }
        return yield* app
      })
    )

    type RouteError = Route.Route.Error<typeof routes>
    type RouteRequirements = Route.Route.Requirements<typeof routes>

    const _errorCheck: Types.Equals<RouteError, TestError> = true
    t.expect(routes.set.length).toBe(1)
  })

  t.it("infers requirements type from middleware function", () => {
    const routes = Route.http((app) =>
      Effect.gen(function*() {
        const service = yield* TestService
        return yield* app
      })
    )

    type RouteRequirements = Route.Route.Requirements<typeof routes>

    const _requirementsIncludesService: TestService extends RouteRequirements
      ? true
      : false = true
    t.expect(routes.set.length).toBe(1)
  })

  t.it("infers both error and requirements from middleware function", () => {
    const routes = Route.http((app) =>
      Effect.gen(function*() {
        const service = yield* TestService
        const shouldFail = Math.random() > 0.5
        if (shouldFail) {
          return yield* Effect.fail(new TestError({ message: "failed" }))
        }
        console.log(service.getValue())
        return yield* app
      })
    )

    type RouteError = Route.Route.Error<typeof routes>
    type RouteRequirements = Route.Route.Requirements<typeof routes>

    const _errorCheck: Types.Equals<RouteError, TestError> = true
    const _requirementsIncludesService: TestService extends RouteRequirements
      ? true
      : false = true
    t.expect(routes.set.length).toBe(1)
  })

  t.it("types HttpServerResponse as never error and never requirements", () => {
    const routes = Route.http(HttpServerResponse.text("static"))

    type Expected = Route.RouteSet<
      [
        Route.Route<
          "*",
          "*",
          Route.RouteHandler<
            HttpServerResponse.HttpServerResponse,
            never,
            never
          >
        >,
      ]
    >
    Function.satisfies<Expected>()(routes)
  })

  t.it(
    "HttpMiddleware.make erases types - use direct function for inference",
    () => {
      const middleware = HttpMiddleware.make((app) =>
        Effect.gen(function*() {
          yield* TestService
          return yield* app
        })
      )

      const routes = Route.http(middleware)

      const httpHandler = routes.set[0]!.handler

      const _checkHandler: Types.Equals<
        typeof httpHandler,
        Route.RouteHandler<
          HttpServerResponse.HttpServerResponse,
          never,
          TestService
        >
      > = true

      t.expect(routes.set.length).toBe(1)
    },
  )
})

t.describe("Route.text type inference", () => {
  class TestService extends Context.Tag("TestService")<
    TestService,
    { getValue: () => string }
  >() {}

  class TestError extends Data.TaggedError("TestError")<{
    message: string
  }> {}

  t.it("propagates requirements from Effect handler", () => {
    const routes = Route.text(
      TestService.pipe(
        Effect.map((service) => service.getValue()),
      ),
    )

    type Expected = Route.RouteSet<
      [
        Route.Route<
          "GET",
          "text/plain",
          Route.RouteHandler<string, never, TestService>
        >,
      ]
    >
    Function.satisfies<Expected>()(routes)

    t.expect(routes.set.length).toBe(1)
  })

  t.it("propagates error from Effect handler", () => {
    const routes = Route.text(
      Effect.fail(new TestError({ message: "failed" })).pipe(
        Effect.catchTag(
          "TestError",
          () => Effect.succeed("recovered"),
        ),
        Effect.flatMap(() =>
          Effect.fail(new TestError({ message: "another" }))
        ),
      ),
    )

    type Expected = Route.RouteSet<
      [
        Route.Route<
          "GET",
          "text/plain",
          Route.RouteHandler<never, TestError, never>
        >,
      ]
    >
    Function.satisfies<Expected>()(routes)

    t.expect(routes.set.length).toBe(1)
  })

  t.it("propagates requirements from function returning Effect.gen", () => {
    const routes = Route.text(() =>
      Effect.gen(function*() {
        const service = yield* TestService
        return service.getValue()
      })
    )

    type Expected = Route.RouteSet<
      [
        Route.Route<
          "GET",
          "text/plain",
          Route.RouteHandler<string, never, TestService>
        >,
      ]
    >
    Function.satisfies<Expected>()(routes)

    t.expect(routes.set.length).toBe(1)
  })

  t.it("propagates error from function returning Effect.gen", () => {
    const routes = Route.text(() =>
      Effect.gen(function*() {
        const shouldFail = Math.random() > 0.5
        if (shouldFail) {
          return yield* Effect.fail(new TestError({ message: "failed" }))
        }
        return "ok"
      })
    )

    type Expected = Route.RouteSet<
      [
        Route.Route<
          "GET",
          "text/plain",
          Route.RouteHandler<string, TestError, never>
        >,
      ]
    >
    Function.satisfies<Expected>()(routes)

    t.expect(routes.set.length).toBe(1)
  })
})
