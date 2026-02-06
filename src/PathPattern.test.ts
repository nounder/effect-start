import * as test from "bun:test"
import * as PathPattern from "./PathPattern.ts"

test.describe(PathPattern.validate, () => {
  test.it("validates simple paths", () => {
    test
      .expect(PathPattern.validate("/users"))
      .toEqual({ ok: true, segments: ["users"] })
    test
      .expect(PathPattern.validate("/users/posts"))
      .toEqual({ ok: true, segments: ["users", "posts"] })
  })

  test.it("validates paths with params", () => {
    test
      .expect(PathPattern.validate("/users/:id"))
      .toEqual({ ok: true, segments: ["users", ":id"] })
    test
      .expect(PathPattern.validate("/users/:userId/posts/:postId"))
      .toEqual({ ok: true, segments: ["users", ":userId", "posts", ":postId"] })
  })

  test.it("validates paths with optional params", () => {
    test
      .expect(PathPattern.validate("/users/:id?"))
      .toEqual({ ok: true, segments: ["users", ":id?"] })
  })

  test.it("validates paths with optional wildcard", () => {
    test
      .expect(PathPattern.validate("/files/:path*"))
      .toEqual({ ok: true, segments: ["files", ":path*"] })
  })

  test.it("validates paths with required wildcard", () => {
    test
      .expect(PathPattern.validate("/files/:path+"))
      .toEqual({ ok: true, segments: ["files", ":path+"] })
  })

  test.it("validates root path", () => {
    test
      .expect(PathPattern.validate("/"))
      .toEqual({ ok: true, segments: [] })
  })

  test.it("validates unicode segments", () => {
    test
      .expect(PathPattern.validate("/用户"))
      .toEqual({ ok: true, segments: ["用户"] })
  })

  test.it("validates segments with dots and dashes", () => {
    test
      .expect(PathPattern.validate("/my-page"))
      .toEqual({ ok: true, segments: ["my-page"] })
    test
      .expect(PathPattern.validate("/file.txt"))
      .toEqual({ ok: true, segments: ["file.txt"] })
  })

  test.it("returns error for invalid segments", () => {
    const result = PathPattern.validate("/foo bar")

    test
      .expect(result.ok)
      .toBe(false)

    if (!result.ok) {
      test
        .expect(result.error)
        .toContain("foo bar")
    }
  })

  test.it("returns error for empty param name", () => {
    const result = PathPattern.validate("/:")

    test
      .expect(result.ok)
      .toBe(false)
  })

  test.it("returns error for param with only modifier", () => {
    test
      .expect(PathPattern.validate("/:?").ok)
      .toBe(false)
    test
      .expect(PathPattern.validate("/:*").ok)
      .toBe(false)
    test
      .expect(PathPattern.validate("/:+").ok)
      .toBe(false)
  })
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
    const result = PathPattern.match("/users", "/users")

    test
      .expect(result)
      .toEqual({})
  })

  test.it("returns null for non-matching static path", () => {
    const result = PathPattern.match("/users", "/posts")

    test
      .expect(result)
      .toBeNull()
  })

  test.it("extracts required param", () => {
    const result = PathPattern.match("/users/:id", "/users/123")

    test
      .expect(result)
      .toEqual({ id: "123" })
  })

  test.it("extracts optional param when present", () => {
    const result = PathPattern.match("/users/:id?", "/users/123")

    test
      .expect(result)
      .toEqual({ id: "123" })
  })

  test.it("omits optional param when absent", () => {
    const result = PathPattern.match("/users/:id?", "/users")

    test
      .expect(result)
      .toEqual({})
  })

  test.it("extracts optional wildcard when present", () => {
    const result = PathPattern.match("/docs/:path*", "/docs/api/users")

    test
      .expect(result)
      .toEqual({ path: "api/users" })
  })

  test.it("omits optional wildcard when absent", () => {
    const result = PathPattern.match("/docs/:path*", "/docs")

    test
      .expect(result)
      .toEqual({})
  })

  test.it("extracts required wildcard when present", () => {
    const result = PathPattern.match("/docs/:path+", "/docs/api/users")

    test
      .expect(result)
      .toEqual({ path: "api/users" })
  })

  test.it("returns null for required wildcard when absent", () => {
    const result = PathPattern.match("/docs/:path+", "/docs")

    test
      .expect(result)
      .toBeNull()
  })

  test.it("distinguishes optional from required wildcard", () => {
    const optionalMatch = PathPattern.match("/files/:path*", "/files")
    const requiredMatch = PathPattern.match("/files/:path+", "/files")

    test
      .expect(optionalMatch)
      .toEqual({})
    test
      .expect(requiredMatch)
      .toBeNull()
  })
})

