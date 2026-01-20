import * as test from "bun:test"
import * as Route from "./Route.ts"
import * as RouteMatch from "./RouteMatch.ts"

test.describe(RouteMatch.match, () => {
  test.it("matches exact static path", () => {
    const routes = Route.add("/about", Route.get(Route.text("About")))

    const result = RouteMatch.match(routes, { path: "/about" })

    test
      .expect(result?.params)
      .toEqual({})
  })

  test.it("returns null for unmatched path", () => {
    const routes = Route.add("/about", Route.get(Route.text("About")))

    const result = RouteMatch.match(routes, { path: "/contact" })

    test
      .expect(result)
      .toBeNull()
  })

  test.it("matches root path", () => {
    const routes = Route.add("/", Route.get(Route.text("Home")))

    const result = RouteMatch.match(routes, { path: "/" })

    test
      .expect(result?.params)
      .toEqual({})
  })

  test.it("normalizes trailing slashes", () => {
    const routes = Route.add("/about", Route.get(Route.text("About")))

    const result = RouteMatch.match(routes, { path: "/about/" })

    test
      .expect(result?.params)
      .toEqual({})
  })

  test.it("extracts required params", () => {
    const routes = Route.add(
      "/users/:userId/posts/:postId",
      Route.get(Route.text("Post")),
    )

    const result = RouteMatch.match(routes, {
      path: "/users/42/posts/7",
    })

    test
      .expect(result!.params)
      .toEqual({ userId: "42", postId: "7" })
  })

  test.it("extracts optional param when present", () => {
    const routes = Route.add("/files/:name?", Route.get(Route.text("File")))

    const result = RouteMatch.match(routes, {
      path: "/files/readme",
    })

    test
      .expect(result!.params)
      .toEqual({ name: "readme" })
  })

  test.it("omits optional param when absent", () => {
    const routes = Route.add("/files/:name?", Route.get(Route.text("File")))

    const result = RouteMatch.match(routes, { path: "/files" })

    test
      .expect(result!.params)
      .toEqual({})
  })

  test.it("extracts optional wildcard param as joined path", () => {
    const routes = Route.add("/docs/:path*", Route.get(Route.text("Docs")))

    const result = RouteMatch.match(routes, {
      path: "/docs/api/users/create",
    })

    test
      .expect(result!.params)
      .toEqual({ path: "api/users/create" })
  })

  test.it("matches optional wildcard when path is empty", () => {
    const routes = Route.add("/docs/:path*", Route.get(Route.text("Docs")))

    const result = RouteMatch.match(routes, {
      path: "/docs",
    })

    test
      .expect(result!.params)
      .toEqual({})
  })

  test.it("extracts required wildcard param as joined path", () => {
    const routes = Route.add("/docs/:path+", Route.get(Route.text("Docs")))

    const result = RouteMatch.match(routes, {
      path: "/docs/api/users/create",
    })

    test
      .expect(result!.params)
      .toEqual({ path: "api/users/create" })
  })

  test.it("does not match required wildcard when path is empty", () => {
    const routes = Route.add("/docs/:path+", Route.get(Route.text("Docs")))

    const result = RouteMatch.match(routes, {
      path: "/docs",
    })

    test
      .expect(result)
      .toBeNull()
  })

  test.it("static > dynamic > required wildcard > optional wildcard priority", () => {
    const routes = Route
      .add("/items/:path*", Route.get(Route.text("OptionalWildcard")))
      .add("/items/:path+", Route.get(Route.text("RequiredWildcard")))
      .add("/items/:id", Route.get(Route.text("Dynamic")))
      .add("/items/special", Route.get(Route.text("Static")))

    const staticMatch = RouteMatch.match(routes, {
      path: "/items/special",
    })
    const dynamicMatch = RouteMatch.match(routes, {
      path: "/items/123",
    })
    const requiredWildcardMatch = RouteMatch.match(routes, {
      path: "/items/a/b/c",
    })
    const optionalWildcardMatch = RouteMatch.match(routes, {
      path: "/items",
    })

    test
      .expect(staticMatch!.params)
      .toEqual({})
    test
      .expect(dynamicMatch!.params)
      .toEqual({ id: "123" })
    test
      .expect(requiredWildcardMatch!.params)
      .toEqual({ path: "a/b/c" })
    test
      .expect(optionalWildcardMatch!.params)
      .toEqual({})
  })

  test.it("required wildcard beats optional wildcard for multi-segment paths", () => {
    const routes = Route
      .add("/files/:path*", Route.get(Route.text("Optional")))
      .add("/files/:path+", Route.get(Route.text("Required")))

    const multiSegmentMatch = RouteMatch.match(routes, {
      path: "/files/a/b/c",
    })

    test
      .expect(multiSegmentMatch!.params)
      .toEqual({ path: "a/b/c" })
  })

  test.it("optional wildcard matches when required cannot", () => {
    const routes = Route
      .add("/files/:path*", Route.get(Route.text("Optional")))
      .add("/files/:path+", Route.get(Route.text("Required")))

    const emptyMatch = RouteMatch.match(routes, {
      path: "/files",
    })

    test
      .expect(emptyMatch!.params)
      .toEqual({})
  })

  test.it("more static segments wins", () => {
    const routes = Route
      .add("/api/:resource/:id", Route.get(Route.text("Generic")))
      .add("/api/users/:id", Route.get(Route.text("Users")))

    const result = RouteMatch.match(routes, {
      path: "/api/users/123",
    })

    test
      .expect(result!.params)
      .toEqual({ id: "123" })
  })

  test.it("matches nested mounted paths", () => {
    const routes = Route.add(
      "/admin",
      Route
        .add("/users", Route.get(Route.text("Admin users")))
        .add("/settings", Route.get(Route.text("Admin settings"))),
    )

    const usersMatch = RouteMatch.match(routes, {
      path: "/admin/users",
    })
    const settingsMatch = RouteMatch.match(routes, {
      path: "/admin/settings",
    })

    test
      .expect(usersMatch?.params)
      .toEqual({})
    test
      .expect(settingsMatch?.params)
      .toEqual({})
  })
})

