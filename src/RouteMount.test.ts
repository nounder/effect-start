import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Route from "./Route.ts"
import * as RouteBody from "./RouteBody.ts"
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
    .expectTypeOf<Route.RouteMount.Routes<typeof route>>()
    .toMatchObjectType<{}>()
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

    test
      .expect(Route.items(routes))
      .toHaveLength(3)

    test
      .expectTypeOf<Route.RouteMount.Routes<typeof routes>>()
      .toMatchObjectType<{}>()

    test
      .expectTypeOf<Route.RouteMount.BuilderBindings<typeof routes>>()
      .toMatchObjectType<{
        answer: number
        doubledAnswer: number
      }>()
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

  type Routes = Route.RouteMount.Routes<typeof routes>

  test
    .expectTypeOf<Routes["/about"]>()
    .toExtend<
      Route.RouteSet.RouteSet<
        RouteMount.Method,
        {},
        Route.RouteSet.Tuple<RouteBody.Format>
      >
    >()

  test
    .expectTypeOf<Routes["/users/:id"]>()
    .toExtend<
      Route.RouteSet.RouteSet<
        RouteMount.Method,
        {},
        Route.RouteSet.Tuple<RouteBody.Format>
      >
    >()
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
    .toMatchObject({
      path: "/admin/users",
      method: "GET",
    })

  test
    .expect(Route.descriptor(items[1]))
    .toMatchObject({
      path: "/admin/settings",
      method: "GET",
    })

  type Routes = Route.RouteMount.Routes<typeof routes>

  test
    .expectTypeOf<Routes["/admin"]>()
    .toExtend<
      Route.RouteSet.RouteSet<
        RouteMount.Method,
        {},
        Route.RouteSet.Tuple<RouteBody.Format>
      >
    >()
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
  test
    .expect(items)
    .toHaveLength(1)

  const mountedItem = items[0] as Route.RouteSet.Any
  test
    .expect(Route.descriptor(mountedItem))
    .toMatchObject({ path: "/api" })

  const nestedItems = Route.items(mountedItem)
  test
    .expect(nestedItems)
    .toHaveLength(1)

  const textRoute = nestedItems[0] as Route.Route.Route
  test
    .expect(Route.isRoute(textRoute))
    .toBe(true)
  test
    .expect(Route.descriptor(textRoute))
    .toMatchObject({ format: "text" })

  const result = await Effect.runPromise(
    textRoute.handler(
      { format: "text", method: "GET", path: "/api" },
      () => Effect.succeed("unused"),
    ),
  )
  test
    .expect(result)
    .toBe("Hello from text")
  test
    .expect(handlerCalled)
    .toBe(true)
})

// test.it("add preserves higher context when using callback", () => {
//   Route
//     .use(
//       Route.filter({ context: { app: "Ecma" } }),
//     )
//     .add(
//       "/user",
//       (self) =>
//         self
//           .use(
//             Route.filter({ context: { name: "Johnny" } }),
//           )
//           .get(
//             Route.text(function*(c) {
//               test
//                 .expectTypeOf(c)
//                 .toHaveProperty("app")

//               return `Hello, ${c.name}`
//             }),
//             Route.html(function*(c) {
//               test
//                 .expectTypeOf(c)
//                 .toHaveProperty("app")

//               test
//                 .expectTypeOf(c)
//                 .toHaveProperty("name")

//               return `<h1>Hello, ${c.name}</h1>`
//             }),
//           ),
//     )
// })
