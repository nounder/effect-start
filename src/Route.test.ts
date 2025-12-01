import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
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

t.it("Route.http creates RouteMiddleware", () => {
  const middleware = (app: any) => app

  const spec = Route.http(middleware)

  t.expect(spec._tag).toBe("RouteMiddleware")
  t.expect(spec.middleware).toBe(middleware)
})

t.it("Route.layer creates RouteLayer with middleware", () => {
  const middleware = (app: any) => app

  const layer = Route.layer(
    Route.http(middleware),
    Route.html(Effect.succeed("<div>test</div>")),
  )

  t.expect(Route.isRouteLayer(layer)).toBe(true)
  t.expect(layer.httpMiddleware).toBe(middleware)
  t.expect(layer.set.length).toBe(1)
})

t.it("Route.layer merges multiple route sets", () => {
  const routes1 = Route.html(Effect.succeed("<div>1</div>"))
  const routes2 = Route.text("text")

  const layer = Route.layer(routes1, routes2)

  t.expect(layer.set.length).toBe(2)
  t.expect(Route.isRouteLayer(layer)).toBe(true)
})

t.it("Route.layer merges routes from all route sets", () => {
  const routes1 = Route
    .schemaPathParams({ id: Schema.String })
    .html(Effect.succeed("<div>test</div>"))

  const routes2 = Route
    .schemaUrlParams({ page: Schema.NumberFromString })
    .text(Effect.succeed("text"))

  const layer = Route.layer(routes1, routes2)

  t.expect(layer.set.length).toBe(2)
  t.expect(layer.set[0]!.media).toBe("text/html")
  t.expect(layer.set[1]!.media).toBe("text/plain")
})

t.it("Route.layer works with no middleware", () => {
  const layer = Route.layer(
    Route.html(Effect.succeed("<div>test</div>")),
  )

  t.expect(Route.isRouteLayer(layer)).toBe(true)
  t.expect(layer.httpMiddleware).toBeUndefined()
  t.expect(layer.set.length).toBe(1)
})

t.it("Route.layer works with no routes", () => {
  const middleware = (app: any) => app

  const layer = Route.layer(
    Route.http(middleware),
  )

  t.expect(Route.isRouteLayer(layer)).toBe(true)
  t.expect(layer.httpMiddleware).toBe(middleware)
  t.expect(layer.set.length).toBe(0)
})

t.it("isRouteLayer type guard works correctly", () => {
  const middleware = (app: any) => app
  const layer = Route.layer(Route.http(middleware))
  const regularRoutes = Route.html(Effect.succeed("<div>test</div>"))

  t.expect(Route.isRouteLayer(layer)).toBe(true)
  t.expect(Route.isRouteLayer(regularRoutes)).toBe(false)
  t.expect(Route.isRouteLayer(null)).toBe(false)
  t.expect(Route.isRouteLayer(undefined)).toBe(false)
  t.expect(Route.isRouteLayer({})).toBe(false)
})

t.it("Route.layer composes multiple middleware in order", async () => {
  const executionOrder: string[] = []

  const middleware1 = HttpMiddleware.make((app) =>
    Effect.gen(function*() {
      executionOrder.push("middleware1-before")
      const result = yield* app
      executionOrder.push("middleware1-after")
      return result
    })
  ) as Route.HttpMiddlewareFunction

  const middleware2 = HttpMiddleware.make((app) =>
    Effect.gen(function*() {
      executionOrder.push("middleware2-before")
      const result = yield* app
      executionOrder.push("middleware2-after")
      return result
    })
  ) as Route.HttpMiddlewareFunction

  const middleware3 = HttpMiddleware.make((app) =>
    Effect.gen(function*() {
      executionOrder.push("middleware3-before")
      const result = yield* app
      executionOrder.push("middleware3-after")
      return result
    })
  ) as Route.HttpMiddlewareFunction

  const layer = Route.layer(
    Route.http(middleware1),
    Route.http(middleware2),
    Route.http(middleware3),
  )

  t.expect(layer.httpMiddleware).toBeDefined()

  const mockApp = Effect.sync(() => {
    executionOrder.push("app")
    return HttpServerResponse.text("result")
  })

  const composed = layer.httpMiddleware!(mockApp) as Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    never,
    never
  >
  await Effect.runPromise(composed.pipe(Effect.orDie))

  t.expect(executionOrder).toEqual([
    "middleware1-before",
    "middleware2-before",
    "middleware3-before",
    "app",
    "middleware3-after",
    "middleware2-after",
    "middleware1-after",
  ])
})

