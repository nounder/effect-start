import * as test from "bun:test"
import * as Route from "effect-start/Route"
import * as RouteMap from "effect-start/RouteMap"

test.describe("layer route", () => {
  test.it("merges LayerRoute into other routes", () => {
    const tree = RouteMap.make({
      "*": Route.use(Route.filter({ context: { authenticated: true } })),
      "/users": Route.get(Route.text("users")),
    })

    test.expectTypeOf<typeof tree>().toExtend<{
      "/users": Route.Route.Tuple
    }>()

    // "*" key should not exist in the resulting type
    test.expectTypeOf<typeof tree>().not.toHaveProperty("*")

    // layer route should be first in the tuple (method: "*")
    test.expectTypeOf<(typeof tree)["/users"][0]>().toExtend<Route.Route.With<{ method: "*" }>>()

    // actual route should be second (method: "GET")
    test
      .expectTypeOf<(typeof tree)["/users"][1]>()
      .toExtend<Route.Route.With<{ method: "GET" }>>()
  })

  test.it("prepends LayerRoute to all other routes when walking", () => {
    const tree = RouteMap.make({
      "*": Route.use(Route.filter({ context: { layer: true } })),
      "/users": Route.get(Route.text("users")),
      "/admin": Route.post(Route.json({ ok: true })),
    })

    test.expect(Route.descriptor(RouteMap.walk(tree))).toEqual([
      { path: "/admin", method: "*" },
      { path: "/admin", method: "POST", format: "json" },
      { path: "/users", method: "*" },
      { path: "/users", method: "GET", format: "text" },
    ])
  })

  test.it("prepends multiple LayerRoutes to all other routes", () => {
    const tree = RouteMap.make({
      "*": Route.use(Route.filter({ context: { first: true } })).use(
        Route.filter({ context: { second: true } }),
      ),
      "/users": Route.get(Route.text("users")),
    })

    test.expect(Route.descriptor(RouteMap.walk(tree))).toEqual([
      { path: "/users", method: "*" },
      { path: "/users", method: "*" },
      { path: "/users", method: "GET", format: "text" },
    ])
  })

  test.it("only allows method '*' routes under '*' key", () => {
    const _tree = RouteMap.make({
      // @ts-expect-error - LayerRoute must have method "*"
      "*": Route.get(Route.text("invalid")),
      "/users": Route.get(Route.text("users")),
    })
  })

  test.it("works without LayerRoute (no '*' key)", () => {
    const tree = RouteMap.make({
      "/users": Route.get(Route.text("users")),
      "/admin": Route.post(Route.json({ ok: true })),
    })

    test
      .expect(Route.descriptor(RouteMap.walk(tree)).map((d) => d.path))
      .toEqual(["/admin", "/users"])
  })
})

test.describe(RouteMap.make, () => {
  test.it("makes", () => {
    const routes = RouteMap.make({
      "/admin": Route.use(
        Route.filter({
          context: {
            isAdmin: true,
          },
        }),
      ).get(Route.text("admin home")),

      "/users": Route.get(Route.text("users list")),
    })

    test.expectTypeOf<typeof routes>().toExtend<{
      "/admin": unknown
      "/users": unknown
    }>()
  })

  test.it("flattens nested route trees with prefixed paths", () => {
    const apiTree = RouteMap.make({
      "/users": Route.get(Route.json({ users: [] })),
      "/posts": Route.get(Route.json({ posts: [] })),
    })

    const tree = RouteMap.make({
      "/": Route.get(Route.text("home")),
      "/api": apiTree,
    })

    test.expectTypeOf<(typeof tree)["/"]>().toExtend<Route.Route.Tuple>()

    test
      .expectTypeOf<(typeof tree)["/"][0]>()
      .toExtend<Route.Route.With<{ method: "GET"; format: "text" }>>()

    test.expectTypeOf<(typeof tree)["/api/users"]>().toExtend<Route.Route.Tuple>()

    test
      .expectTypeOf<(typeof tree)["/api/users"][0]>()
      .toExtend<Route.Route.With<{ method: "GET"; format: "json" }>>()

    test.expectTypeOf<(typeof tree)["/api/posts"]>().toExtend<Route.Route.Tuple>()

    test
      .expectTypeOf<(typeof tree)["/api/posts"][0]>()
      .toExtend<Route.Route.With<{ method: "GET"; format: "json" }>>()
  })

  test.it("walks nested route trees with prefixed paths", () => {
    const apiTree = RouteMap.make({
      "/users": Route.get(Route.json({ users: [] })),
      "/posts": Route.post(Route.json({ ok: true })),
    })

    const tree = RouteMap.make({
      "/": Route.get(Route.text("home")),
      "/api": apiTree,
    })

    test.expect(Route.descriptor(RouteMap.walk(tree))).toEqual([
      { path: "/", method: "GET", format: "text" },
      { path: "/api/posts", method: "POST", format: "json" },
      { path: "/api/users", method: "GET", format: "json" },
    ])
  })

  test.it("deeply nested route trees", () => {
    const v1Tree = RouteMap.make({
      "/health": Route.get(Route.text("ok")),
    })

    const apiTree = RouteMap.make({
      "/v1": v1Tree,
    })

    const tree = RouteMap.make({
      "/api": apiTree,
    })

    test
      .expect(Route.descriptor(RouteMap.walk(tree)).map((d) => d.path))
      .toEqual(["/api/v1/health"])
  })

})

