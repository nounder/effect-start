import * as test from "bun:test"
import * as Route from "./Route.ts"
import * as RouteTree from "./RouteTree.ts"

test.describe(RouteTree.make, () => {
  test.it("creates tree from route set", () => {
    const routes = Route
      .add("/about", Route.get(Route.text("About")))

    const tree = RouteTree.make(routes)

    test
      .expect(tree.methods["GET"])
      .toBeDefined()
  })
})

test.describe(RouteTree.lookup, () => {
  test.it("matches exact static path", () => {
    const routes = Route
      .add("/about", Route.get(Route.text("About")))
    const tree = RouteTree.make(routes)

    const results = RouteTree.lookup(tree, "GET", "/about")

    test
      .expect(results.length)
      .toBe(1)
    test
      .expect(results[0].params)
      .toEqual({})
  })

  test.it("returns empty for non-matching path", () => {
    const routes = Route
      .add("/about", Route.get(Route.text("About")))
    const tree = RouteTree.make(routes)

    const results = RouteTree.lookup(tree, "GET", "/contact")

    test
      .expect(results.length)
      .toBe(0)
  })

  test.it("matches path with single param", () => {
    const routes = Route
      .add("/users/:id", Route.get(Route.text("User")))
    const tree = RouteTree.make(routes)

    const results = RouteTree.lookup(tree, "GET", "/users/123")

    test
      .expect(results.length)
      .toBe(1)
    test
      .expect(results[0].params)
      .toEqual({ id: "123" })
  })

  test.it("matches path with multiple params", () => {
    const routes = Route
      .add("/users/:userId/posts/:postId", Route.get(Route.text("Post")))
    const tree = RouteTree.make(routes)

    const results = RouteTree.lookup(tree, "GET", "/users/42/posts/7")

    test
      .expect(results.length)
      .toBe(1)
    test
      .expect(results[0].params)
      .toEqual({
        userId: "42",
        postId: "7",
      })
  })

  test.it("matches path with optional param present", () => {
    const routes = Route
      .add("/files/:name?", Route.get(Route.text("File")))
    const tree = RouteTree.make(routes)

    const results = RouteTree.lookup(tree, "GET", "/files/readme")

    test
      .expect(results.length)
      .toBe(1)
    test
      .expect(results[0].params)
      .toEqual({ name: "readme" })
  })

  test.it("matches path with optional param absent", () => {
    const routes = Route
      .add("/files/:name?", Route.get(Route.text("File")))
    const tree = RouteTree.make(routes)

    const results = RouteTree.lookup(tree, "GET", "/files")

    test
      .expect(results.length)
      .toBe(1)
    test
      .expect(results[0].params)
      .toEqual({})
  })

  test.it("matches path with wildcard param", () => {
    const routes = Route
      .add("/docs/:path*", Route.get(Route.text("Docs")))
    const tree = RouteTree.make(routes)

    const results = RouteTree.lookup(tree, "GET", "/docs/api/users/create")

    test
      .expect(results.length)
      .toBe(1)
    test
      .expect(results[0].params)
      .toEqual({
        path: "api/users/create",
      })
  })

  test.it("prioritizes static over param routes", () => {
    const routes = Route
      .add("/users/:id", Route.get(Route.text("User by ID")))
      .add("/users/me", Route.get(Route.text("Current user")))
    const tree = RouteTree.make(routes)

    const results = RouteTree.lookup(tree, "GET", "/users/me")

    test
      .expect(results.length)
      .toBe(2)
    test
      .expect(results[0].params)
      .toEqual({})
    test
      .expect(results[1].params)
      .toEqual({ id: "me" })
  })

  test.it("matches nested mounted routes", () => {
    const routes = Route
      .add(
        "/admin",
        Route
          .add("/users", Route.get(Route.text("Admin users")))
          .add("/settings", Route.get(Route.text("Admin settings"))),
      )
    const tree = RouteTree.make(routes)

    const results = RouteTree.lookup(tree, "GET", "/admin/users")

    test
      .expect(results.length)
      .toBe(1)
  })

  test.it("normalizes paths with trailing slashes", () => {
    const routes = Route
      .add("/about", Route.get(Route.text("About")))
    const tree = RouteTree.make(routes)

    const results = RouteTree.lookup(tree, "GET", "/about/")

    test
      .expect(results.length)
      .toBe(1)
    test
      .expect(results[0].params)
      .toEqual({})
  })

  test.it("matches root path", () => {
    const routes = Route
      .add("/", Route.get(Route.text("Home")))
    const tree = RouteTree.make(routes)

    const results = RouteTree.lookup(tree, "GET", "/")

    test
      .expect(results.length)
      .toBe(1)
    test
      .expect(results[0].params)
      .toEqual({})
  })

  test.it("matches method-specific routes", () => {
    const routes = Route
      .add("/users", Route.get(Route.text("List users")))
      .add("/users", Route.post(Route.text("Create user")))
    const tree = RouteTree.make(routes)

    const getResults = RouteTree.lookup(tree, "GET", "/users")
    const postResults = RouteTree.lookup(tree, "POST", "/users")

    test
      .expect(getResults.length)
      .toBe(1)
    test
      .expect(postResults.length)
      .toBe(1)
  })

  test.it("matches wildcard method routes", () => {
    const routes = Route
      .add("/health", Route.use(Route.text("OK")))
    const tree = RouteTree.make(routes)

    const getResults = RouteTree.lookup(tree, "GET", "/health")
    const postResults = RouteTree.lookup(tree, "POST", "/health")

    test
      .expect(getResults.length)
      .toBe(1)
    test
      .expect(postResults.length)
      .toBe(1)
  })

  test.it("returns multiple matches for content negotiation", () => {
    const routes = Route
      .add(
        "/page",
        Route.get(
          Route.text("Plain text"),
          Route.html("<p>HTML</p>"),
        ),
      )
    const tree = RouteTree.make(routes)

    const results = RouteTree.lookup(tree, "GET", "/page")

    test
      .expect(results.length)
      .toBe(2)
  })
})
