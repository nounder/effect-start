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

        return Effect.succeed("get")
      }),
    )
    .post(
      Route.text((r) => {
        test
          .expectTypeOf(r.method)
          .toEqualTypeOf<"POST">()

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
        // bindings defined specific method routes must not propagate
        // to other methods
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

  test
    .expectTypeOf(routes)
    .toExtend<
      Route.RouteSet.RouteSet<
        {},
        {
          answer: number
          doubledAnswer: number
        },
        [
          Route.RouteSet.RouteSet<
            { method: "*" },
            {},
            [
              Route.Route.Route<
                {},
                { answer: number },
                void
              >,
            ]
          >,
          Route.RouteSet.RouteSet<
            { method: "*" },
            {},
            [
              Route.Route.Route<
                {},
                { answer: number },
                void,
                never,
                never
              >,
              Route.Route.Route<
                {},
                { doubledAnswer: number },
                void
              >,
            ]
          >,
          Route.RouteSet.RouteSet<
            { method: "GET" },
            {},
            [
              Route.Route.Route<
                {},
                { answer: number; doubledAnswer: number },
                void
              >,
              Route.Route.Route<
                {},
                { getter: boolean },
                void,
                never,
                never
              >,
              Route.Route.Route<
                { format: "text" },
                {},
                any
              >,
            ]
          >,
          Route.RouteSet.RouteSet<
            { method: "POST" },
            {},
            [
              Route.Route.Route<
                {},
                { answer: number; doubledAnswer: number },
                void
              >,
              Route.Route.Route<
                { format: "json" },
                {},
                any
              >,
            ]
          >,
        ]
      >
    >()
})