test.describe(PathPattern.toRegex, () => {
  test.it("strips double slashes", () => {
    const regex = PathPattern.toRegex("//users//")

    test
      .expect(regex.test("/users"))
      .toBe(true)
    test
      .expect(regex.test("/users/"))
      .toBe(true)
  })

  test.it("strips trailing slashes in pattern", () => {
    const regex = PathPattern.toRegex("/users/")

    test
      .expect(regex.test("/users"))
      .toBe(true)
    test
      .expect(regex.test("/users/"))
      .toBe(true)
  })

  test.it("converts greedy params with +", () => {
    const regex = PathPattern.toRegex("/files/:path+")

    test
      .expect(regex.test("/files/a/b/c"))
      .toBe(true)
    test
      .expect(regex.test("/files/"))
      .toBe(true)
    test
      .expect(regex.test("/files"))
      .toBe(false)
  })

  test.it("converts named params", () => {
    const regex = PathPattern.toRegex("/users/:id")

    test
      .expect(regex.test("/users/123"))
      .toBe(true)

    const match = "/users/123".match(regex)

    test
      .expect(match?.groups)
      .toEqual({ id: "123" })
  })

  test.it("escapes dots", () => {
    const regex = PathPattern.toRegex("/file.json")

    test
      .expect(regex.test("/file.json"))
      .toBe(true)
    test
      .expect(regex.test("/filexjson"))
      .toBe(false)
  })

  test.it("converts wildcards", () => {
    const regex = PathPattern.toRegex("/api/*")

    test
      .expect(regex.test("/api"))
      .toBe(true)
    test
      .expect(regex.test("/api/"))
      .toBe(true)
    test
      .expect(regex.test("/api/users"))
      .toBe(true)
    test
      .expect(regex.test("/api/users/123"))
      .toBe(true)
  })

  test.it("matches static paths", () => {
    const regex = PathPattern.toRegex("/users")

    test
      .expect(regex.test("/users"))
      .toBe(true)
    test
      .expect(regex.test("/users/"))
      .toBe(true)
    test
      .expect(regex.test("/posts"))
      .toBe(false)
  })

  test.it("matches named params", () => {
    const regex = PathPattern.toRegex("/users/:id")

    test
      .expect(regex.test("/users/123"))
      .toBe(true)
    test
      .expect(regex.test("/users/abc"))
      .toBe(true)
    test
      .expect(regex.test("/users"))
      .toBe(false)
    test
      .expect(regex.test("/users/123/posts"))
      .toBe(false)
  })

  test.it("extracts named params", () => {
    const regex = PathPattern.toRegex("/users/:id")
    const match = "/users/123".match(regex)

    test
      .expect(match?.groups)
      .toEqual({ id: "123" })
  })

  test.it("matches greedy params", () => {
    const regex = PathPattern.toRegex("/docs/:path+")

    test
      .expect(regex.test("/docs/api/users"))
      .toBe(true)
    test
      .expect(regex.test("/docs/"))
      .toBe(true)
  })

  test.it("matches wildcards", () => {
    const regex = PathPattern.toRegex("/api/*")

    test
      .expect(regex.test("/api"))
      .toBe(true)
    test
      .expect(regex.test("/api/"))
      .toBe(true)
    test
      .expect(regex.test("/api/users"))
      .toBe(true)
    test
      .expect(regex.test("/api/users/123"))
      .toBe(true)
  })

  test.it("matches complex patterns", () => {
    const regex = PathPattern.toRegex("/users/:userId/posts/:postId")

    test
      .expect(regex.test("/users/42/posts/7"))
      .toBe(true)

    const match = "/users/42/posts/7".match(regex)

    test
      .expect(match?.groups)
      .toEqual({ userId: "42", postId: "7" })
  })

  test.it("handles dots in file extensions", () => {
    const regex = PathPattern.toRegex("/files/:name.json")

    test
      .expect(regex.test("/files/data.json"))
      .toBe(true)
    test
      .expect(regex.test("/files/dataxjson"))
      .toBe(false)
  })

  test.it("allows trailing slashes in matched path", () => {
    const regex = PathPattern.toRegex("/users/:id")

    test
      .expect(regex.test("/users/123/"))
      .toBe(true)
  })

  test.it("matches optional wildcard params with :param*", () => {
    const regex = PathPattern.toRegex("/docs/:path*")

    test
      .expect(regex.test("/docs"))
      .toBe(true)
    test
      .expect(regex.test("/docs/"))
      .toBe(true)
    test
      .expect(regex.test("/docs/api"))
      .toBe(true)
    test
      .expect(regex.test("/docs/api/users"))
      .toBe(true)
    test
      .expect(regex.test("/docs/api/users/create"))
      .toBe(true)
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

    test
      .expect(optionalRegex.test("/files"))
      .toBe(true)
    test
      .expect(greedyRegex.test("/files"))
      .toBe(false)

    test
      .expect(optionalRegex.test("/files/a/b"))
      .toBe(true)
    test
      .expect(greedyRegex.test("/files/a/b"))
      .toBe(true)
  })
})

