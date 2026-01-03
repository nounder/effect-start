import * as test from "bun:test"
import * as Route from "./Route.ts"
import * as RouteMatch from "./RouteMatch.ts"

test.describe(RouteMatch.match, () => {
  test.it("matches exact path", () => {
    const routes = Route
      .add("/about", Route.get(Route.text("About")))

    const result = RouteMatch.match(routes, { path: "/about" })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({})
  })

  test.it("returns null for non-matching path", () => {
    const routes = Route
      .add("/about", Route.get(Route.text("About")))

    const result = RouteMatch.match(routes, { path: "/contact" })

    test
      .expect(result)
      .toBeNull()
  })

  test.it("matches path with single param", () => {
    const routes = Route
      .add("/users/:id", Route.get(Route.text("User")))

    const result = RouteMatch.match(routes, { path: "/users/123" })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({ id: "123" })
  })

  test.it("matches path with multiple params", () => {
    const routes = Route
      .add("/users/:userId/posts/:postId", Route.get(Route.text("Post")))

    const result = RouteMatch.match(routes, { path: "/users/42/posts/7" })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({
        userId: "42",
        postId: "7",
      })
  })

  test.it("matches path with optional param present", () => {
    const routes = Route
      .add("/files/:name?", Route.get(Route.text("File")))

    const result = RouteMatch.match(routes, { path: "/files/readme" })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({ name: "readme" })
  })

  test.it("matches path with optional param absent", () => {
    const routes = Route
      .add("/files/:name?", Route.get(Route.text("File")))

    const result = RouteMatch.match(routes, { path: "/files" })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({})
  })

  test.it("matches path with wildcard param", () => {
    const routes = Route
      .add("/docs/:path*", Route.get(Route.text("Docs")))

    const result = RouteMatch.match(routes, {
      path: "/docs/api/users/create",
    })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({
        path: "api/users/create",
      })
  })

  test.it("matches static route over dynamic", () => {
    const routes = Route
      .add("/users/:id", Route.get(Route.text("User by ID")))
      .add("/users/me", Route.get(Route.text("Current user")))

    const result = RouteMatch.match(routes, { path: "/users/me" })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({})
  })

  test.it("matches dynamic route over wildcard", () => {
    const routes = Route
      .add("/files/:path*", Route.get(Route.text("Wildcard")))
      .add("/files/:name", Route.get(Route.text("Dynamic")))

    const result = RouteMatch.match(routes, { path: "/files/readme" })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({ name: "readme" })
  })

  test.it("matches static over dynamic over wildcard", () => {
    const routes = Route
      .add("/docs/:path*", Route.get(Route.text("Wildcard")))
      .add("/docs/:section", Route.get(Route.text("Dynamic")))
      .add("/docs/api", Route.get(Route.text("Static")))

    const result = RouteMatch.match(routes, { path: "/docs/api" })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({})
  })

  test.it("matches more specific static path", () => {
    const routes = Route
      .add("/api/:resource/:id", Route.get(Route.text("Generic")))
      .add("/api/users/:id", Route.get(Route.text("Users")))

    const result = RouteMatch.match(routes, { path: "/api/users/123" })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({ id: "123" })
  })

  test.it("priority works regardless of route order", () => {
    const routes = Route
      .add("/items/special", Route.get(Route.text("Static")))
      .add("/items/:id", Route.get(Route.text("Dynamic")))
      .add("/items/:path*", Route.get(Route.text("Wildcard")))

    const result = RouteMatch.match(routes, { path: "/items/special" })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({})
  })

  test.it("wildcard still matches when no other option", () => {
    const routes = Route
      .add("/files/readme", Route.get(Route.text("Static")))
      .add("/files/:path*", Route.get(Route.text("Wildcard")))

    const result = RouteMatch.match(routes, { path: "/files/docs/api/intro" })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({ path: "docs/api/intro" })
  })

  test.it("matches nested mounted routes", () => {
    const routes = Route
      .add(
        "/admin",
        Route
          .add("/users", Route.get(Route.text("Admin users")))
          .add("/settings", Route.get(Route.text("Admin settings"))),
      )

    const result = RouteMatch.match(routes, { path: "/admin/users" })

    test
      .expect(result)
      .not
      .toBeNull()
  })

  test.it("normalizes paths with trailing slashes", () => {
    const routes = Route
      .add("/about", Route.get(Route.text("About")))

    const result = RouteMatch.match(routes, { path: "/about/" })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({})
  })

  test.it("matches root path", () => {
    const routes = Route
      .add("/", Route.get(Route.text("Home")))

    const result = RouteMatch.match(routes, { path: "/" })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({})
  })
})

