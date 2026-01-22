import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import * as Route from "./Route.ts"
import * as RouteMount from "./RouteMount.ts"

test.it("uses GET method", async () => {
  const route = Route.get(
    Route.text((context) =>
      Effect.gen(function*() {
        test
          .expectTypeOf(context)
          .toMatchObjectType<{
            method: "GET"
            format: "text"
            request: Request
          }>()
        test
          .expect(context.method)
          .toEqual("GET")
        test
          .expect(context.format)
          .toEqual("text")

        return "Hello, World!"
      })
    ),
  )

  test
    .expectTypeOf(route)
    .toMatchTypeOf<
      Route.RouteSet.RouteSet<
        {},
        {},
        [
          Route.Route.Route<
            {
              method: "GET"
              format: "text"
            },
            {},
            string
          >,
        ]
      >
    >()

  test
    .expect(Route.items(route))
    .toHaveLength(1)

  test
    .expectTypeOf<Route.Route.Context<typeof route>>()
    .toMatchTypeOf<{
      method: "GET"
      format: "text"
    }>()
})

test.it("uses GET & POST method", async () => {
  const route = Route
    .get(
      Route.text((r) => {
        test
          .expectTypeOf(r.method)
          .toEqualTypeOf<"GET">()
        test
          .expectTypeOf(r.format)
          .toEqualTypeOf<"text">()

        return Effect.succeed("get")
      }),
    )
    .post(
      Route.text((r) => {
        test
          .expectTypeOf(r.method)
          .toEqualTypeOf<"POST">()
        test
          .expectTypeOf(r.format)
          .toEqualTypeOf<"text">()

        return Effect.succeed("post")
      }),
    )

  test
    .expect(Route.items(route))
    .toHaveLength(2)

  type Items = Route.RouteSet.Items<typeof route>

  test
    .expectTypeOf<Items[0]>()
    .toExtend<
      Route.Route.Route<
        {
          method: "GET"
          format: "text"
        },
        {},
        string
      >
    >()

  test
    .expectTypeOf<Items[1]>()
    .toExtend<
      Route.Route.Route<
        {
          method: "POST"
          format: "text"
        },
        {},
        string
      >
    >()
})

test.describe("use", () => {
  test.it(`infers context`, () => {
    const routes = Route
      .use(
        Route.filter({
          context: {
            answer: 42,
          },
        }),
      )
      .use(
        Route.filter((ctx) => {
          test
            .expectTypeOf(ctx)
            .toMatchObjectType<{
              answer: number
            }>()

          return {
            context: {
              doubledAnswer: ctx.answer * 2,
            },
          }
        }),
      )
      .get(
        Route.filter({
          context: {
            getter: true,
          },
        }),
        Route.text(function*(ctx) {
          test
            .expectTypeOf(ctx)
            .toMatchObjectType<{
              method: "GET"
              format: "text"
              answer: number
              doubledAnswer: number
              getter: boolean
            }>()

          return `The answer is ${ctx.answer}`
        }),
      )
      .post(
        Route.json(function*(ctx) {
          test
            .expectTypeOf(ctx)
            .not
            .toHaveProperty("getter")

          test
            .expectTypeOf(ctx)
            .toMatchObjectType<{
              method: "POST"
              answer: number
              doubledAnswer: number
              format: "json"
            }>()

          return {
            ok: true,
            answer: ctx.answer,
          }
        }),
      )

    type Items = Route.RouteSet.Items<typeof routes>

    test
      .expect(Route.items(routes))
      .toHaveLength(5)

    // First use() - adds answer context (method flattened into Route descriptor)
    test
      .expectTypeOf<Route.RouteSet.Descriptor<Items[0]>>()
      .toMatchObjectType<{ method: "*" }>()

    test
      .expectTypeOf<Route.Route.Bindings<Items[0]>>()
      .toMatchTypeOf<{ answer: number }>()

    test
      .expectTypeOf<Route.Route.Context<Items[0]>>()
      .toMatchTypeOf<{
        method: "*"
        answer: number
      }>()

    // Second use() - adds doubledAnswer context, inherits answer binding (method flattened into Route descriptor)
    test
      .expectTypeOf<Route.RouteSet.Descriptor<Items[1]>>()
      .toMatchObjectType<{ method: "*" }>()

    test
      .expectTypeOf<Route.Route.Bindings<Items[1]>>()
      .toMatchTypeOf<{
        answer: number
        doubledAnswer: number
      }>()

    test
      .expectTypeOf<Route.Route.Context<Items[1]>>()
      .toMatchTypeOf<{
        method: "*"
        answer: number
        doubledAnswer: number
      }>()

    // GET filter route
    test
      .expectTypeOf<Route.RouteSet.Descriptor<Items[2]>>()
      .toMatchObjectType<{ method: "GET" }>()

    test
      .expectTypeOf<Route.Route.Bindings<Items[2]>>()
      .toMatchTypeOf<{
        answer: number
        doubledAnswer: number
        getter: boolean
      }>()

    test
      .expectTypeOf<Route.Route.Context<Items[2]>>()
      .toMatchTypeOf<{
        method: "GET"
        answer: number
        doubledAnswer: number
        getter: boolean
      }>()

    // GET text route
    test
      .expectTypeOf<Route.RouteSet.Descriptor<Items[3]>>()
      .toMatchObjectType<{
        method: "GET"
        format: "text"
      }>()

    test
      .expectTypeOf<Route.Route.Bindings<Items[3]>>()
      .toMatchTypeOf<{
        answer: number
        doubledAnswer: number
        getter: boolean
      }>()

    test
      .expectTypeOf<Route.Route.Context<Items[3]>>()
      .toMatchTypeOf<{
        method: "GET"
        format: "text"
        answer: number
        doubledAnswer: number
        getter: boolean
      }>()

    // POST route - inherits answer/doubledAnswer only (no getter since that was in GET branch)
    test
      .expectTypeOf<Route.RouteSet.Descriptor<Items[4]>>()
      .toMatchObjectType<{
        method: "POST"
        format: "json"
      }>()

    test
      .expectTypeOf<Route.Route.Bindings<Items[4]>>()
      .toMatchTypeOf<{
        answer: number
        doubledAnswer: number
      }>()

    test
      .expectTypeOf<Route.Route.Context<Items[4]>>()
      .toMatchTypeOf<{
        method: "POST"
        format: "json"
        answer: number
        doubledAnswer: number
      }>()
  })
})