test.describe(PathPattern.toExpress, () => {
  test.it("converts literal paths", () => {
    test
      .expect(PathPattern.toExpress("/users"))
      .toEqual(["/users"])
    test
      .expect(PathPattern.toExpress("/users/posts"))
      .toEqual(["/users/posts"])
  })

  test.it("converts required params", () => {
    test
      .expect(PathPattern.toExpress("/users/:id"))
      .toEqual(["/users/:id"])
  })

  test.it("converts optional params to brace syntax", () => {
    test
      .expect(PathPattern.toExpress("/users/:id?"))
      .toEqual(["/users{/:id}"])
  })

  test.it("converts required wildcard", () => {
    test
      .expect(PathPattern.toExpress("/docs/:path+"))
      .toEqual(["/docs/*path"])
  })

  test.it("converts optional wildcard to two routes", () => {
    test
      .expect(PathPattern.toExpress("/docs/:path*"))
      .toEqual(["/docs", "/docs/*path"])
  })

  test.it("converts root path", () => {
    test
      .expect(PathPattern.toExpress("/"))
      .toEqual(["/"])
  })
})

test.describe(PathPattern.toURLPattern, () => {
  test.it("converts literal paths", () => {
    test
      .expect(PathPattern.toURLPattern("/users"))
      .toEqual(["/users"])
  })

  test.it("preserves param modifiers", () => {
    test
      .expect(PathPattern.toURLPattern("/users/:id"))
      .toEqual(["/users/:id"])
    test
      .expect(PathPattern.toURLPattern("/users/:id?"))
      .toEqual(["/users/:id?"])
    test
      .expect(PathPattern.toURLPattern("/docs/:path+"))
      .toEqual(["/docs/:path+"])
    test
      .expect(PathPattern.toURLPattern("/docs/:path*"))
      .toEqual(["/docs/:path*"])
  })

  test.it("converts root path", () => {
    test
      .expect(PathPattern.toURLPattern("/"))
      .toEqual(["/"])
  })
})

test.describe(PathPattern.toReactRouter, () => {
  test.it("converts literal paths", () => {
    test
      .expect(PathPattern.toReactRouter("/users"))
      .toEqual(["/users"])
  })

  test.it("converts required params", () => {
    test
      .expect(PathPattern.toReactRouter("/users/:id"))
      .toEqual(["/users/:id"])
  })

  test.it("converts optional params", () => {
    test
      .expect(PathPattern.toReactRouter("/users/:id?"))
      .toEqual(["/users/:id?"])
  })

  test.it("converts required wildcard to splat", () => {
    test
      .expect(PathPattern.toReactRouter("/docs/:path+"))
      .toEqual(["/docs/*"])
  })

  test.it("converts optional wildcard to two routes", () => {
    test
      .expect(PathPattern.toReactRouter("/docs/:path*"))
      .toEqual(["/docs", "/docs/*"])
  })

  test.it("converts root path", () => {
    test
      .expect(PathPattern.toReactRouter("/"))
      .toEqual(["/"])
  })
})

