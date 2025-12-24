import * as test from "bun:test"
import { Effect } from "effect"
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
  const context = {
    answer: 42,
  }

  const filterAnswer = Route.filter({
    context,
  })

  const routes = Route
    .use(
      filterAnswer,
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
            getter: boolean
          }>()

        return `The answer is ${ctx.answer}`
      }),
    )
    .post(
      Route.json(function*(ctx) {
        test
          .expectTypeOf(ctx)
          .toMatchObjectType<{
            method: "POST"
            answer: number
            format: "json"
          }>()

        return {
          ok: true,
          answer: ctx.answer,
        }
      }),
    )

  // TODO :type check for compatbility with RouteSet and presence of method=* descriptor
})
