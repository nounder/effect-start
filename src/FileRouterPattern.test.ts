import * as test from "bun:test"
import * as FileRouterPattern from "./FileRouterPattern.ts"

test.it("empty path", () => {
  test
    .expect(FileRouterPattern.parse(""))
    .toEqual([])
  test
    .expect(FileRouterPattern.parse("/"))
    .toEqual([])
})

test.it("groups", () => {
  test
    .expect(FileRouterPattern.parse("(admin)"))
    .toEqual([
      { _tag: "GroupSegment", name: "admin" },
    ])
  test
    .expect(FileRouterPattern.parse("/(admin)/users"))
    .toEqual([
      { _tag: "GroupSegment", name: "admin" },
      { _tag: "LiteralSegment", value: "users" },
    ])
  test
    .expect(FileRouterPattern.parse("(auth)/login/(step1)"))
    .toEqual([
      { _tag: "GroupSegment", name: "auth" },
      { _tag: "LiteralSegment", value: "login" },
      { _tag: "GroupSegment", name: "step1" },
    ])
})

test.it("handle files parsed as Literal", () => {
  test
    .expect(FileRouterPattern.parse("route.ts"))
    .toEqual([
      { _tag: "LiteralSegment", value: "route.ts" },
    ])
  test
    .expect(FileRouterPattern.parse("/api/route.js"))
    .toEqual([
      { _tag: "LiteralSegment", value: "api" },
      { _tag: "LiteralSegment", value: "route.js" },
    ])
  test
    .expect(FileRouterPattern.parse("layer.tsx"))
    .toEqual([
      { _tag: "LiteralSegment", value: "layer.tsx" },
    ])
  test
    .expect(FileRouterPattern.parse("/blog/layer.jsx"))
    .toEqual([
      { _tag: "LiteralSegment", value: "blog" },
      { _tag: "LiteralSegment", value: "layer.jsx" },
    ])
})

test.it("params and rest", () => {
  test
    .expect(FileRouterPattern.parse("users/[userId]/posts"))
    .toEqual([
      { _tag: "LiteralSegment", value: "users" },
      { _tag: "ParamSegment", name: "userId" },
      { _tag: "LiteralSegment", value: "posts" },
    ])
  test
    .expect(FileRouterPattern.parse("api/[[...path]]"))
    .toEqual([
      { _tag: "LiteralSegment", value: "api" },
      { _tag: "RestSegment", name: "path", optional: true },
    ])
})

test.it("invalid paths", () => {
  test
    .expect(() => FileRouterPattern.parse("$..."))
    .toThrow()
  test
    .expect(() => FileRouterPattern.parse("invalid%char"))
    .toThrow()
  test
    .expect(() => FileRouterPattern.parse("path with spaces"))
    .toThrow()
})

test.it("segments with extensions (literal with dots)", () => {
  test
    .expect(FileRouterPattern.parse("events.json/route.ts"))
    .toEqual([
      { _tag: "LiteralSegment", value: "events.json" },
      { _tag: "LiteralSegment", value: "route.ts" },
    ])
})

test.it("formatSegment", () => {
  test
    .expect(
      FileRouterPattern.formatSegment({
        _tag: "LiteralSegment",
        value: "users",
      }),
    )
    .toBe("users")
  test
    .expect(
      FileRouterPattern.formatSegment({ _tag: "ParamSegment", name: "id" }),
    )
    .toBe("[id]")
  test
    .expect(
      FileRouterPattern.formatSegment({ _tag: "GroupSegment", name: "admin" }),
    )
    .toBe("(admin)")
  test
    .expect(
      FileRouterPattern.formatSegment({ _tag: "RestSegment", name: "path" }),
    )
    .toBe("[...path]")
})

test.it("format", () => {
  test
    .expect(FileRouterPattern.format([]))
    .toBe("/")
  test
    .expect(
      FileRouterPattern.format([{ _tag: "LiteralSegment", value: "users" }]),
    )
    .toBe("/users")
  test
    .expect(
      FileRouterPattern.format([
        { _tag: "GroupSegment", name: "admin" },
        { _tag: "LiteralSegment", value: "users" },
      ]),
    )
    .toBe("/(admin)/users")
  test
    .expect(
      FileRouterPattern.format([
        { _tag: "LiteralSegment", value: "users" },
        { _tag: "ParamSegment", name: "id" },
      ]),
    )
    .toBe("/users/[id]")
})
