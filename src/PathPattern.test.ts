import * as test from "bun:test"
import * as PathPattern from "./PathPattern.ts"

test.describe(PathPattern.parseSegment, () => {
  test.it("parses literal segments", () => {
    test
      .expect(PathPattern.parseSegment("users"))
      .toBe("users")
    test
      .expect(PathPattern.parseSegment("posts"))
      .toBe("posts")
    test
      .expect(PathPattern.parseSegment("my-page"))
      .toBe("my-page")
    test
      .expect(PathPattern.parseSegment("file.txt"))
      .toBe("file.txt")
  })

  test.it("parses unicode literal segments", () => {
    test
      .expect(PathPattern.parseSegment("用户"))
      .toBe("用户")
  })

  test.it("parses param segments", () => {
    test
      .expect(PathPattern.parseSegment(":id"))
      .toBe(":id")
    test
      .expect(PathPattern.parseSegment(":userId"))
      .toBe(":userId")
    test
      .expect(PathPattern.parseSegment(":post_id"))
      .toBe(":post_id")
  })

  test.it("parses optional param segments", () => {
    test
      .expect(PathPattern.parseSegment(":id?"))
      .toBe(":id?")
    test
      .expect(PathPattern.parseSegment(":slug?"))
      .toBe(":slug?")
  })

  test.it("parses optional wildcard segments", () => {
    test
      .expect(PathPattern.parseSegment(":path*"))
      .toBe(":path*")
    test
      .expect(PathPattern.parseSegment(":rest*"))
      .toBe(":rest*")
  })

  test.it("parses required wildcard segments", () => {
    test
      .expect(PathPattern.parseSegment(":path+"))
      .toBe(":path+")
    test
      .expect(PathPattern.parseSegment(":rest+"))
      .toBe(":rest+")
  })

  test.it("returns null for invalid segments", () => {
    test
      .expect(PathPattern.parseSegment(":"))
      .toBe(null)
    test
      .expect(PathPattern.parseSegment(":?"))
      .toBe(null)
    test
      .expect(PathPattern.parseSegment(":*"))
      .toBe(null)
    test
      .expect(PathPattern.parseSegment(":+"))
      .toBe(null)
    test
      .expect(PathPattern.parseSegment(""))
      .toBe(null)
    test
      .expect(PathPattern.parseSegment("foo bar"))
      .toBe(null)
  })
})

test.describe(PathPattern.parse, () => {
  test.it("parses simple paths", () => {
    test
      .expect(PathPattern.parse("/users"))
      .toEqual(["users"])
    test
      .expect(PathPattern.parse("/users/posts"))
      .toEqual(["users", "posts"])
  })

  test.it("parses paths with params", () => {
    test
      .expect(PathPattern.parse("/users/:id"))
      .toEqual(["users", ":id"])
    test
      .expect(PathPattern.parse("/users/:userId/posts/:postId"))
      .toEqual(["users", ":userId", "posts", ":postId"])
  })

  test.it("parses paths with optional params", () => {
    test
      .expect(PathPattern.parse("/users/:id?"))
      .toEqual(["users", ":id?"])
  })

  test.it("parses paths with optional wildcard", () => {
    test
      .expect(PathPattern.parse("/files/:path*"))
      .toEqual(["files", ":path*"])
  })

  test.it("parses paths with required wildcard", () => {
    test
      .expect(PathPattern.parse("/files/:path+"))
      .toEqual(["files", ":path+"])
  })

  test.it("parses root path", () => {
    test
      .expect(PathPattern.parse("/"))
      .toEqual([])
  })

  test.it("throws on invalid segments", () => {
    test
      .expect(() => PathPattern.parse("/foo bar"))
      .toThrow()
    test
      .expect(() => PathPattern.parse("/:"))
      .toThrow()
  })
})

test.describe(PathPattern.format, () => {
  test.it("formats segments back to path", () => {
    test
      .expect(PathPattern.format(["users"]))
      .toBe("/users")
    test
      .expect(PathPattern.format(["users", ":id"]))
      .toBe("/users/:id")
    test
      .expect(PathPattern.format(["users", ":id?"]))
      .toBe("/users/:id?")
    test
      .expect(PathPattern.format(["files", ":path*"]))
      .toBe("/files/:path*")
    test
      .expect(PathPattern.format(["files", ":path+"]))
      .toBe("/files/:path+")
    test
      .expect(PathPattern.format([]))
      .toBe("/")
  })
})

test.it("round trips", () => {
  const paths = [
    "/",
    "/users",
    "/users/:id",
    "/users/:id?",
    "/files/:path*",
    "/files/:path+",
    "/users/:userId/posts/:postId",
  ] as const
  for (const path of paths) {
    test
      .expect(PathPattern.format(PathPattern.parse(path)))
      .toBe(path)
  }
})

