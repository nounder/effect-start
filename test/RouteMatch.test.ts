import * as test from "bun:test"
import * as Route from "effect-start/Route"
import * as RouteMatch from "effect-start/RouteMatch"
import * as RouteMap from "effect-start/RouteMap"

test.describe("layer route", () => {
  test.it("match finds LayerRoute first", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "*": Route.use(Route.filter({ context: { layer: true } })),
        "/users": Route.get(Route.text("users")),
      }),
    )

    const result = RouteMatch.match(matcher, "GET", "/users")

    test.expect(result).not.toBeNull()
    test.expect(Route.descriptor(result!.route).method).toBe("*")
  })
})

test.describe("nested trees", () => {
  test.it("match works with nested trees", () => {
    const apiTree = Route.map({
      "/users": Route.get(Route.json({ users: [] })),
      "/users/:id": Route.get(Route.json({ user: null })),
    })

    const matcher = RouteMatch.make(
      Route.map({
        "/": Route.get(Route.text("home")),
        "/api": apiTree,
      }),
    )

    const home = RouteMatch.match(matcher, "GET", "/")

    test.expect(Route.descriptor(home!.route).path).toBe("/")

    const users = RouteMatch.match(matcher, "GET", "/api/users")

    test.expect(Route.descriptor(users!.route).path).toBe("/api/users")

    const user = RouteMatch.match(matcher, "GET", "/api/users/123")

    test.expect(Route.descriptor(user!.route).path).toBe("/api/users/:id")
    test.expect(user!.params).toEqual({ id: "123" })
  })
})