test.describe(RouteMatch.matchRequest, () => {
  test.it("matches request path", () => {
    const routes = Route
      .add("/users/:id", Route.get(Route.text("User")))

    const request = new Request("http://localhost/users/456")
    const result = RouteMatch.matchRequest(routes, request)

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.params)
      .toEqual({ id: "456" })
  })

  test.it("ignores query string in matching", () => {
    const routes = Route
      .add("/search", Route.get(Route.text("Search")))

    const request = new Request("http://localhost/search?q=hello")
    const result = RouteMatch.matchRequest(routes, request)

    test
      .expect(result)
      .not
      .toBeNull()
  })
})

test.describe("Content Negotiation", () => {
  test.it("returns text route when Accept prefers text/plain", () => {
    const routes = Route
      .add(
        "/page",
        Route.get(
          Route.text("Plain text"),
          Route.html("<p>HTML</p>"),
        ),
      )

    const result = RouteMatch.match(routes, {
      path: "/page",
      headers: { accept: "text/plain" },
    })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.route[Route.RouteDescriptor])
      .toEqual({ format: "text" })
  })

  test.it("returns html route when Accept prefers text/html", () => {
    const routes = Route
      .add(
        "/page",
        Route.get(
          Route.text("Plain text"),
          Route.html("<p>HTML</p>"),
        ),
      )

    const result = RouteMatch.match(routes, {
      path: "/page",
      headers: { accept: "text/html" },
    })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.route[Route.RouteDescriptor])
      .toEqual({ format: "html" })
  })

  test.it("returns first matching route when no Accept header", () => {
    const routes = Route
      .add(
        "/page",
        Route.get(
          Route.text("Plain text"),
          Route.html("<p>HTML</p>"),
        ),
      )

    const result = RouteMatch.match(routes, {
      path: "/page",
    })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.route[Route.RouteDescriptor])
      .toEqual({ format: "text" })
  })

  test.it("returns first matching route when Accept is */*", () => {
    const routes = Route
      .add(
        "/page",
        Route.get(
          Route.text("Plain text"),
          Route.html("<p>HTML</p>"),
        ),
      )

    const result = RouteMatch.match(routes, {
      path: "/page",
      headers: { accept: "*/*" },
    })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.route[Route.RouteDescriptor])
      .toEqual({ format: "text" })
  })

  test.it("respects Accept quality values", () => {
    const routes = Route
      .add(
        "/page",
        Route.get(Route.text("Plain text"), Route.html("<p>HTML</p>")),
      )

    const result = RouteMatch.match(routes, {
      path: "/page",
      headers: { accept: "text/plain;q=0.5, text/html;q=0.9" },
    })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.route[Route.RouteDescriptor])
      .toEqual({ format: "html" })
  })

  test.it("returns json route when Accept prefers application/json", () => {
    const routes = Route
      .add(
        "/api/data",
        Route.get(
          Route.text("text"),
          Route.json({ data: "value" }),
        ),
      )

    const result = RouteMatch.match(routes, {
      path: "/api/data",
      headers: { accept: "application/json" },
    })

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.route[Route.RouteDescriptor])
      .toEqual({ format: "json" })
  })

  test.it("content negotiation works with matchRequest", () => {
    const routes = Route
      .add(
        "/page",
        Route.get(
          Route.text("Plain text"),
          Route.html("<p>HTML</p>"),
        ),
      )

    const request = new Request("http://localhost/page", {
      headers: { accept: "text/html" },
    })
    const result = RouteMatch.matchRequest(routes, request)

    test
      .expect(result)
      .not
      .toBeNull()
    test
      .expect(result!.route[Route.RouteDescriptor])
      .toEqual({ format: "html" })
  })
})