test.describe("Segments", () => {
  test.it("extracts literal segments", () => {
    test
      .expectTypeOf<PathPattern.Segments<"/users">>()
      .toEqualTypeOf<["users"]>()
    test
      .expectTypeOf<PathPattern.Segments<"/users/posts">>()
      .toEqualTypeOf<["users", "posts"]>()
  })

  test.it("extracts param segments", () => {
    test
      .expectTypeOf<PathPattern.Segments<"/users/:id">>()
      .toEqualTypeOf<["users", ":id"]>()
  })

  test.it("extracts optional param segments", () => {
    test
      .expectTypeOf<PathPattern.Segments<"/users/:id?">>()
      .toEqualTypeOf<["users", ":id?"]>()
  })

  test.it("extracts optional wildcard segments", () => {
    test
      .expectTypeOf<PathPattern.Segments<"/files/:path*">>()
      .toEqualTypeOf<["files", ":path*"]>()
  })

  test.it("extracts required wildcard segments", () => {
    test
      .expectTypeOf<PathPattern.Segments<"/files/:path+">>()
      .toEqualTypeOf<["files", ":path+"]>()
  })

  test.it("extracts complex paths", () => {
    test
      .expectTypeOf<PathPattern.Segments<"/users/:userId/posts/:postId">>()
      .toEqualTypeOf<["users", ":userId", "posts", ":postId"]>()
  })

  test.it("handles root path", () => {
    test
      .expectTypeOf<PathPattern.Segments<"/">>()
      .toEqualTypeOf<[]>()
  })
})

test.describe("Params", () => {
  test.it("extracts required params", () => {
    test
      .expectTypeOf<PathPattern.Params<"/users/:id">>()
      .toEqualTypeOf<{ id: string }>()
  })

  test.it("extracts optional params", () => {
    test
      .expectTypeOf<PathPattern.Params<"/users/:id?">>()
      .toEqualTypeOf<{ id?: string }>()
  })

  test.it("extracts optional wildcard params as optional", () => {
    test
      .expectTypeOf<PathPattern.Params<"/files/:path*">>()
      .toEqualTypeOf<{ path?: string }>()
  })

  test.it("extracts required wildcard params as required", () => {
    test
      .expectTypeOf<PathPattern.Params<"/files/:path+">>()
      .toEqualTypeOf<{ path: string }>()
  })

  test.it("extracts multiple params", () => {
    test
      .expectTypeOf<PathPattern.Params<"/users/:userId/posts/:postId">>()
      .toEqualTypeOf<{ userId: string } & { postId: string }>()
  })

  test.it("returns empty for literal-only paths", () => {
    test
      .expectTypeOf<PathPattern.Params<"/users">>()
      .toEqualTypeOf<{}>()
  })

  test.it("handles mixed params with optional wildcard", () => {
    test
      .expectTypeOf<PathPattern.Params<"/users/:id/files/:path*">>()
      .toEqualTypeOf<{ id: string } & { path?: string }>()
  })

  test.it("handles mixed params with required wildcard", () => {
    test
      .expectTypeOf<PathPattern.Params<"/users/:id/files/:path+">>()
      .toEqualTypeOf<{ id: string } & { path: string }>()
  })
})

test.describe(PathPattern.match, () => {
  test.it("matches static path", () => {
    const result = PathPattern.match(["users"], ["users"])
    test.expect(result).toEqual({})
  })

  test.it("returns null for non-matching static path", () => {
    const result = PathPattern.match(["users"], ["posts"])
    test.expect(result).toBeNull()
  })

  test.it("extracts required param", () => {
    const result = PathPattern.match(["users", ":id"], ["users", "123"])
    test.expect(result).toEqual({ id: "123" })
  })

  test.it("extracts optional param when present", () => {
    const result = PathPattern.match(["users", ":id?"], ["users", "123"])
    test.expect(result).toEqual({ id: "123" })
  })

  test.it("omits optional param when absent", () => {
    const result = PathPattern.match(["users", ":id?"], ["users"])
    test.expect(result).toEqual({})
  })

  test.it("extracts optional wildcard when present", () => {
    const result = PathPattern.match(["docs", ":path*"], [
      "docs",
      "api",
      "users",
    ])
    test.expect(result).toEqual({ path: "api/users" })
  })

  test.it("omits optional wildcard when absent", () => {
    const result = PathPattern.match(["docs", ":path*"], ["docs"])
    test.expect(result).toEqual({})
  })

  test.it("extracts required wildcard when present", () => {
    const result = PathPattern.match(["docs", ":path+"], [
      "docs",
      "api",
      "users",
    ])
    test.expect(result).toEqual({ path: "api/users" })
  })

  test.it("returns null for required wildcard when absent", () => {
    const result = PathPattern.match(["docs", ":path+"], ["docs"])
    test.expect(result).toBeNull()
  })

  test.it("distinguishes optional from required wildcard", () => {
    const optionalMatch = PathPattern.match(["files", ":path*"], ["files"])
    const requiredMatch = PathPattern.match(["files", ":path+"], ["files"])

    test.expect(optionalMatch).toEqual({})
    test.expect(requiredMatch).toBeNull()
  })
})

