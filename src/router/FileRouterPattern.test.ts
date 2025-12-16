import * as t from "bun:test"
import * as FileRouterPattern from "./FileRouterPattern.ts"

t.it("empty path", () => {
  t.expect(FileRouterPattern.parse("")).toEqual([])
  t.expect(FileRouterPattern.parse("/")).toEqual([])
})

t.it("groups", () => {
  t.expect(FileRouterPattern.parse("(admin)")).toEqual([
    { _tag: "GroupSegment", name: "admin" },
  ])
  t.expect(FileRouterPattern.parse("/(admin)/users")).toEqual([
    { _tag: "GroupSegment", name: "admin" },
    { _tag: "LiteralSegment", value: "users" },
  ])
  t.expect(FileRouterPattern.parse("(auth)/login/(step1)")).toEqual([
    { _tag: "GroupSegment", name: "auth" },
    { _tag: "LiteralSegment", value: "login" },
    { _tag: "GroupSegment", name: "step1" },
  ])
})

t.it("handle files parsed as Literal", () => {
  t.expect(FileRouterPattern.parse("route.ts")).toEqual([
    { _tag: "LiteralSegment", value: "route.ts" },
  ])
  t.expect(FileRouterPattern.parse("/api/route.js")).toEqual([
    { _tag: "LiteralSegment", value: "api" },
    { _tag: "LiteralSegment", value: "route.js" },
  ])
  t.expect(FileRouterPattern.parse("layer.tsx")).toEqual([
    { _tag: "LiteralSegment", value: "layer.tsx" },
  ])
  t.expect(FileRouterPattern.parse("/blog/layer.jsx")).toEqual([
    { _tag: "LiteralSegment", value: "blog" },
    { _tag: "LiteralSegment", value: "layer.jsx" },
  ])
})

t.it("params and rest", () => {
  t.expect(FileRouterPattern.parse("users/[userId]/posts")).toEqual([
    { _tag: "LiteralSegment", value: "users" },
    { _tag: "ParamSegment", name: "userId" },
    { _tag: "LiteralSegment", value: "posts" },
  ])

  t.expect(FileRouterPattern.parse("api/[[...path]]")).toEqual([
    { _tag: "LiteralSegment", value: "api" },
    { _tag: "RestSegment", name: "path", optional: true },
  ])
})

t.it("invalid paths", () => {
  t.expect(() => FileRouterPattern.parse("$...")).toThrow()
  t.expect(() => FileRouterPattern.parse("invalid%char")).toThrow()
  t.expect(() => FileRouterPattern.parse("path with spaces")).toThrow()
})

t.it("segments with extensions (literal with dots)", () => {
  t.expect(FileRouterPattern.parse("events.json/route.ts")).toEqual([
    { _tag: "LiteralSegment", value: "events.json" },
    { _tag: "LiteralSegment", value: "route.ts" },
  ])
})

t.it("formatSegment", () => {
  t
    .expect(
      FileRouterPattern.formatSegment({
        _tag: "LiteralSegment",
        value: "users",
      }),
    )
    .toBe("users")
  t
    .expect(
      FileRouterPattern.formatSegment({ _tag: "ParamSegment", name: "id" }),
    )
    .toBe("[id]")
  t
    .expect(
      FileRouterPattern.formatSegment({ _tag: "GroupSegment", name: "admin" }),
    )
    .toBe("(admin)")
  t
    .expect(
      FileRouterPattern.formatSegment({ _tag: "RestSegment", name: "path" }),
    )
    .toBe("[...path]")
})

t.it("format", () => {
  t.expect(FileRouterPattern.format([])).toBe("/")
  t
    .expect(
      FileRouterPattern.format([{ _tag: "LiteralSegment", value: "users" }]),
    )
    .toBe("/users")
  t
    .expect(
      FileRouterPattern.format([
        { _tag: "GroupSegment", name: "admin" },
        { _tag: "LiteralSegment", value: "users" },
      ]),
    )
    .toBe("/(admin)/users")
  t
    .expect(
      FileRouterPattern.format([
        { _tag: "LiteralSegment", value: "users" },
        { _tag: "ParamSegment", name: "id" },
      ]),
    )
    .toBe("/users/[id]")
})
