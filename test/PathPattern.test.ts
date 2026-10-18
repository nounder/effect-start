import * as test from "bun:test"
import * as PathPattern from "../src/internal/PathPattern.ts"

test.it("accepts supported runtime paths and rejects named catch-alls", () => {
  for (const path of ["/", "/users/:id", "/users/:id?", "/docs/*", "/用户/file.txt"]) {
    test
      .expect(PathPattern.validate(path).ok)
      .toBe(true)
  }
  for (
    const path of [
      "users",
      "/files/:path*",
      "/files/:path+",
      "/foo/*/bar",
      "/:",
      "/foo bar",
      "/:id/:id",
      "/:id(\\d+)",
      "/users/:id?/edit",
      "/users/:id?/posts/:postId?",
      "/users/:id?/*",
    ]
  ) {
    test
      .expect(PathPattern.validate(path).ok)
      .toBe(false)
  }
})

test.it("infers wildcard and optional parameter types", () => {
  test
    .expectTypeOf<PathPattern.Params<"/users/:id/files/*">>()
    .toEqualTypeOf<{ id: string } & { "*"?: string }>()
  test
    .expectTypeOf<PathPattern.Params<"/users/:id?">>()
    .toEqualTypeOf<{ id?: string }>()
  test
    .expectTypeOf<PathPattern.Params<"/users">>()
    .toEqualTypeOf<{}>()
  test
    .expect(PathPattern.params("/users/:id/files/*"))
    .toEqual([
      { name: "id", optional: false },
      { name: "*", optional: true },
    ])
})

test.it.each(
  [
    ["/users", "/users", {}],
    ["/users", "/posts", null],
    ["/users/:id", "/users/42", { id: "42" }],
    ["/users/:id", "/Users/42", null],
    ["/users/:id", "/users//42/", { id: "42" }],
    ["/users/:id?", "/users", {}],
    ["/users/:id?", "/users/42", { id: "42" }],
    ["/users/:id?/edit", "/users/edit", null],
    ["/users/:id?/edit", "/users/42/edit", null],
    ["/docs/*", "/docs", {}],
    ["/docs/*", "/docs/", {}],
    ["/docs/*", "/docs/a/b", { "*": "a/b" }],
    ["/*", "/", {}],
    ["/*", "/a/b", { "*": "a/b" }],
    ["/café/:id", "/caf%C3%A9/hello%20world", { id: "hello world" }],
    ["/users/:id", "/users/a%2Fb", { id: "a/b" }],
    ["/users/:id", "/users/%2520", { id: "%20" }],
    ["/docs/*", "/docs/a%20b/c%25d", { "*": "a b/c%d" }],
    ["/users/:id", "/users/%GG", null],
    ["/users/:id", "/users/%E0%A4%A", null],
    ["/docs/*", "/docs/%", null],
    ["/users/:id", `/users/${"a".repeat(200)}`, { id: "a".repeat(200) }],
  ] as const,
)("matches %s against %s", (pattern, path, params) => {
  test
    .expect(PathPattern.match(pattern, path))
    .toEqual(params)
})

test.it("prioritizes static segments before parameters and wildcards", () => {
  const paths = ["/*", "/:section/bar", "/foo/:id", "/foo/*", "/foo", "/foo/:id?"]

  test
    .expect(paths.sort(PathPattern.compare))
    .toEqual([
      "/foo",
      "/foo/:id",
      "/foo/:id?",
      "/foo/*",
      "/:section/bar",
      "/*",
    ])
})
