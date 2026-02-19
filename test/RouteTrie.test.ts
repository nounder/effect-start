import * as test from "bun:test"
import * as Route from "effect-start/Route"
import * as RouteMount from "effect-start/RouteMount"
import * as RouteTrie from "effect-start/RouteTrie"

test.describe(RouteTrie.make, () => {
  test.it("creates trie from route set", () => {
    const routes = Route.add("/about", Route.get(Route.text("About")))

    const trie = RouteTrie.make(routes)

    test.expect(trie.methods["GET"]).toBeDefined()
  })
})

test.describe(RouteTrie.lookup, () => {
  test.it("matches exact static path", () => {
    const routes = Route.add("/about", Route.get(Route.text("About")))
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/about")

    test.expect(results.length).toBe(1)
    test.expect(results[0].params).toEqual({})
  })

  test.it("returns empty for non-matching path", () => {
    const routes = Route.add("/about", Route.get(Route.text("About")))
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/contact")

    test.expect(results.length).toBe(0)
  })

  test.it("matches path with single param", () => {
    const routes = Route.add("/users/:id", Route.get(Route.text("User")))
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/users/123")

    test.expect(results.length).toBe(1)
    test.expect(results[0].params).toEqual({ id: "123" })
  })

  test.it("matches path with multiple params", () => {
    const routes = Route.add("/users/:userId/posts/:postId", Route.get(Route.text("Post")))
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/users/42/posts/7")

    test.expect(results.length).toBe(1)
    test.expect(results[0].params).toEqual({
      userId: "42",
      postId: "7",
    })
  })

  test.it("matches path with optional param present", () => {
    const routes = Route.add("/files/:name?", Route.get(Route.text("File")))
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/files/readme")

    test.expect(results.length).toBe(1)
    test.expect(results[0].params).toEqual({ name: "readme" })
  })

  test.it("matches path with optional param absent", () => {
    const routes = Route.add("/files/:name?", Route.get(Route.text("File")))
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/files")

    test.expect(results.length).toBe(1)
    test.expect(results[0].params).toEqual({})
  })

  test.it("matches path with optional wildcard param", () => {
    const routes = Route.add("/docs/:path*", Route.get(Route.text("Docs")))
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/docs/api/users/create")

    test.expect(results.length).toBe(1)
    test.expect(results[0].params).toEqual({
      path: "api/users/create",
    })
  })

  test.it("matches path with optional wildcard when empty", () => {
    const routes = Route.add("/docs/:path*", Route.get(Route.text("Docs")))
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/docs")

    test.expect(results.length).toBe(1)
    test.expect(results[0].params).toEqual({})
  })

  test.it("matches path with required wildcard param", () => {
    const routes = Route.add("/docs/:path+", Route.get(Route.text("Docs")))
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/docs/api/users/create")

    test.expect(results.length).toBe(1)
    test.expect(results[0].params).toEqual({
      path: "api/users/create",
    })
  })

  test.it("does not match required wildcard when empty", () => {
    const routes = Route.add("/docs/:path+", Route.get(Route.text("Docs")))
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/docs")

    test.expect(results.length).toBe(0)
  })

  test.it("required wildcard beats optional wildcard in priority", () => {
    const routes = Route.add("/files/:path*", Route.get(Route.text("Optional"))).add(
      "/files/:path+",
      Route.get(Route.text("Required")),
    )
    const trie = RouteTrie.make(routes)

    const multiResults = RouteTrie.lookup(trie, "GET", "/files/a/b/c")

    test.expect(multiResults.length).toBe(2)
    test.expect(multiResults[0].params).toEqual({ path: "a/b/c" })
    test.expect(multiResults[1].params).toEqual({ path: "a/b/c" })
  })

  test.it("optional wildcard matches when required cannot", () => {
    const routes = Route.add("/files/:path*", Route.get(Route.text("Optional"))).add(
      "/files/:path+",
      Route.get(Route.text("Required")),
    )
    const trie = RouteTrie.make(routes)

    const emptyResults = RouteTrie.lookup(trie, "GET", "/files")

    test.expect(emptyResults.length).toBe(1)
    test.expect(emptyResults[0].params).toEqual({})
  })

  test.it("prioritizes static over param routes", () => {
    const routes = Route.add("/users/:id", Route.get(Route.text("User by ID"))).add(
      "/users/me",
      Route.get(Route.text("Current user")),
    )
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/users/me")

    test.expect(results.length).toBe(2)
    test.expect(results[0].params).toEqual({})
    test.expect(results[1].params).toEqual({ id: "me" })
  })

  test.it("matches nested mounted routes", () => {
    const routes = Route.add(
      "/admin",
      Route.add("/users", Route.get(Route.text("Admin users"))).add(
        "/settings",
        Route.get(Route.text("Admin settings")),
      ),
    )
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/admin/users")

    test.expect(results.length).toBe(1)
  })

  test.it("normalizes paths with trailing slashes", () => {
    const routes = Route.add("/about", Route.get(Route.text("About")))
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/about/")

    test.expect(results.length).toBe(1)
    test.expect(results[0].params).toEqual({})
  })

  test.it("matches root path", () => {
    const routes = Route.add("/", Route.get(Route.text("Home")))
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/")

    test.expect(results.length).toBe(1)
    test.expect(results[0].params).toEqual({})
  })

  test.it("matches method-specific routes", () => {
    const routes = Route.add("/users", Route.get(Route.text("List users"))).add(
      "/users",
      Route.post(Route.text("Create user")),
    )
    const trie = RouteTrie.make(routes)

    const getResults = RouteTrie.lookup(trie, "GET", "/users")
    const postResults = RouteTrie.lookup(trie, "POST", "/users")

    test.expect(getResults.length).toBe(1)
    test.expect(postResults.length).toBe(1)
  })

  test.it("matches wildcard method routes", () => {
    const routes = Route.add("/health", Route.use(Route.text("OK")))
    const trie = RouteTrie.make(routes)

    const getResults = RouteTrie.lookup(trie, "GET", "/health")
    const postResults = RouteTrie.lookup(trie, "POST", "/health")

    test.expect(getResults.length).toBe(1)
    test.expect(postResults.length).toBe(1)
  })

  test.it("returns multiple matches for content negotiation", () => {
    const routes = Route.add(
      "/page",
      Route.get(Route.text("Plain text"), Route.html("<p>HTML</p>")),
    )
    const trie = RouteTrie.make(routes)

    const results = RouteTrie.lookup(trie, "GET", "/page")

    test.expect(results.length).toBe(2)
  })
})