test.describe(RouteMatch.match, () => {
  test.it("matches static paths", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/users": Route.get(Route.text("users list")),
        "/admin": Route.get(Route.text("admin")),
      }),
    )

    const result = RouteMatch.match(matcher, "GET", "/users")

    test.expect(result).not.toBeNull()
    test.expect(result!.params).toEqual({})
    test.expect(Route.descriptor(result!.route).path).toBe("/users")
  })

  test.it("extracts path parameters", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/users/:id": Route.get(Route.text("user detail")),
      }),
    )

    const result = RouteMatch.match(matcher, "GET", "/users/123")

    test.expect(result).not.toBeNull()
    test.expect(result!.params).toEqual({ id: "123" })
  })

  test.it("filters by HTTP method", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/users": Route.get(Route.text("get users")),
        "/admin": Route.post(Route.text("post admin")),
      }),
    )

    const getResult = RouteMatch.match(matcher, "GET", "/users")

    test.expect(getResult).not.toBeNull()

    const postOnGet = RouteMatch.match(matcher, "POST", "/users")

    test.expect(postOnGet).toBeNull()

    const postResult = RouteMatch.match(matcher, "POST", "/admin")

    test.expect(postResult).not.toBeNull()
  })

  test.it("wildcard method matches any method", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/api": Route.use(Route.filter({ context: { api: true } })),
      }),
    )

    const getResult = RouteMatch.match(matcher, "GET", "/api")

    test.expect(getResult).not.toBeNull()

    const postResult = RouteMatch.match(matcher, "POST", "/api")

    test.expect(postResult).not.toBeNull()

    const deleteResult = RouteMatch.match(matcher, "DELETE", "/api")

    test.expect(deleteResult).not.toBeNull()
  })

  test.it("static routes take priority over param routes", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/users/:id": Route.get(Route.text("user by id")),
        "/users/me": Route.get(Route.text("current user")),
      }),
    )

    const result = RouteMatch.match(matcher, "GET", "/users/me")

    test.expect(result).not.toBeNull()
    test.expect(Route.descriptor(result!.route).path).toBe("/users/me")
    test.expect(result!.params).toEqual({})
  })

  test.it("matches greedy params with +", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/docs/:path+": Route.get(Route.text("docs")),
      }),
    )

    const result = RouteMatch.match(matcher, "GET", "/docs/api/v1/users")

    test.expect(result).not.toBeNull()
    test.expect(result!.params).toEqual({ path: "api/v1/users" })

    const noMatch = RouteMatch.match(matcher, "GET", "/docs")

    test.expect(noMatch).toBeNull()
  })

  test.it("matches greedy params with *", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/files/:path*": Route.get(Route.text("files")),
      }),
    )

    const withPath = RouteMatch.match(matcher, "GET", "/files/a/b/c")

    test.expect(withPath).not.toBeNull()
    test.expect(withPath!.params).toEqual({ path: "a/b/c" })

    const withoutPath = RouteMatch.match(matcher, "GET", "/files")

    test.expect(withoutPath).not.toBeNull()
    test.expect(withoutPath!.params).toEqual({})
  })

  test.it("returns null for no match", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/users": Route.get(Route.text("users")),
      }),
    )

    const result = RouteMatch.match(matcher, "GET", "/not-found")

    test.expect(result).toBeNull()
  })

  test.it("matches optional params with ?", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/files/:name?": Route.get(Route.text("files")),
      }),
    )

    const withParam = RouteMatch.match(matcher, "GET", "/files/readme")

    test.expect(withParam).not.toBeNull()
    test.expect(withParam!.params).toEqual({ name: "readme" })

    const withoutParam = RouteMatch.match(matcher, "GET", "/files")

    test.expect(withoutParam).not.toBeNull()
    test.expect(withoutParam!.params).toEqual({})
  })

  test.it("respects route priority for complex trees", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/:path*": Route.get(Route.text("catch all")),
        "/api/:rest+": Route.get(Route.text("api wildcard")),
        "/api/users": Route.get(Route.text("api users")),
        "/api/users/:id": Route.get(Route.text("api user detail")),
      }),
    )

    const staticMatch = RouteMatch.match(matcher, "GET", "/api/users")

    test.expect(Route.descriptor(staticMatch!.route).path).toBe("/api/users")

    const paramMatch = RouteMatch.match(matcher, "GET", "/api/users/123")

    test.expect(Route.descriptor(paramMatch!.route).path).toBe("/api/users/:id")
    test.expect(paramMatch!.params).toEqual({ id: "123" })

    const greedyMatch = RouteMatch.match(matcher, "GET", "/api/something/else")

    test.expect(Route.descriptor(greedyMatch!.route).path).toBe("/api/:rest+")
    test.expect(greedyMatch!.params).toEqual({ rest: "something/else" })

    const catchAll = RouteMatch.match(matcher, "GET", "/random/path")

    test.expect(Route.descriptor(catchAll!.route).path).toBe("/:path*")
  })

  test.it("static routes take priority over optional param routes", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/files/:name?": Route.get(Route.text("files optional")),
        "/files/latest": Route.get(Route.text("files latest")),
      }),
    )

    const staticMatch = RouteMatch.match(matcher, "GET", "/files/latest")

    test.expect(Route.descriptor(staticMatch!.route).path).toBe("/files/latest")

    const optionalMatch = RouteMatch.match(matcher, "GET", "/files/other")

    test.expect(Route.descriptor(optionalMatch!.route).path).toBe("/files/:name?")
    test.expect(optionalMatch!.params).toEqual({ name: "other" })

    const noParam = RouteMatch.match(matcher, "GET", "/files")

    test.expect(Route.descriptor(noParam!.route).path).toBe("/files/:name?")
    test.expect(noParam!.params).toEqual({})
  })

  test.it("handles dots in path segments", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/api/v1.0/users": Route.get(Route.text("users")),
      }),
    )

    const result = RouteMatch.match(matcher, "GET", "/api/v1.0/users")

    test.expect(result).not.toBeNull()
    test.expect(result!.params).toEqual({})
  })

  test.it("does not match dots as regex wildcards", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/a.b": Route.get(Route.text("dotted")),
      }),
    )

    test.expect(RouteMatch.match(matcher, "GET", "/a.b")).not.toBeNull()
    test.expect(RouteMatch.match(matcher, "GET", "/aXb")).toBeNull()
  })

  test.it("handles trailing slashes", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/users": Route.get(Route.text("users")),
      }),
    )

    test.expect(RouteMatch.match(matcher, "GET", "/users/")).not.toBeNull()
    test.expect(RouteMatch.match(matcher, "GET", "/users///")).not.toBeNull()
  })

  test.it("multiple params in one path", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/users/:userId/posts/:postId": Route.get(Route.text("post")),
      }),
    )

    const result = RouteMatch.match(matcher, "GET", "/users/42/posts/99")

    test.expect(result).not.toBeNull()
    test.expect(result!.params).toEqual({ userId: "42", postId: "99" })
  })

  test.it("same path different methods", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/users": Route.get(Route.text("get users")).post(Route.text("create user")),
      }),
    )

    const getResult = RouteMatch.match(matcher, "GET", "/users")

    test.expect(getResult).not.toBeNull()
    test.expect(Route.descriptor(getResult!.route).method).toBe("GET")

    const postResult = RouteMatch.match(matcher, "POST", "/users")

    test.expect(postResult).not.toBeNull()
    test.expect(Route.descriptor(postResult!.route).method).toBe("POST")

    test.expect(RouteMatch.match(matcher, "DELETE", "/users")).toBeNull()
  })

  test.it("root path matches", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/": Route.get(Route.text("home")),
      }),
    )

    test.expect(RouteMatch.match(matcher, "GET", "/")).not.toBeNull()
  })

  test.it("match works after merge", () => {
    const a = Route.map({
      "/users": Route.get(Route.text("users")),
    })
    const b = Route.map({
      "/posts": Route.get(Route.text("posts")),
    })
    const matcher = RouteMatch.make(RouteMap.merge(a, b))

    test.expect(RouteMatch.match(matcher, "GET", "/users")).not.toBeNull()
    test.expect(RouteMatch.match(matcher, "GET", "/posts")).not.toBeNull()
    test.expect(RouteMatch.match(matcher, "GET", "/other")).toBeNull()
  })

  test.it("param values with special characters", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/files/:name": Route.get(Route.text("file")),
      }),
    )

    const result = RouteMatch.match(matcher, "GET", "/files/my-file_v2.txt")

    test.expect(result).not.toBeNull()
    test.expect(result!.params).toEqual({ name: "my-file_v2.txt" })
  })

  test.it("greedy param captures slashes", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/api/:rest+": Route.get(Route.text("api")),
      }),
    )

    const result = RouteMatch.match(matcher, "GET", "/api/a/b/c")

    test.expect(result!.params).toEqual({ rest: "a/b/c" })
  })

  test.it("literal-prefix greedy route takes priority over param route", () => {
    const matcher = RouteMatch.make(
      Route.map({
        "/:owner": Route.get(Route.text("owner")),
        "/pages/:path*": Route.get(Route.text("pages")),
      }),
    )

    const match = RouteMatch.match(matcher, "GET", "/pages")

    test.expect(match).not.toBeNull()
    test.expect(Route.descriptor(match!.route).path).toBe("/pages/:path*")
    test.expect(match!.params).toEqual({})

    const matchWithPath = RouteMatch.match(matcher, "GET", "/pages/app.js")

    test.expect(matchWithPath).not.toBeNull()
    test.expect(Route.descriptor(matchWithPath!.route).path).toBe("/pages/:path*")
    test.expect(matchWithPath!.params).toEqual({ path: "app.js" })

    const owner = RouteMatch.match(matcher, "GET", "/someone")

    test.expect(owner).not.toBeNull()
    test.expect(Route.descriptor(owner!.route).path).toBe("/:owner")
    test.expect(owner!.params).toEqual({ owner: "someone" })
  })
})
