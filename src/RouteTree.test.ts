import * as test from "bun:test"
import * as Route from "./Route.ts"
import * as RouteTree from "./RouteTree.ts"

test.describe(RouteTree.make, () => {
  test.it("makes", () => {
    const routes = RouteTree.make({
      "/admin": Route
        .use(
          Route.filter({
            context: {
              isAdmin: true,
            },
          }),
        )
        .get(
          Route.text("admin home"),
        ),

      "/users": Route
        .get(
          Route.text("users list"),
        ),
    })

    test
      .expectTypeOf<RouteTree.Routes<typeof routes>>()
      .toExtend<{
        "/admin": unknown
        "/users": unknown
      }>()
  })
})

test.describe(RouteTree.add, () => {
  test.it("adds routes", () => {
    const routes = RouteTree
      .add(
        "/admin",
        Route
          .use(
            Route.filter({
              context: {
                isAdmin: true,
              },
            }),
          )
          .get(
            Route.text("admin home"),
          ),
      )
      .add(
        "/admin/users",
        Route.get(
          Route.text("users list"),
        ),
      )
      .add(
        "/about",
        Route.get(
          Route.text("about us"),
        ),
      )

    test
      .expectTypeOf<RouteTree.Routes<typeof routes>>()
      .toExtend<
        {
          "/admin": unknown
          "/admin/users": unknown
          "/about": unknown
        }
      >()
  })
})

test.describe(RouteTree.walk, () => {
  test.it("walks", () => {
    const routes = RouteTree.make({
      "/": Route.get(Route.text("home")),
      "/users": Route.get(Route.text("users list")),
      "/users/:userId": Route.get(Route.text("users list")),
      "/admin": Route
        .use(Route.filter({ context: { admin: true } })),
      "/admin/users": Route
        .post(Route.json({ ok: true })),
      "/admin/stats": Route
        .get(Route.html("admin stats")),
    })

    const nodes = [...RouteTree.walk(routes)]

    test
      .expect(nodes)
      .toHaveLength(6)
    test
      .expect(Route.descriptor(nodes[0]))
      .toEqual({
        path: "/",
        method: "GET",
        format: "text",
      })
    test
      .expect(Route.descriptor(nodes[1]))
      .toEqual({
        path: "/users",
        method: "GET",
        format: "text",
      })
    test
      .expect(Route.descriptor(nodes[2]))
      .toEqual({
        path: "/users/:userId",
        method: "GET",
        format: "text",
      })
    test
      .expect(Route.descriptor(nodes[3]))
      .toEqual({
        path: "/admin",
        method: "*",
      })
    test
      .expect(Route.descriptor(nodes[4]))
      .toEqual({
        path: "/admin/users",
        method: "POST",
        format: "json",
      })
    test
      .expect(Route.descriptor(nodes[5]))
      .toEqual({
        path: "/admin/stats",
        method: "GET",
        format: "html",
      })
  })
})
