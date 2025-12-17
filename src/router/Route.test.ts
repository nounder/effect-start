import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as type from "expect-type"
import * as Hyper from "../hyper/Hyper.ts"
import * as Values from "../Values.ts"
import * as Route from "./Route.ts"
import * as RouteSet from "./RouteSet.ts"

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

  type
    .expectTypeOf(implicit)
    .toMatchTypeOf<RouteSet.RouteSet<[
      Route.Route<"GET", "text">,
      Route.Route<"GET", "html">,
    ]>>()
  type
    .expectTypeOf(explicit)
    .toMatchTypeOf<RouteSet.RouteSet<[
      Route.Route<"GET", "text">,
      Route.Route<"GET", "html">,
    ]>>()
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

  type
    .expectTypeOf(implicit)
    .toMatchTypeOf<RouteSet.RouteSet<[
      Route.Route<"GET", "text">,
      Route.Route<"GET", "html">,
      Route.Route<"POST", "json">,
    ]>>()
  type
    .expectTypeOf(explicit)
    .toMatchTypeOf<RouteSet.RouteSet<[
      Route.Route<"GET", "text">,
      Route.Route<"GET", "html">,
      Route.Route<"POST", "json">,
    ]>>()
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

  type
    .expectTypeOf(routes)
    .toMatchTypeOf<RouteSet.RouteSet<
      [Route.Route<"GET", "text", any, { readonly PathParams: typeof IdSchema }>],
      { readonly PathParams: typeof IdSchema }
    >>()
})

test.it("schemaPathParams accepts struct fields directly", () => {
  const routes = Route
    .schemaPathParams({
      id: Schema.String,
    })
    .text(
      Effect.succeed("hello"),
    )

  type
    .expectTypeOf(routes)
    .toMatchTypeOf<RouteSet.RouteSet<
      [Route.Route<"GET", "text", any, {
        readonly PathParams: Schema.Struct<{ id: typeof Schema.String }>
      }>],
      { readonly PathParams: Schema.Struct<{ id: typeof Schema.String }> }
    >>()
})

