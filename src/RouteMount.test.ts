import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
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
      .expectTypeOf<Items[0]>()
      .toExtend<
        Route.Route.Route<
          { method: "*" },
          { answer: number },
          void
        >
      >()

    // Second use() - adds doubledAnswer context, inherits answer binding (method flattened into Route descriptor)
    test
      .expectTypeOf<Items[1]>()
      .toExtend<
        Route.Route.Route<
          { method: "*" },
          {
            answer: number
            doubledAnswer: number
          },
          void
        >
      >()

    // GET filter route
    test
      .expectTypeOf<Items[2]>()
      .toExtend<
        Route.Route.Route<
          { method: "GET" },
          {
            answer: number
            doubledAnswer: number
            getter: boolean
          },
          void,
          never,
          never
        >
      >()

    // GET text route
    test
      .expectTypeOf<Items[3]>()
      .toExtend<
        Route.Route.Route<
          {
            method: "GET"
            format: "text"
          },
          {
            answer: number
            doubledAnswer: number
            getter: boolean
          },
          any
        >
      >()

    // POST route - inherits answer/doubledAnswer only (no getter since that was in GET branch)
    test
      .expectTypeOf<Items[4]>()
      .toExtend<
        Route.Route.Route<
          {
            method: "POST"
            format: "json"
          },
          {
            answer: number
            doubledAnswer: number
          },
          any
        >
      >()
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

