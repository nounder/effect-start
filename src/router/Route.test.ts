import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as t from "bun:test"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Schema from "effect/Schema"
import * as Types from "effect/Types"
import * as Hyper from "../hyper/Hyper.ts"
import * as Route from "./Route.ts"
import * as RouteSet from "./RouteSet.ts"
import { isHttpMiddlewareHandler } from "./RouteSet_http.ts"
import * as Values from "../Values.ts"

class Greeting extends Effect.Tag("Greeting")<Greeting, {
  greet(): string
}>() {}

class Random extends Effect.Tag("Random")<Random, {
  boolean(): boolean
  number(): number
  uuid(): string
}>() {}

class EveError {
  readonly _tag = "EveError"
}

class RandomError {
  readonly _tag = "LoserError"
}

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

  type Expected = Route.Set<[
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

  type Expected = Route.Set<[
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

  type Expected = Route.Set<
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

  type Expected = Route.Set<
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

  type Expected = Route.Set<
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

  type Expected = Route.Set<
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

  type Expected = Route.Set<
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

  type Expected = Route.Set<
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

t.describe(`${Route.text}`, () => {
  t.it("accepts string directly", () => {
    const routes = Route.text("static response")

    Function.satisfies<
      Route.Set<
        [
          Route.Route<
            "GET",
            "text/plain",
            Route.RouteHandler<"static response", never, never>
          >,
        ]
      >
    >()(routes)
  })

  t.it("accepts Effect directly", () => {
    const routes = Route.text(Effect.succeed("effect response"))

    Function.satisfies<
      Route.Set<
        [
          Route.Route<
            "GET",
            "text/plain",
            Route.RouteHandler<string, never, never>
          >,
        ]
      >
    >()(routes)
  })

  t.it("infers Error and Requirements", () => {
    const route = Route.text(function*(context) {
      const greeting = yield* Greeting.greet()
      const isLucky = yield* Random.boolean()

      if (!isLucky) {
        return yield* Effect.fail(new RandomError())
      }

      return greeting
    })

    Function.satisfies<
      Route.Set<
        [
          Route.Route<
            "GET",
            "text/plain",
            Route.RouteHandler<string, RandomError, Greeting | Random>
          >,
        ]
      >
    >()(route)
  })

  t.it("chains with other actions", () => {
    const routes = Route
      .text("hello")
      .html(Effect.succeed("<div>world</div>"))
      .json({ data: "test" })

    console.log("wtf is this", routes)

    t.expect(RouteSet.isRouteSet(routes)).toBe(true)
    t.expect(routes.set.length).toBe(3)
    t.expect(routes.set[0]!.media).toBe("text/plain")
    t.expect(routes.set[1]!.media).toBe("text/html")
    t.expect(routes.set[2]!.media).toBe("application/json")
  })

  t.it("context.next() returns correct type", () => {
    Route.text(function*(context) {
      const next = context.next()
      type NextType = Effect.Effect.Success<typeof next>
      type _check = [NextType] extends [string] ? true : false
      const _assert: _check = true
      return "hello"
    })
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
    type _check = [NextType] extends [Values.Json] ? true : false
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

  type Expected1 = Route.Set<
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

  type Expected2 = Route.Set<
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

  type Expected = Route.Set<
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

  type Expected = Route.Set<
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

  type Expected = Route.Set<
    [
      Route.Route<"GET", "text/plain", any, {
        readonly PathParams: MergedPathParams
      }>,
    ],
    BaseSchemas
  >

  Function.satisfies<Expected>()(route)
})

t.describe(`${Route.schemaPathParams}`, () => {
  t.it("only accepts string-encoded schemas", () => {
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
})

t.describe(`${Route.schemaUrlParams}`, () => {
  t.it("accepts optional fields", () => {
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

    type Expected = Route.Set<
      [Route.Route<"GET", "text/html", any, ExpectedSchemas>],
      ExpectedSchemas
    >

    Function.satisfies<Expected>()(routes)
  })

  t.it("only accepts string-encoded schemas", () => {
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
})

t.describe(`${Route.schemaHeaders}`, () => {
  t.it("only accepts string-encoded schemas", () => {
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
})

function executeHandle(handler: Route.RouteHandler) {
  const context: Route.RouteContext = {
    get url() {
      return new URL("http://localhost")
    },
    slots: {},
    next: () => Effect.void,
  }

  return handler(context) as Effect.Effect<unknown, never, never>
}

t.describe(`${Route.http}`, () => {
  t.it("accepts response directly", async () => {
    const routes = Route.http(
      HttpServerResponse.text("static response"),
    )

    Function.satisfies<
      Route.Set<
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
    >()(routes)

    const handler = routes.set[0]!.handler
    const result = await Effect.runPromise(executeHandle(handler))

    t
      .expect(HttpServerResponse.isServerResponse(result))
      .toBe(true)
  })

  t.it("infers Error and Requirements", () => {
    const middlewareRoute = Route
      .http(HttpMiddleware.make(app =>
        Effect.gen(function*() {
          const isLucky = yield* Random.boolean()

          if (isLucky) {
            return yield* app
          } else {
            return yield* Effect.fail(new RandomError())
          }
        })
      ))

    const fullRoute = middlewareRoute
      .text(function*() {
        const greeting = yield* Greeting.greet()

        return greeting
      })

    Function.satisfies<
      Route.Set<
        [
          Route.Route<
            "*",
            "*",
            Route.RouteHandler<
              HttpServerResponse.HttpServerResponse,
              RandomError,
              Random
            >
          >,
          Route.Route<
            "GET",
            "text/plain",
            Route.RouteHandler<
              string,
              never,
              Greeting
            >
          >,
        ]
      >
    >()(fullRoute)

    type Requirements = Route.Route.Requirements<typeof fullRoute>
    type Errors = Route.Route.Error<typeof fullRoute>

    const _checksRequirements: Types.Equals<
      Requirements,
      Greeting | Random
    > = true

    const _checkErrors: Types.Equals<
      Errors,
      RandomError
    > = true
  })

  t.it("chains with other actions", () => {
    const routes = Route
      .http(app => app)
      .html(Effect.succeed("<div>test</div>"))
      .json({ data: "test" })

    t.expect(RouteSet.isRouteSet(routes)).toBe(true)
    t.expect(routes.set.length).toBe(3)
    t.expect(routes.set[0]!.media).toBe("*")

    t.expect(isHttpMiddlewareHandler(routes.set[0]!.handler)).toBe(true)
    t.expect(routes.set[1]!.media).toBe("text/html")
    t.expect(routes.set[2]!.media).toBe("application/json")
  })
})

t.describe(`${Route.overlaps}`, () => {
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
})

t.describe(`${RouteSet.merge}`, () => {
  t.it("combines routes into a single RouteSet", () => {
    const textRoute = Route.text("hello")
    const htmlRoute = Route.html(Effect.succeed("<div>world</div>"))

    const merged = RouteSet.merge(textRoute, htmlRoute)

    t.expect(merged.set).toHaveLength(2)
    t.expect(merged.set[0].media).toBe("text/plain")
    t.expect(merged.set[1].media).toBe("text/html")
  })

  t.it("types merged routes preserving individual routes", () => {
    const textRoute = Route.text("hello")
    const htmlRoute = Route.html(Effect.succeed("<div>world</div>"))

    const merged = RouteSet.merge(textRoute, htmlRoute)

    type Expected = Route.Set<
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

    const merged = RouteSet.merge(routeA, routeB)

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

      const merged = RouteSet.merge(wrapper, content)
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

    const merged = RouteSet.merge(middleware1, middleware2)
    t.expect(merged.set).toHaveLength(2)
  })
})