test.it("schemaPathParams with struct fields types context correctly", () => {
  Route
    .schemaPathParams({
      id: Schema.String,
    })
    .text(
      (context) => {
        type
          .expectTypeOf(context.pathParams.id)
          .toEqualTypeOf<string>()
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

  type
    .expectTypeOf(routes)
    .toMatchTypeOf<RouteSet.RouteSet<
      [
        Route.Route<"GET", "text", any, { readonly Payload: typeof PayloadSchema }>,
        Route.Route<"POST", "text", any, { readonly Payload: typeof PayloadSchema }>,
      ],
      { readonly Payload: typeof PayloadSchema }
    >>()
})

test.it(
  "context is typed with pathParams when schemaPathParams is provided",
  () => {
    const IdSchema = Schema.Struct({
      id: Schema.String,
    })

    Route
      .schemaPathParams(IdSchema)
      .text(
        (context) => {
          type
            .expectTypeOf(context)
            .toMatchTypeOf<Route.RouteContext<{ pathParams: { id: string } }>>()
          type
            .expectTypeOf(context.pathParams.id)
            .toEqualTypeOf<string>()
          return Effect.succeed("hello")
        },
      )
  },
)

test.it("context is typed with urlParams when schemaUrlParams is provided", () => {
  const QuerySchema = Schema.Struct({
    page: Schema.NumberFromString,
    limit: Schema.NumberFromString,
  })

  Route
    .schemaUrlParams(QuerySchema)
    .text(
      (context) => {
        type
          .expectTypeOf(context)
          .toMatchTypeOf<Route.RouteContext<{ urlParams: { page: number; limit: number } }>>()
        type
          .expectTypeOf(context.urlParams.page)
          .toEqualTypeOf<number>()
        type
          .expectTypeOf(context.urlParams.limit)
          .toEqualTypeOf<number>()
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
        type
          .expectTypeOf(context)
          .toMatchTypeOf<Route.RouteContext<{ payload: { name: string; age: number } }>>()
        type
          .expectTypeOf(context.payload.name)
          .toEqualTypeOf<string>()
        type
          .expectTypeOf(context.payload.age)
          .toEqualTypeOf<number>()
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
        type
          .expectTypeOf(context)
          .toMatchTypeOf<Route.RouteContext<{ headers: { authorization: string } }>>()
        type
          .expectTypeOf(context.headers.authorization)
          .toEqualTypeOf<string>()
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
        type
          .expectTypeOf(context)
          .toMatchTypeOf<Route.RouteContext<{
            pathParams: { id: string }
            urlParams: { page: number }
            payload: { name: string }
          }>>()
        type
          .expectTypeOf(context.pathParams.id)
          .toEqualTypeOf<string>()
        type
          .expectTypeOf(context.urlParams.page)
          .toEqualTypeOf<number>()
        type
          .expectTypeOf(context.payload.name)
          .toEqualTypeOf<string>()
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

  type
    .expectTypeOf(routes)
    .toMatchTypeOf<RouteSet.RouteSet<
      [Route.Route<"GET", "text", any, {
        readonly Success: typeof SuccessSchema
        readonly Error: typeof ErrorSchema
      }>],
      {
        readonly Success: typeof SuccessSchema
        readonly Error: typeof ErrorSchema
      }
    >>()
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

  type
    .expectTypeOf(routes)
    .toMatchTypeOf<RouteSet.RouteSet<
      [Route.Route<"GET", "text", any, {
        readonly PathParams: typeof PathSchema
        readonly UrlParams: typeof QuerySchema
        readonly Payload: typeof PayloadSchema
        readonly Success: typeof SuccessSchema
        readonly Error: typeof ErrorSchema
        readonly Headers: typeof HeadersSchema
      }>],
      {
        readonly PathParams: typeof PathSchema
        readonly UrlParams: typeof QuerySchema
        readonly Payload: typeof PayloadSchema
        readonly Success: typeof SuccessSchema
        readonly Error: typeof ErrorSchema
        readonly Headers: typeof HeadersSchema
      }
    >>()
})

test.it("schemas merge when RouteSet and Route both define same schema", () => {
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

  type
    .expectTypeOf(routes)
    .toMatchTypeOf<RouteSet.RouteSet<
      [
        Route.Route<
          "GET",
          "text",
          any,
          {
            readonly PathParams: Schema.Struct<{
              id: typeof Schema.String
              name: typeof Schema.String
            }>
          }
        >,
      ],
      { readonly PathParams: typeof BaseSchema }
    >>()
})

test.it("context has only url when no schemas provided", () => {
  Route
    .text(
      (context) => {
        type
          .expectTypeOf(context)
          .toMatchTypeOf<Route.RouteContext<{}>>()
        type
          .expectTypeOf(context.url)
          .toEqualTypeOf<URL>()
        // @ts-expect-error - pathParams should not exist
        context.pathParams
        return Effect.succeed("hello")
      },
    )
})

test.describe(`${Route.text}`, () => {
  test.it("accepts string directly", () => {
    const routes = Route.text("static response")

    type
      .expectTypeOf(routes)
      .toMatchTypeOf<RouteSet.RouteSet<[
        Route.Route<"GET", "text", Route.RouteHandler<"static response", never, never>>,
      ]>>()
  })

  test.it("accepts Effect directly", () => {
    const routes = Route.text(Effect.succeed("effect response"))

    type
      .expectTypeOf(routes)
      .toMatchTypeOf<RouteSet.RouteSet<[
        Route.Route<"GET", "text", Route.RouteHandler<string, never, never>>,
      ]>>()
  })

  test.it("infers Error and Requirements", () => {
    const route = Route.text(function*(context) {
      const greeting = yield* Greeting.greet()
      const isLucky = yield* Random.boolean()

      if (!isLucky) {
        return yield* Effect.fail(new RandomError())
      }

      return greeting
    })

    type
      .expectTypeOf(route)
      .toMatchTypeOf<RouteSet.RouteSet<[
        Route.Route<"GET", "text", Route.RouteHandler<string, RandomError, Greeting | Random>>,
      ]>>()
  })

  test.it("chains with other actions", () => {
    const routes = Route
      .text("hello")
      .html(Effect.succeed("<div>world</div>"))
      .json({ data: "test" })

    test
      .expect(RouteSet.isRouteSet(routes))
      .toBe(true)
    test
      .expect(RouteSet.items(routes).length)
      .toBe(3)
    test
      .expect(RouteSet.items(routes)[0]!.kind)
      .toBe("text")
    test
      .expect(RouteSet.items(routes)[1]!.kind)
      .toBe("html")
    test
      .expect(RouteSet.items(routes)[2]!.kind)
      .toBe("json")
  })

  test.it("next() returns correct type", () => {
    Route.text(function*(_context, next) {
      type NextFn = NonNullable<typeof next>
      type NextResult = ReturnType<NextFn>
      type NextType = Effect.Effect.Success<NextResult>
      type
        .expectTypeOf<NextType>()
        .toExtend<string>()
      return "hello"
    })
  })
})

test.it("next() returns correct type for html handler", () => {
  Route.html(function*(_context, next) {
    type NextFn = NonNullable<typeof next>
    type NextResult = ReturnType<NextFn>
    type NextType = Effect.Effect.Success<NextResult>
    type
      .expectTypeOf<NextType>()
      .toExtend<string | Hyper.GenericJsxObject>()
    return "<div>hello</div>"
  })
})

test.it("next() returns correct type for json handler", () => {
  Route.json(function*(_context, next) {
    type NextFn = NonNullable<typeof next>
    type NextResult = ReturnType<NextFn>
    type NextType = Effect.Effect.Success<NextResult>
    type
      .expectTypeOf<NextType>()
      .toExtend<Values.Json>()
    return { message: "hello" }
  })
})

test.it("schemas work with all media types", () => {
  const PathSchema = Schema.Struct({
    id: Schema.String,
  })

  Route
    .schemaPathParams(PathSchema)
    .html((context) => {
      type
        .expectTypeOf(context.pathParams.id)
        .toEqualTypeOf<string>()
      return Effect.succeed("<h1>Hello</h1>")
    })

  Route
    .schemaPathParams(PathSchema)
    .json((context) => {
      type
        .expectTypeOf(context.pathParams.id)
        .toEqualTypeOf<string>()
      return Effect.succeed({ message: "hello" })
    })
})

test.it("schemas work with generator functions", () => {
  const IdSchema = Schema.Struct({
    id: Schema.String,
  })

  Route
    .schemaPathParams(IdSchema)
    .text(function*(context) {
      type
        .expectTypeOf(context.pathParams.id)
        .toEqualTypeOf<string>()
      return "hello"
    })
})

test.it("schema property is correctly set on RouteSet", () => {
  const PathSchema = Schema.Struct({
    id: Schema.String,
  })

  const routes = Route
    .schemaPathParams(PathSchema)
    .text(Effect.succeed("hello"))

  type
    .expectTypeOf(RouteSet.schemas(routes))
    .toMatchTypeOf<{ readonly PathParams: typeof PathSchema }>()
})

test.it("schemas don't leak between independent route chains", () => {
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

  type
    .expectTypeOf(route1)
    .toMatchTypeOf<RouteSet.RouteSet<
      [Route.Route<"GET", "text", any, { readonly PathParams: typeof Schema1 }>],
      { readonly PathParams: typeof Schema1 }
    >>()
  type
    .expectTypeOf(route2)
    .toMatchTypeOf<RouteSet.RouteSet<
      [Route.Route<"GET", "text", any, { readonly PathParams: typeof Schema2 }>],
      { readonly PathParams: typeof Schema2 }
    >>()
})

test.it("schema order doesn't matter", () => {
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

  type
    .expectTypeOf(RouteSet.schemas(routes1))
    .toMatchTypeOf<{
      readonly PathParams: typeof PathSchema
      readonly Payload: typeof PayloadSchema
    }>()
  type
    .expectTypeOf(RouteSet.schemas(routes2))
    .toMatchTypeOf<{
      readonly PathParams: typeof PathSchema
      readonly Payload: typeof PayloadSchema
    }>()
})

test.it("multiple routes in RouteSet each get the schema", () => {
  const PathSchema = Schema.Struct({
    id: Schema.String,
  })

  const routes = Route
    .schemaPathParams(PathSchema)
    .text(Effect.succeed("text"))
    .html(Effect.succeed("<p>html</p>"))
    .json(Effect.succeed({ data: "json" }))

  type
    .expectTypeOf(routes)
    .toMatchTypeOf<RouteSet.RouteSet<
      [
        Route.Route<"GET", "text", any, { readonly PathParams: typeof PathSchema }>,
        Route.Route<"GET", "html", any, { readonly PathParams: typeof PathSchema }>,
        Route.Route<"GET", "json", any, { readonly PathParams: typeof PathSchema }>,
      ],
      { readonly PathParams: typeof PathSchema }
    >>()
})

test.it("schemas merge correctly with struct fields syntax", () => {
  const routes = Route
    .schemaPathParams({ id: Schema.String })
    .get(
      Route
        .schemaPathParams({ userId: Schema.String })
        .text(Effect.succeed("hello")),
    )

  const route = RouteSet.items(routes)[0]!
  test
    .expect(route.schemas.PathParams!.fields.id)
    .toBe(Schema.String)
  test
    .expect(route.schemas.PathParams!.fields.userId)
    .toBe(Schema.String)
})

test.it("method modifiers preserve and merge schemas", () => {
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

  type
    .expectTypeOf(routes)
    .toMatchTypeOf<RouteSet.RouteSet<
      [
        Route.Route<
          "POST",
          "text",
          any,
          {
            readonly PathParams: typeof PathSchema
            readonly Payload: typeof PayloadSchema
          }
        >,
      ],
      { readonly PathParams: typeof PathSchema }
    >>()
})

test.it("method modifiers require routes with handlers", () => {
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

test.it("method modifiers preserve proper types when nesting schemas", () => {
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

  type
    .expectTypeOf(route)
    .toMatchTypeOf<RouteSet.RouteSet<
      [
        Route.Route<"GET", "text", any, {
          readonly PathParams: Schema.Struct<{
            id: typeof Schema.String
            userId: typeof Schema.String
          }>
        }>,
      ],
      { readonly PathParams: typeof PathSchema }
    >>()
})

test.describe(`${Route.schemaPathParams}`, () => {
  test.it("only accepts string-encoded schemas", () => {
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

test.describe(`${Route.schemaUrlParams}`, () => {
  test.it("accepts optional fields", () => {
    const routes = Route
      .schemaUrlParams({
        hello: Schema.optional(Schema.String),
      })
      .html(
        (ctx) => {
          type
            .expectTypeOf(ctx.urlParams.hello)
            .toEqualTypeOf<string | undefined>()
          const page = ctx.urlParams.hello ?? "default"
          return Effect.succeed(`<div><h1>About ${page}</h1></div>`)
        },
      )

    type
      .expectTypeOf(routes)
      .toMatchTypeOf<RouteSet.RouteSet<
        [Route.Route<"GET", "html", any, {
          readonly UrlParams: Schema.Struct<{
            hello: Schema.optional<typeof Schema.String>
          }>
        }>],
        {
          readonly UrlParams: Schema.Struct<{
            hello: Schema.optional<typeof Schema.String>
          }>
        }
      >>()
  })

  test.it("only accepts string-encoded schemas", () => {
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

test.describe(`${Route.schemaHeaders}`, () => {
  test.it("only accepts string-encoded schemas", () => {
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

const noopNext: Route.RouteNext = () => Effect.void

function executeHandle(handler: Route.RouteHandler) {
  const context: Route.RouteContext = {
    get url() {
      return new URL("http://localhost")
    },
    slots: {},
  }

  return handler(context, noopNext) as Effect.Effect<unknown, never, never>
}

test.describe(`${Route.http}`, () => {
  test.it("accepts response directly", async () => {
    const routes = Route.http(
      HttpServerResponse.text("static response"),
    )

    type
      .expectTypeOf(routes)
      .toMatchTypeOf<RouteSet.RouteSet<[
        Route.Route<"*", "http", Route.RouteHandler<
          HttpServerResponse.HttpServerResponse,
          never,
          never
        >>,
      ]>>()

    const handler = RouteSet.items(routes)[0]!.handler
    const result = await Effect.runPromise(executeHandle(handler))

    test
      .expect(HttpServerResponse.isServerResponse(result))
      .toBe(true)
  })

  test.it("infers Error and Requirements", () => {
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

    type
      .expectTypeOf(fullRoute)
      .toMatchTypeOf<RouteSet.RouteSet<[
        Route.Route<"*", "http", Route.RouteHandler<
          HttpServerResponse.HttpServerResponse,
          RandomError,
          Random
        >>,
        Route.Route<"GET", "text", Route.RouteHandler<string, never, Greeting>>,
      ]>>()

    type Requirements = Route.Route.Requirements<typeof fullRoute>
    type Errors = Route.Route.Error<typeof fullRoute>

    type
      .expectTypeOf<Requirements>()
      .toEqualTypeOf<Greeting | Random>()
    type
      .expectTypeOf<Errors>()
      .toEqualTypeOf<RandomError>()
  })

  test.it("chains with other actions", () => {
    const routes = Route
      .http(app => app)
      .html(Effect.succeed("<div>test</div>"))
      .json({ data: "test" })

    test
      .expect(RouteSet.isRouteSet(routes))
      .toBe(true)
    test
      .expect(RouteSet.items(routes).length)
      .toBe(3)
    test
      .expect(RouteSet.items(routes)[0]!.kind)
      .toBe("http")
    test
      .expect(RouteSet.items(routes)[1]!.kind)
      .toBe("html")
    test
      .expect(RouteSet.items(routes)[2]!.kind)
      .toBe("json")
  })
})

test.describe(`${Route.overlaps}`, () => {
  test.it("Route.matches returns true for exact method and kind match", () => {
    const route1 = Route.get(Route.html(Effect.succeed("<div>test</div>")))
    const route2 = Route.get(Route.html(Effect.succeed("<div>other</div>")))

    test
      .expect(Route.overlaps(
        RouteSet.items(route1)[0]!,
        RouteSet.items(route2)[0]!,
      ))
      .toBe(true)
  })

  test.it("Route.matches returns false for different methods", () => {
    const route1 = Route.get(Route.html(Effect.succeed("<div>test</div>")))
    const route2 = Route.post(Route.html(Effect.succeed("<div>other</div>")))

    test
      .expect(Route.overlaps(
        RouteSet.items(route1)[0]!,
        RouteSet.items(route2)[0]!,
      ))
      .toBe(false)
  })

  test.it("Route.matches returns false for different kinds", () => {
    const route1 = Route.get(Route.html(Effect.succeed("<div>test</div>")))
    const route2 = Route.get(Route.json({ data: "test" }))

    test
      .expect(Route.overlaps(
        RouteSet.items(route1)[0]!,
        RouteSet.items(route2)[0]!,
      ))
      .toBe(false)
  })

  test.it("Route.matches returns true when method is wildcard", () => {
    const route1 = Route.html(Effect.succeed("<div>test</div>"))
    const route2 = Route.get(Route.html(Effect.succeed("<div>other</div>")))

    test
      .expect(Route.overlaps(
        RouteSet.items(route1)[0]!,
        RouteSet.items(route2)[0]!,
      ))
      .toBe(true)
    test
      .expect(Route.overlaps(
        RouteSet.items(route2)[0]!,
        RouteSet.items(route1)[0]!,
      ))
      .toBe(true)
  })

  test.it("Route.matches returns true when one route has wildcard method", () => {
    const wildcardRoute = Route.html(Effect.succeed("<div>test</div>"))
    const specificRoute = Route.get(
      Route.html(Effect.succeed("<div>other</div>")),
    )

    test
      .expect(Route.overlaps(
        RouteSet.items(wildcardRoute)[0]!,
        RouteSet.items(specificRoute)[0]!,
      ))
      .toBe(true)
  })
})

test.describe(`${Route.merge}`, () => {
  test.it("combines routes into a single RouteSet", () => {
    const textRoute = Route.text("hello")
    const htmlRoute = Route.html(Effect.succeed("<div>world</div>"))

    const merged = Route.merge(textRoute, htmlRoute)

    test
      .expect(RouteSet.items(merged))
      .toHaveLength(2)
    test
      .expect(RouteSet.items(merged)[0].kind)
      .toBe("text")
    test
      .expect(RouteSet.items(merged)[1].kind)
      .toBe("html")
  })

  test.it("types merged routes preserving individual routes", () => {
    const textRoute = Route.text("hello")
    const htmlRoute = Route.html(Effect.succeed("<div>world</div>"))

    const merged = Route.merge(textRoute, htmlRoute)

    type
      .expectTypeOf(merged)
      .toMatchTypeOf<RouteSet.RouteSet<readonly [
        Route.Route<"GET", "text", Route.RouteHandler<"hello", never, never>>,
        Route.Route<"GET", "html", Route.RouteHandler<string, never, never>>,
      ]>>()
  })

  test.it("types merged schemas using MergeSchemas", () => {
    const routeA = Route
      .schemaPathParams({ id: Schema.NumberFromString })
      .text(Effect.succeed("a"))

    const routeB = Route
      .schemaUrlParams({ page: Schema.NumberFromString })
      .html(Effect.succeed("<div>b</div>"))

    const merged = Route.merge(routeA, routeB)

    type MergedSchemas = RouteSet.RouteSet.Schemas<typeof merged>

    type
      .expectTypeOf<MergedSchemas["PathParams"]>()
      .toExtend<Schema.Struct<{ readonly id: typeof Schema.NumberFromString }>>()
    type
      .expectTypeOf<MergedSchemas["UrlParams"]>()
      .toExtend<Schema.Struct<{ readonly page: typeof Schema.NumberFromString }>>()
  })

  test.it(
    "allows multiple content routes with same method+kind for layering",
    () => {
      const wrapper = Route.html(function*(_c) {
        return "<wrap>content</wrap>"
      })
      const content = Route.html("<div>content</div>")

      const merged = Route.merge(wrapper, content)
      test
        .expect(RouteSet.items(merged))
        .toHaveLength(2)
    },
  )

  test.it("allows multiple HttpMiddleware routes", () => {
    const middleware1 = Route.http(
      HttpMiddleware.make(() => HttpServerResponse.empty()),
    )
    const middleware2 = Route.http(
      HttpMiddleware.make(() => HttpServerResponse.empty()),
    )

    const merged = Route.merge(middleware1, middleware2)
    test
      .expect(RouteSet.items(merged))
      .toHaveLength(2)
  })
})
