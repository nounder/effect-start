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
      .toHaveLength(3)

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

    // GET route
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
})

test.it("mount contents", () => {
  const routes = Route
    .add(
      "/about",
      Route.get(Route.text("It's about me!")),
    )
    .add(
      "/users/:id",
      Route.get(Route.text("User profile")),
    )

  const items = Route.items(routes)

  test
    .expect(items)
    .toHaveLength(2)

  test
    .expect(Route.descriptor(items[0]))
    .toMatchObject({ path: "/about", method: "GET" })

  test
    .expect(Route.descriptor(items[1]))
    .toMatchObject({ path: "/users/:id", method: "GET" })

  type Items = Route.RouteSet.Items<typeof routes>

  test
    .expectTypeOf<Items[0][typeof Route.RouteDescriptor]>()
    .toMatchObjectType<{ path: "/about"; method: "GET" }>()

  test
    .expectTypeOf<Items[1][typeof Route.RouteDescriptor]>()
    .toMatchObjectType<{ path: "/users/:id"; method: "GET" }>()
})

test.it("mount mounted content", () => {
  const routes = Route
    .add(
      "/admin",
      Route
        .add(
          "/users",
          Route.get(Route.text("Admin users list")),
        )
        .add(
          "/settings",
          Route.get(Route.text("Admin settings")),
        ),
    )

  const items = Route.items(routes)

  test
    .expect(items)
    .toHaveLength(2)

  test
    .expect(Route.descriptor(items[0]))
    .toMatchObject({ path: "/admin/users", method: "GET" })

  test
    .expect(Route.descriptor(items[1]))
    .toMatchObject({ path: "/admin/settings", method: "GET" })

  type Items = Route.RouteSet.Items<typeof routes>

  test
    .expectTypeOf<Items["length"]>()
    .toEqualTypeOf<2>()

  test
    .expectTypeOf<Items[0][typeof Route.RouteDescriptor]>()
    .toMatchObjectType<{ path: "/admin/users"; method: "GET" }>()

  test
    .expectTypeOf<Items[1][typeof Route.RouteDescriptor]>()
    .toMatchObjectType<{ path: "/admin/settings"; method: "GET" }>()
})

test.it("add preserves original handlers", async () => {
  let handlerCalled = false
  const routes = Route.add(
    "/api",
    Route.get(
      Route.text((ctx) => {
        handlerCalled = true
        return Effect.succeed(`Hello from ${ctx.format}`)
      }),
    ),
  )

  const items = Route.items(routes)
  test.expect(items).toHaveLength(1)

  const mountedItem = items[0] as Route.RouteSet.Any
  test.expect(Route.descriptor(mountedItem)).toMatchObject({ path: "/api" })

  const nestedItems = Route.items(mountedItem)
  test.expect(nestedItems).toHaveLength(1)

  const textRoute = nestedItems[0] as Route.Route.Route
  test.expect(Route.isRoute(textRoute)).toBe(true)
  test.expect(Route.descriptor(textRoute)).toMatchObject({ format: "text" })

  const result = await Effect.runPromise(
    textRoute.handler(
      { format: "text", method: "GET", path: "/api" },
      () => Effect.succeed("unused"),
    ),
  )
  test.expect(result).toBe("Hello from text")
  test.expect(handlerCalled).toBe(true)
})