test.describe(RouteMap.walk, () => {
  test.it("walks in sorted order: by depth, static before params", () => {
    // routes defined in random order
    const routes = RouteMap.make({
      "/users/:userId": Route.get(Route.text("user detail")),
      "/admin/stats": Route.get(Route.html("admin stats")),
      "/": Route.get(Route.text("home")),
      "/admin/users": Route.post(Route.json({ ok: true })),
      "/users": Route.get(Route.text("users list")),
      "/admin": Route.use(Route.filter({ context: { admin: true } })),
    })

    // expected order:
    // depth 0: /
    // depth 1: /admin, /users (alphabetical)
    // depth 2: /admin/stats, /admin/users, /users/:userId (static first, param last)
    test
      .expect(Route.descriptor(RouteMap.walk(routes)).map((d) => d.path))
      .toEqual(["/", "/admin", "/users", "/admin/stats", "/admin/users", "/users/:userId"])
  })

  test.it("static < :param < :param? < :param+ < :param*", () => {
    const routes = RouteMap.make({
      "/:path*": Route.get(Route.text("catch all")),
      "/about": Route.get(Route.text("about")),
      "/:path+": Route.get(Route.text("one or more")),
      "/:page": Route.get(Route.text("single param")),
      "/:page?": Route.get(Route.text("optional param")),
    })

    test
      .expect(Route.descriptor(RouteMap.walk(routes)).map((d) => d.path))
      .toEqual(["/about", "/:page", "/:page?", "/:path+", "/:path*"])
  })

  test.it("greedy routes come after all non-greedy across depth", () => {
    const routes = RouteMap.make({
      "/:path*": Route.get(Route.text("catch all")),
      "/users/:id": Route.get(Route.text("user detail")),
      "/users": Route.get(Route.text("users")),
      "/users/:id/posts/:postId": Route.get(Route.text("post detail")),
    })

    test
      .expect(Route.descriptor(RouteMap.walk(routes)).map((d) => d.path))
      .toEqual(["/users", "/users/:id", "/users/:id/posts/:postId", "/:path*"])
  })

  test.it("greedy routes sorted by greedy position", () => {
    const routes = RouteMap.make({
      "/:path*": Route.get(Route.text("root catch all")),
      "/api/:rest*": Route.get(Route.text("api catch all")),
      "/api/v1/:rest*": Route.get(Route.text("api v1 catch all")),
    })

    test
      .expect(Route.descriptor(RouteMap.walk(routes)).map((d) => d.path))
      .toEqual(["/api/v1/:rest*", "/api/:rest*", "/:path*"])
  })

  test.it("greedy routes with same position sorted by prefix then type", () => {
    const routes = RouteMap.make({
      "/docs/:path*": Route.get(Route.text("docs catch all")),
      "/api/:rest+": Route.get(Route.text("api one or more")),
      "/api/:rest*": Route.get(Route.text("api catch all")),
    })

    // /api before /docs (alphabetical), then + before * for same prefix
    test
      .expect(Route.descriptor(RouteMap.walk(routes)).map((d) => d.path))
      .toEqual(["/api/:rest+", "/api/:rest*", "/docs/:path*"])
  })
})

test.describe(RouteMap.merge, () => {
  test.it("rejects RouteMapInput with '*' wildcard key", () => {
    const a = RouteMap.make({ "/users": Route.get(Route.text("users")) })

    RouteMap.merge(a, {
      // @ts-expect-error - RouteMap keys must be path patterns, not "*"
      "*": Route.use(Route.filter({ context: { layer: true } })),
    })
  })

  test.it("combines disjoint paths", () => {
    const a = RouteMap.make({ "/users": Route.get(Route.text("users")) })
    const b = RouteMap.make({ "/posts": Route.get(Route.text("posts")) })

    const merged = RouteMap.merge(a, b)

    test
      .expect(Route.descriptor(RouteMap.walk(merged)).map((d) => d.path))
      .toEqual(["/posts", "/users"])
  })

  test.it("concatenates routes at overlapping paths", () => {
    const a = RouteMap.make({ "/users": Route.get(Route.text("get users")) })
    const b = RouteMap.make({ "/users": Route.post(Route.text("create user")) })

    const merged = RouteMap.merge(a, b)

    test.expect(Route.descriptor(RouteMap.walk(merged))).toEqual([
      { path: "/users", method: "GET", format: "text" },
      { path: "/users", method: "POST", format: "text" },
    ])
  })

  test.it("returns sorted result", () => {
    const a = RouteMap.make({ "/users/:id": Route.get(Route.text("user")) })
    const b = RouteMap.make({
      "/users": Route.get(Route.text("users list")),
      "/": Route.get(Route.text("home")),
    })

    const merged = RouteMap.merge(a, b)

    test
      .expect(Route.descriptor(RouteMap.walk(merged)).map((d) => d.path))
      .toEqual(["/", "/users", "/users/:id"])
  })
})
