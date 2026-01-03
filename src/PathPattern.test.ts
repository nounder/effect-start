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

  test.it("parses rest segments", () => {
    test
      .expect(PathPattern.parseSegment(":path*"))
      .toBe(":path*")
    test
      .expect(PathPattern.parseSegment(":rest*"))
      .toBe(":rest*")
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

  test.it("parses paths with rest", () => {
    test
      .expect(PathPattern.parse("/files/:path*"))
      .toEqual(["files", ":path*"])
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

  test.it("extracts rest segments", () => {
    test
      .expectTypeOf<PathPattern.Segments<"/files/:path*">>()
      .toEqualTypeOf<["files", ":path*"]>()
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

  test.it("extracts rest params as optional", () => {
    test
      .expectTypeOf<PathPattern.Params<"/files/:path*">>()
      .toEqualTypeOf<{ path?: string }>()
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

  test.it("handles mixed params", () => {
    test
      .expectTypeOf<PathPattern.Params<"/users/:id/files/:path*">>()
      .toEqualTypeOf<{ id: string } & { path?: string }>()
  })
})