t.it("Route.layer with single middleware works correctly", async () => {
  let middlewareCalled = false

  const middleware = HttpMiddleware.make((app) =>
    Effect.gen(function*() {
      middlewareCalled = true
      return yield* app
    })
  ) as Route.HttpMiddlewareFunction

  const layer = Route.layer(Route.http(middleware))

  t.expect(layer.httpMiddleware).toBeDefined()

  const mockApp = Effect.succeed(HttpServerResponse.text("result"))
  const composed = layer.httpMiddleware!(mockApp) as Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    never,
    never
  >
  await Effect.runPromise(composed.pipe(Effect.orDie))

  t.expect(middlewareCalled).toBe(true)
})

t.it("Route.layer middleware can modify responses", async () => {
  const addHeader1 = HttpMiddleware.make((app) =>
    Effect.gen(function*() {
      const result = yield* app
      return HttpServerResponse.setHeader(result, "X-Custom-1", "value1")
    })
  ) as Route.HttpMiddlewareFunction

  const addHeader2 = HttpMiddleware.make((app) =>
    Effect.gen(function*() {
      const result = yield* app
      return HttpServerResponse.setHeader(result, "X-Custom-2", "value2")
    })
  ) as Route.HttpMiddlewareFunction

  const layer = Route.layer(
    Route.http(addHeader1),
    Route.http(addHeader2),
  )

  const mockApp = Effect.succeed(HttpServerResponse.text("data"))
  const composed = layer.httpMiddleware!(mockApp) as Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    never,
    never
  >
  const result = await Effect.runPromise(composed.pipe(Effect.orDie))

  t.expect(result.headers["x-custom-1"]).toBe("value1")
  t.expect(result.headers["x-custom-2"]).toBe("value2")
})

t.it("Route.matches returns true for exact method and media match", () => {
  const route1 = Route.get(Route.html(Effect.succeed("<div>test</div>")))
  const route2 = Route.get(Route.html(Effect.succeed("<div>other</div>")))

  t.expect(Route.matches(route1.set[0]!, route2.set[0]!)).toBe(true)
})

t.it("Route.matches returns false for different methods", () => {
  const route1 = Route.get(Route.html(Effect.succeed("<div>test</div>")))
  const route2 = Route.post(Route.html(Effect.succeed("<div>other</div>")))

  t.expect(Route.matches(route1.set[0]!, route2.set[0]!)).toBe(false)
})

t.it("Route.matches returns false for different media types", () => {
  const route1 = Route.get(Route.html(Effect.succeed("<div>test</div>")))
  const route2 = Route.get(Route.json({ data: "test" }))

  t.expect(Route.matches(route1.set[0]!, route2.set[0]!)).toBe(false)
})

t.it("Route.matches returns true when method is wildcard", () => {
  const route1 = Route.html(Effect.succeed("<div>test</div>"))
  const route2 = Route.get(Route.html(Effect.succeed("<div>other</div>")))

  t.expect(Route.matches(route1.set[0]!, route2.set[0]!)).toBe(true)
  t.expect(Route.matches(route2.set[0]!, route1.set[0]!)).toBe(true)
})

t.it("Route.matches returns true when one route has wildcard method", () => {
  const wildcardRoute = Route.html(Effect.succeed("<div>test</div>"))
  const specificRoute = Route.get(
    Route.html(Effect.succeed("<div>other</div>")),
  )

  t.expect(Route.matches(wildcardRoute.set[0]!, specificRoute.set[0]!)).toBe(
    true,
  )
})

