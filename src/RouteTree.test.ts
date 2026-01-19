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

test.describe(RouteTree.walk, () => {
  test.it("walks in sorted order: by depth, static before params", () => {
    // routes defined in random order
    const routes = RouteTree.make({
      "/users/:userId": Route.get(Route.text("user detail")),
      "/admin/stats": Route.get(Route.html("admin stats")),
      "/": Route.get(Route.text("home")),
      "/admin/users": Route.post(Route.json({ ok: true })),
      "/users": Route.get(Route.text("users list")),
      "/admin": Route.use(Route.filter({ context: { admin: true } })),
    })

    const nodes = [...RouteTree.walk(routes)]
    const paths = nodes.map((n) => Route.descriptor(n).path)

    // expected order:
    // depth 0: /
    // depth 1: /admin, /users (alphabetical)
    // depth 2: /admin/stats, /admin/users, /users/:userId (static first, param last)
    test
      .expect(paths)
      .toEqual([
        "/",
        "/admin",
        "/users",
        "/admin/stats",
        "/admin/users",
        "/users/:userId",
      ])

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
        path: "/admin",
        method: "*",
      })
    test
      .expect(Route.descriptor(nodes[2]))
      .toEqual({
        path: "/users",
        method: "GET",
        format: "text",
      })
    test
      .expect(Route.descriptor(nodes[3]))
      .toEqual({
        path: "/admin/stats",
        method: "GET",
        format: "html",
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
        path: "/users/:userId",
        method: "GET",
        format: "text",
      })
  })

  test.it("static < :param < :param? < :param+ < :param*", () => {
    const routes = RouteTree.make({
      "/:path*": Route.get(Route.text("catch all")),
      "/about": Route.get(Route.text("about")),
      "/:path+": Route.get(Route.text("one or more")),
      "/:page": Route.get(Route.text("single param")),
      "/:page?": Route.get(Route.text("optional param")),
    })

    const nodes = [...RouteTree.walk(routes)]
    const paths = nodes.map((n) => Route.descriptor(n).path)

    test.expect(paths).toEqual([
      "/about",
      "/:page",
      "/:page?",
      "/:path+",
      "/:path*",
    ])
  })

  test.it("greedy routes come after all non-greedy across depth", () => {
    const routes = RouteTree.make({
      "/:path*": Route.get(Route.text("catch all")),
      "/users/:id": Route.get(Route.text("user detail")),
      "/users": Route.get(Route.text("users")),
      "/users/:id/posts/:postId": Route.get(Route.text("post detail")),
    })

    const nodes = [...RouteTree.walk(routes)]
    const paths = nodes.map((n) => Route.descriptor(n).path)

    // all non-greedy first (by depth), then greedy
    test.expect(paths).toEqual([
      "/users",
      "/users/:id",
      "/users/:id/posts/:postId",
      "/:path*",
    ])
  })

  test.it("greedy routes sorted by greedy position", () => {
    const routes = RouteTree.make({
      "/:path*": Route.get(Route.text("root catch all")),
      "/api/:rest*": Route.get(Route.text("api catch all")),
      "/api/v1/:rest*": Route.get(Route.text("api v1 catch all")),
    })

    const nodes = [...RouteTree.walk(routes)]
    const paths = nodes.map((n) => Route.descriptor(n).path)

    test.expect(paths).toEqual([
      "/api/v1/:rest*",
      "/api/:rest*",
      "/:path*",
    ])
  })

  test.it("greedy routes with same position sorted by prefix then type", () => {
    const routes = RouteTree.make({
      "/docs/:path*": Route.get(Route.text("docs catch all")),
      "/api/:rest+": Route.get(Route.text("api one or more")),
      "/api/:rest*": Route.get(Route.text("api catch all")),
    })

    const nodes = [...RouteTree.walk(routes)]
    const paths = nodes.map((n) => Route.descriptor(n).path)

    // /api before /docs (alphabetical), then + before * for same prefix
    test.expect(paths).toEqual([
      "/api/:rest+",
      "/api/:rest*",
      "/docs/:path*",
    ])
  })
})