test.describe(RouteMatch.matchRequest, () => {
  test.it("extracts path from URL", () => {
    const routes = Route.add("/users/:id", Route.get(Route.text("User")))

    const request = new Request("http://localhost/users/456")
    const result = RouteMatch.matchRequest(routes, request)

    test
      .expect(result!.params)
      .toEqual({ id: "456" })
  })

  test.it("ignores query string", () => {
    const routes = Route.add("/search", Route.get(Route.text("Search")))

    const request = new Request("http://localhost/search?q=hello&limit=10")
    const result = RouteMatch.matchRequest(routes, request)

    test
      .expect(result?.params)
      .toEqual({})
  })
})

test.describe("content negotiation", () => {
  const multiFormatRoutes = Route.add(
    "/page",
    Route.get(
      Route.text("Plain text"),
      Route.html("<p>HTML</p>"),
      Route.json({ data: "value" }),
    ),
  )

  test.it("selects format by Accept header", () => {
    const textResult = RouteMatch.match(multiFormatRoutes, {
      path: "/page",
      headers: { accept: "text/plain" },
    })
    const htmlResult = RouteMatch.match(multiFormatRoutes, {
      path: "/page",
      headers: { accept: "text/html" },
    })
    const jsonResult = RouteMatch.match(multiFormatRoutes, {
      path: "/page",
      headers: { accept: "application/json" },
    })

    test
      .expect(Route.descriptor(textResult!.route))
      .toEqual({ format: "text" })
    test
      .expect(Route.descriptor(htmlResult!.route))
      .toEqual({ format: "html" })
    test
      .expect(Route.descriptor(jsonResult!.route))
      .toEqual({ format: "json" })
  })

  test.it("respects quality values", () => {
    const result = RouteMatch.match(multiFormatRoutes, {
      path: "/page",
      headers: { accept: "text/plain;q=0.5, text/html;q=0.9" },
    })

    test
      .expect(Route.descriptor(result!.route))
      .toEqual({ format: "html" })
  })

  test.it("returns first format when Accept is missing or */*", () => {
    const noAccept = RouteMatch.match(multiFormatRoutes, {
      path: "/page",
    })
    const wildcard = RouteMatch.match(multiFormatRoutes, {
      path: "/page",
      headers: { accept: "*/*" },
    })

    test
      .expect(Route.descriptor(noAccept!.route))
      .toEqual({ format: "text" })
    test
      .expect(Route.descriptor(wildcard!.route))
      .toEqual({ format: "text" })
  })

  test.it("works with matchRequest", () => {
    const request = new Request("http://localhost/page", {
      headers: { accept: "text/html" },
    })
    const result = RouteMatch.matchRequest(
      multiFormatRoutes,
      request,
    )

    test
      .expect(Route.descriptor(result!.route))
      .toEqual({ format: "html" })
  })
})