test.describe(PathPattern.toRegex, () => {
  test.it("strips double slashes", () => {
    const regex = PathPattern.toRegex("//users//")
    test.expect(regex.test("/users")).toBe(true)
    test.expect(regex.test("/users/")).toBe(true)
  })

  test.it("strips trailing slashes in pattern", () => {
    const regex = PathPattern.toRegex("/users/")
    test.expect(regex.test("/users")).toBe(true)
    test.expect(regex.test("/users/")).toBe(true)
  })

  test.it("converts greedy params with +", () => {
    const regex = PathPattern.toRegex("/files/:path+")
    test.expect(regex.test("/files/a/b/c")).toBe(true)
    test.expect(regex.test("/files/")).toBe(true)
    test.expect(regex.test("/files")).toBe(false)
  })

  test.it("converts named params", () => {
    const regex = PathPattern.toRegex("/users/:id")
    test.expect(regex.test("/users/123")).toBe(true)
    const match = "/users/123".match(regex)
    test.expect(match?.groups).toEqual({ id: "123" })
  })

  test.it("escapes dots", () => {
    const regex = PathPattern.toRegex("/file.json")
    test.expect(regex.test("/file.json")).toBe(true)
    test.expect(regex.test("/filexjson")).toBe(false)
  })

  test.it("converts wildcards", () => {
    const regex = PathPattern.toRegex("/api/*")
    test.expect(regex.test("/api")).toBe(true)
    test.expect(regex.test("/api/")).toBe(true)
    test.expect(regex.test("/api/users")).toBe(true)
    test.expect(regex.test("/api/users/123")).toBe(true)
  })

  test.it("matches static paths", () => {
    const regex = PathPattern.toRegex("/users")
    test.expect(regex.test("/users")).toBe(true)
    test.expect(regex.test("/users/")).toBe(true)
    test.expect(regex.test("/posts")).toBe(false)
  })

  test.it("matches named params", () => {
    const regex = PathPattern.toRegex("/users/:id")
    test.expect(regex.test("/users/123")).toBe(true)
    test.expect(regex.test("/users/abc")).toBe(true)
    test.expect(regex.test("/users")).toBe(false)
    test.expect(regex.test("/users/123/posts")).toBe(false)
  })

  test.it("extracts named params", () => {
    const regex = PathPattern.toRegex("/users/:id")
    const match = "/users/123".match(regex)
    test.expect(match?.groups).toEqual({ id: "123" })
  })

  test.it("matches greedy params", () => {
    const regex = PathPattern.toRegex("/docs/:path+")
    test.expect(regex.test("/docs/api/users")).toBe(true)
    test.expect(regex.test("/docs/")).toBe(true)
  })

  test.it("matches wildcards", () => {
    const regex = PathPattern.toRegex("/api/*")
    test.expect(regex.test("/api")).toBe(true)
    test.expect(regex.test("/api/")).toBe(true)
    test.expect(regex.test("/api/users")).toBe(true)
    test.expect(regex.test("/api/users/123")).toBe(true)
  })

  test.it("matches complex patterns", () => {
    const regex = PathPattern.toRegex("/users/:userId/posts/:postId")
    test.expect(regex.test("/users/42/posts/7")).toBe(true)
    const match = "/users/42/posts/7".match(regex)
    test.expect(match?.groups).toEqual({ userId: "42", postId: "7" })
  })

  test.it("handles dots in file extensions", () => {
    const regex = PathPattern.toRegex("/files/:name.json")
    test.expect(regex.test("/files/data.json")).toBe(true)
    test.expect(regex.test("/files/dataxjson")).toBe(false)
  })

  test.it("allows trailing slashes in matched path", () => {
    const regex = PathPattern.toRegex("/users/:id")
    test.expect(regex.test("/users/123/")).toBe(true)
  })

  test.it("matches optional wildcard params with :param*", () => {
    const regex = PathPattern.toRegex("/docs/:path*")
    test.expect(regex.test("/docs")).toBe(true)
    test.expect(regex.test("/docs/")).toBe(true)
    test.expect(regex.test("/docs/api")).toBe(true)
    test.expect(regex.test("/docs/api/users")).toBe(true)
    test.expect(regex.test("/docs/api/users/create")).toBe(true)
  })

  test.it("extracts optional wildcard params with :param*", () => {
    const regex = PathPattern.toRegex("/docs/:path*")
    const emptyMatch = "/docs".match(regex)

    test
      .expect(emptyMatch?.groups)
      .toHaveProperty("path")
    test
      .expect(emptyMatch?.groups?.path)
      .toBeUndefined()
    test
      .expect("/docs/api".match(regex)?.groups)
      .toEqual({ path: "api" })
    test
      .expect("/docs/api/users/create".match(regex)?.groups)
      .toEqual({ path: "api/users/create" })
  })

  test.it("distinguishes :param* from :param+", () => {
    const optionalRegex = PathPattern.toRegex("/files/:path*")
    const greedyRegex = PathPattern.toRegex("/files/:path+")

    test.expect(optionalRegex.test("/files")).toBe(true)
    test.expect(greedyRegex.test("/files")).toBe(false)

    test.expect(optionalRegex.test("/files/a/b")).toBe(true)
    test.expect(greedyRegex.test("/files/a/b")).toBe(true)
  })
})