test.describe(RouteTree.lookup, () => {
  test.it("matches static paths", () => {
    const tree = RouteTree.make({
      "/users": Route.get(Route.text("users list")),
      "/admin": Route.get(Route.text("admin")),
    })

    const result = RouteTree.lookup(tree, "GET", "/users")
    test.expect(result).not.toBeNull()
    test.expect(result!.params).toEqual({})
    test.expect(Route.descriptor(result!.route).path).toBe("/users")
  })

  test.it("extracts path parameters", () => {
    const tree = RouteTree.make({
      "/users/:id": Route.get(Route.text("user detail")),
    })

    const result = RouteTree.lookup(tree, "GET", "/users/123")
    test.expect(result).not.toBeNull()
    test.expect(result!.params).toEqual({ id: "123" })
  })

  test.it("filters by HTTP method", () => {
    const tree = RouteTree.make({
      "/users": Route.get(Route.text("get users")),
      "/admin": Route.post(Route.text("post admin")),
    })

    const getResult = RouteTree.lookup(tree, "GET", "/users")
    test.expect(getResult).not.toBeNull()

    const postOnGet = RouteTree.lookup(tree, "POST", "/users")
    test.expect(postOnGet).toBeNull()

    const postResult = RouteTree.lookup(tree, "POST", "/admin")
    test.expect(postResult).not.toBeNull()
  })

  test.it("wildcard method matches any method", () => {
    const tree = RouteTree.make({
      "/api": Route.use(Route.filter({ context: { api: true } })),
    })

    const getResult = RouteTree.lookup(tree, "GET", "/api")
    test.expect(getResult).not.toBeNull()

    const postResult = RouteTree.lookup(tree, "POST", "/api")
    test.expect(postResult).not.toBeNull()

    const deleteResult = RouteTree.lookup(tree, "DELETE", "/api")
    test.expect(deleteResult).not.toBeNull()
  })

  test.it("static routes take priority over param routes", () => {
    const tree = RouteTree.make({
      "/users/:id": Route.get(Route.text("user by id")),
      "/users/me": Route.get(Route.text("current user")),
    })

    const result = RouteTree.lookup(tree, "GET", "/users/me")
    test.expect(result).not.toBeNull()
    test.expect(Route.descriptor(result!.route).path).toBe("/users/me")
    test.expect(result!.params).toEqual({})
  })

  test.it("matches greedy params with +", () => {
    const tree = RouteTree.make({
      "/docs/:path+": Route.get(Route.text("docs")),
    })

    const result = RouteTree.lookup(tree, "GET", "/docs/api/v1/users")
    test.expect(result).not.toBeNull()
    test.expect(result!.params).toEqual({ path: "api/v1/users" })

    const noMatch = RouteTree.lookup(tree, "GET", "/docs")
    test.expect(noMatch).toBeNull()
  })

  test.it("matches greedy params with *", () => {
    const tree = RouteTree.make({
      "/files/:path*": Route.get(Route.text("files")),
    })

    const withPath = RouteTree.lookup(tree, "GET", "/files/a/b/c")
    test.expect(withPath).not.toBeNull()
    test.expect(withPath!.params).toEqual({ path: "a/b/c" })

    const withoutPath = RouteTree.lookup(tree, "GET", "/files")
    test.expect(withoutPath).not.toBeNull()
    test.expect(withoutPath!.params).toEqual({})
  })

  test.it("returns null for no match", () => {
    const tree = RouteTree.make({
      "/users": Route.get(Route.text("users")),
    })

    const result = RouteTree.lookup(tree, "GET", "/not-found")
    test.expect(result).toBeNull()
  })

  test.it("matches optional params with ?", () => {
    const tree = RouteTree.make({
      "/files/:name?": Route.get(Route.text("files")),
    })

    const withParam = RouteTree.lookup(tree, "GET", "/files/readme")
    test.expect(withParam).not.toBeNull()
    test.expect(withParam!.params).toEqual({ name: "readme" })

    const withoutParam = RouteTree.lookup(tree, "GET", "/files")
    test.expect(withoutParam).not.toBeNull()
    test.expect(withoutParam!.params).toEqual({})
  })

  test.it("respects route priority for complex trees", () => {
    const tree = RouteTree.make({
      "/:path*": Route.get(Route.text("catch all")),
      "/api/:rest+": Route.get(Route.text("api wildcard")),
      "/api/users": Route.get(Route.text("api users")),
      "/api/users/:id": Route.get(Route.text("api user detail")),
    })

    const staticMatch = RouteTree.lookup(tree, "GET", "/api/users")
    test.expect(Route.descriptor(staticMatch!.route).path).toBe("/api/users")

    const paramMatch = RouteTree.lookup(tree, "GET", "/api/users/123")
    test.expect(Route.descriptor(paramMatch!.route).path).toBe("/api/users/:id")
    test.expect(paramMatch!.params).toEqual({ id: "123" })

    const greedyMatch = RouteTree.lookup(tree, "GET", "/api/something/else")
    test.expect(Route.descriptor(greedyMatch!.route).path).toBe("/api/:rest+")
    test.expect(greedyMatch!.params).toEqual({ rest: "something/else" })

    const catchAll = RouteTree.lookup(tree, "GET", "/random/path")
    test.expect(Route.descriptor(catchAll!.route).path).toBe("/:path*")
  })

  test.it("static routes take priority over optional param routes", () => {
    const tree = RouteTree.make({
      "/files/:name?": Route.get(Route.text("files optional")),
      "/files/latest": Route.get(Route.text("files latest")),
    })

    const staticMatch = RouteTree.lookup(tree, "GET", "/files/latest")
    test.expect(Route.descriptor(staticMatch!.route).path).toBe("/files/latest")

    const optionalMatch = RouteTree.lookup(tree, "GET", "/files/other")
    test.expect(Route.descriptor(optionalMatch!.route).path).toBe(
      "/files/:name?",
    )
    test.expect(optionalMatch!.params).toEqual({ name: "other" })

    const noParam = RouteTree.lookup(tree, "GET", "/files")
    test.expect(Route.descriptor(noParam!.route).path).toBe("/files/:name?")
    test.expect(noParam!.params).toEqual({})
  })
})