test.it("Builder extends RouteSet", () => {
  const builder = Route
    .use(
      Route.filter({
        context: { answer: 42 },
      }),
    )
    .get(Route.text("Hello"))

  test
    .expectTypeOf(builder)
    .toExtend<Route.RouteSet.Any>()

  test
    .expectTypeOf(builder)
    .toExtend<Route.RouteSet.RouteSet<any, any, any>>()

  // Verify it has the TypeId
  test
    .expect(builder[Route.TypeId])
    .toBe(Route.TypeId)

  // Verify it's iterable (from RouteSet.Proto)
  test
    .expect(Symbol.iterator in builder)
    .toBe(true)
})

test.it("schemaHeaders flattens method into route descriptor", () => {
  const routes = Route
    .use(
      Route.schemaHeaders(
        Schema.Struct({
          "hello": Schema.String,
        }),
      ),
    )
    .get(
      Route.schemaHeaders(
        Schema.Struct({
          "x-custom-header": Schema.String,
        }),
      ),
      Route.html(function*(_ctx) {
        return `<h1>Hello, world!</h1>`
      }),
    )
    .post(
      Route.filter({
        context: {
          postOnly: "yo",
        },
      }),
      Route.text(function*(ctx) {
        return "hello"
      }),
    )

  type Items = Route.RouteSet.Items<typeof routes>

  // Assert routes is a Builder with specific descriptor
  test
    .expectTypeOf(routes)
    .toExtend<
      RouteMount.RouteMount.Builder<
        {},
        Items
      >
    >()

  test
    .expect(Route.items(routes))
    .toHaveLength(5)

  // First use() - schemaHeaders with method "*"
  test
    .expectTypeOf<Items[0]>()
    .toExtend<
      Route.Route.Route<
        { method: "*" },
        {
          headers: {
            readonly hello: string
          }
        },
        unknown,
        ParseResult.ParseError,
        HttpServerRequest.HttpServerRequest
      >
    >()

  // GET schemaHeaders
  test
    .expectTypeOf<Items[1]>()
    .toExtend<
      Route.Route.Route<
        { method: "GET" },
        {
          headers: {
            readonly hello: string
            readonly "x-custom-header": string
          }
        },
        unknown,
        ParseResult.ParseError,
        HttpServerRequest.HttpServerRequest
      >
    >()

  // GET html route
  test
    .expectTypeOf<Items[2]>()
    .toExtend<
      Route.Route.Route<
        {
          method: "GET"
          format: "html"
        },
        {
          headers: {
            readonly hello: string
            readonly "x-custom-header": string
          }
        },
        any
      >
    >()

  // POST filter route
  test
    .expectTypeOf<Items[3]>()
    .toExtend<
      Route.Route.Route<
        { method: "POST" },
        {
          headers: {
            readonly hello: string
          }
          postOnly: string
        },
        unknown
      >
    >()

  // POST text route - verify descriptor and bindings separately
  test
    .expectTypeOf<Route.RouteSet.Descriptor<Items[4]>>()
    .toMatchObjectType<{
      method: "POST"
      format: "text"
    }>()

  test
    .expectTypeOf<Route.Route.Context<Items[4]>>()
    .toMatchTypeOf<{
      method: "POST"
      format: "text"
      headers: {
        readonly hello: string
      }
      postOnly: string
    }>()
})

test.it("provides request in default bindings", () => {
  Route.get(
    Route.text((ctx) => {
      test
        .expectTypeOf(ctx.request)
        .toEqualTypeOf<Request>()

      return Effect.succeed("ok")
    }),
  )
})