test.describe(PathPattern.toRemixFile, () => {
  test.it("converts literal paths with dot separator", () => {
    test
      .expect(PathPattern.toRemixFile("/users"))
      .toBe("users")
    test
      .expect(PathPattern.toRemixFile("/users/posts"))
      .toBe("users.posts")
  })

  test.it("converts required params to $param", () => {
    test
      .expect(PathPattern.toRemixFile("/users/:id"))
      .toBe("users.$id")
  })

  test.it("converts optional params to ($param)", () => {
    test
      .expect(PathPattern.toRemixFile("/users/:id?"))
      .toBe("users.($id)")
  })

  test.it("converts required wildcard to $", () => {
    test
      .expect(PathPattern.toRemixFile("/docs/:path+"))
      .toBe("docs.$")
  })

  test.it("converts optional wildcard to ($)", () => {
    test
      .expect(PathPattern.toRemixFile("/docs/:path*"))
      .toBe("docs.($)")
  })

  test.it("converts root path", () => {
    test
      .expect(PathPattern.toRemixFile("/"))
      .toBe("")
  })
})

test.describe(PathPattern.toTanStack, () => {
  test.it("converts literal paths with dot separator", () => {
    test
      .expect(PathPattern.toTanStack("/users"))
      .toBe("users")
    test
      .expect(PathPattern.toTanStack("/users/posts"))
      .toBe("users.posts")
  })

  test.it("converts required params to $param", () => {
    test
      .expect(PathPattern.toTanStack("/users/:id"))
      .toBe("users.$id")
  })

  test.it("converts optional params to {-$param}", () => {
    test
      .expect(PathPattern.toTanStack("/users/:id?"))
      .toBe("users.{-$id}")
  })

  test.it("converts required wildcard to $", () => {
    test
      .expect(PathPattern.toTanStack("/docs/:path+"))
      .toBe("docs.$")
  })

  test.it("converts optional wildcard to $ (treated as required)", () => {
    test
      .expect(PathPattern.toTanStack("/docs/:path*"))
      .toBe("docs.$")
  })

  test.it("converts root path", () => {
    test
      .expect(PathPattern.toTanStack("/"))
      .toBe("")
  })
})

test.describe(PathPattern.toHono, () => {
  test.it("converts literal paths", () => {
    test
      .expect(PathPattern.toHono("/users"))
      .toEqual(["/users"])
  })

  test.it("converts required params", () => {
    test
      .expect(PathPattern.toHono("/users/:id"))
      .toEqual(["/users/:id"])
  })

  test.it("converts optional params", () => {
    test
      .expect(PathPattern.toHono("/users/:id?"))
      .toEqual(["/users/:id?"])
  })

  test.it("converts required wildcard to unnamed *", () => {
    test
      .expect(PathPattern.toHono("/docs/:path+"))
      .toEqual(["/docs/*"])
  })

  test.it("converts optional wildcard to two routes with unnamed *", () => {
    test
      .expect(PathPattern.toHono("/docs/:path*"))
      .toEqual(["/docs", "/docs/*"])
  })

  test.it("converts root path", () => {
    test
      .expect(PathPattern.toHono("/"))
      .toEqual(["/"])
  })
})

test.describe(PathPattern.toEffect, () => {
  test.it("is alias for toHono", () => {
    test
      .expect(PathPattern.toEffect("/users/:id"))
      .toEqual(PathPattern.toHono("/users/:id"))
    test
      .expect(PathPattern.toEffect("/docs/:path*"))
      .toEqual(PathPattern.toHono("/docs/:path*"))
  })
})

test.describe(PathPattern.toBun, () => {
  test.it("converts literal paths", () => {
    test
      .expect(PathPattern.toBun("/users"))
      .toEqual(["/users"])
  })

  test.it("converts required params", () => {
    test
      .expect(PathPattern.toBun("/users/:id"))
      .toEqual(["/users/:id"])
  })

  test.it("expands optional params to two routes", () => {
    test
      .expect(PathPattern.toBun("/users/:id?"))
      .toEqual(["/users", "/users/:id"])
  })

  test.it("converts required wildcard to /*", () => {
    test
      .expect(PathPattern.toBun("/docs/:path+"))
      .toEqual(["/docs/*"])
  })

  test.it("expands optional wildcard to two routes", () => {
    test
      .expect(PathPattern.toBun("/docs/:path*"))
      .toEqual(["/docs", "/docs/*"])
  })

  test.it("converts root path", () => {
    test
      .expect(PathPattern.toBun("/"))
      .toEqual(["/"])
  })

  test.it("expands multiple optional params", () => {
    test
      .expect(PathPattern.toBun("/users/:id?/posts/:postId?"))
      .toEqual(["/users", "/users/:id/posts/:postId"])
  })
})