t.describe("Route.merge", () => {
  t.it("types merged routes with union of methods", () => {
    const textRoute = Route.text("hello")

    const htmlRoute = Route.html(Effect.succeed("<div>world</div>"))

    const merged = Route.merge(textRoute, htmlRoute)

    type Expected = Route.RouteSet<
      [
        Route.Route<
          "GET",
          "text/plain" | "text/html",
          Route.RouteHandler<HttpServerResponse.HttpServerResponse>
        >,
      ]
    >

    Function.satisfies<Expected>()(merged)
  })

  t.it("types merged routes with different methods", () => {
    const getRoute = Route.get(Route.text("get"))
    const postRoute = Route.post(Route.json({ ok: true }))

    const merged = Route.merge(getRoute, postRoute)

    type Expected = Route.RouteSet<
      [
        Route.Route<
          "GET" | "POST",
          "text/plain" | "application/json",
          Route.RouteHandler<HttpServerResponse.HttpServerResponse>
        >,
      ]
    >

    Function.satisfies<Expected>()(merged)
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

  t.it("merged route does content negotiation for text/plain", async () => {
    const textRoute = Route.text("plain text")
    const htmlRoute = Route.html("<div>html</div>")

    const merged = Route.merge(textRoute, htmlRoute)
    const route = merged.set[0]!

    const request = HttpServerRequest.fromWeb(
      new Request("http://localhost/test", {
        headers: { Accept: "text/plain" },
      }),
    )

    const context: Route.RouteContext = {
      request,
      get url() {
        return new URL(request.url)
      },
      slots: {},
      next: () => Effect.void,
    }

    const result = await Effect.runPromise(route.handler(context))

    const webResponse = HttpServerResponse.toWeb(result)
    const text = await webResponse.text()

    t.expect(text).toBe("plain text")
    t.expect(result.headers["content-type"]).toBe("text/plain")
  })

  t.it("merged route does content negotiation for text/html", async () => {
    const textRoute = Route.text("plain text")
    const htmlRoute = Route.html("<div>html</div>")

    const merged = Route.merge(textRoute, htmlRoute)
    const route = merged.set[0]!

    const request = HttpServerRequest.fromWeb(
      new Request("http://localhost/test", {
        headers: { Accept: "text/html" },
      }),
    )

    const context: Route.RouteContext = {
      request,
      get url() {
        return new URL(request.url)
      },
      slots: {},
      next: () => Effect.void,
    }

    const result = await Effect.runPromise(route.handler(context))

    const webResponse = HttpServerResponse.toWeb(result)
    const text = await webResponse.text()

    t.expect(text).toBe("<div>html</div>")
    t.expect(result.headers["content-type"]).toContain("text/html")
  })

  t.it(
    "merged route does content negotiation for application/json",
    async () => {
      const textRoute = Route.text("plain text")
      const jsonRoute = Route.json({ message: "json" })

      const merged = Route.merge(textRoute, jsonRoute)
      const route = merged.set[0]!

      const request = HttpServerRequest.fromWeb(
        new Request("http://localhost/test", {
          headers: { Accept: "application/json" },
        }),
      )

      const context: Route.RouteContext = {
        request,
        get url() {
          return new URL(request.url)
        },
        slots: {},
        next: () => Effect.void,
      }

      const result = await Effect.runPromise(route.handler(context))

      const webResponse = HttpServerResponse.toWeb(result)
      const text = await webResponse.text()

      t.expect(text).toBe("{\"message\":\"json\"}")
      t.expect(result.headers["content-type"]).toContain("application/json")
    },
  )

  t.it("merged route defaults to html for */* accept", async () => {
    const textRoute = Route.text("plain text")
    const htmlRoute = Route.html("<div>html</div>")

    const merged = Route.merge(textRoute, htmlRoute)
    const route = merged.set[0]!

    const request = HttpServerRequest.fromWeb(
      new Request("http://localhost/test", {
        headers: { Accept: "*/*" },
      }),
    )

    const context: Route.RouteContext = {
      request,
      get url() {
        return new URL(request.url)
      },
      slots: {},
      next: () => Effect.void,
    }

    const result = await Effect.runPromise(route.handler(context))

    const webResponse = HttpServerResponse.toWeb(result)
    const text = await webResponse.text()

    t.expect(text).toBe("<div>html</div>")
  })

  t.it(
    "merged route defaults to first route when no Accept header",
    async () => {
      const textRoute = Route.text("plain text")
      const htmlRoute = Route.html("<div>html</div>")

      const merged = Route.merge(textRoute, htmlRoute)
      const route = merged.set[0]!

      const request = HttpServerRequest.fromWeb(
        new Request("http://localhost/test"),
      )

      const context: Route.RouteContext = {
        request,
        get url() {
          return new URL(request.url)
        },
        slots: {},
        next: () => Effect.void,
      }

      const result = await Effect.runPromise(route.handler(context))

      const webResponse = HttpServerResponse.toWeb(result)
      const text = await webResponse.text()

      t.expect(text).toBe("<div>html</div>")
    },
  )
})
