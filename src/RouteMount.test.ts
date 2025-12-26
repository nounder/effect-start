import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Route from "./Route.ts"

test.it("uses GET method", async () => {
  const route = Route.get(
    Route.text((context) =>
      Effect.gen(function*() {
        test
          .expectTypeOf(context)
          .toMatchObjectType<{
            method: "GET"
            format: "text"
          }>()
        test
          .expect(context)
          .toEqual({
            method: "GET",
            format: "text",
          })

        return "Hello, World!"
      })
    ),
  )

  test
    .expectTypeOf(route)
    .toExtend<
      Route.RouteSet.RouteSet<{}, {}, [
        Route.RouteSet.RouteSet<
          {
            method: "GET"
          },
          {},
          [
            Route.Route.Route<
              {
                format: "text"
              },
              {},
              string
            >,
          ]
        >,
      ]>
    >()

  test
    .expectTypeOf<Route.Route.Bindings<typeof route>>()
    .toMatchObjectType<{
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
})

test.it(`infers context from use()`, () => {
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

  // First use() - adds answer context
  test
    .expectTypeOf<Items[0]>()
    .toExtend<
      Route.RouteSet.RouteSet<
        { method: "*" },
        {},
        [
          Route.Route.Route<{}, { answer: number }, void>,
        ]
      >
    >()

  // Second use() - adds doubledAnswer context
  test
    .expectTypeOf<Items[1]>()
    .toExtend<
      Route.RouteSet.RouteSet<
        { method: "*" },
        { answer: number },
        [
          Route.Route.Route<{}, { doubledAnswer: number }, void>,
        ]
      >
    >()

  // GET route - inherits answer/doubledAnswer, adds getter
  test
    .expectTypeOf<Items[2]>()
    .toExtend<
      Route.RouteSet.RouteSet<
        { method: "GET" },
        { answer: number; doubledAnswer: number },
        [
          Route.Route.Route<{}, { getter: boolean }, void, never, never>,
          Route.Route.Route<{ format: "text" }, {}, any>,
        ]
      >
    >()

  // POST route - inherits answer/doubledAnswer only
  test
    .expectTypeOf<Items[3]>()
    .toExtend<
      Route.RouteSet.RouteSet<
        { method: "POST" },
        { answer: number; doubledAnswer: number },
        [
          Route.Route.Route<{ format: "json" }, {}, any>,
        ]
      >
    >()
})
