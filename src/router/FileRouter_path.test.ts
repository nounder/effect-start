import * as t from "bun:test"
import * as FileRouter from "./FileRouter.ts"

t.it("empty path", () => {
  t.expect(FileRouter.parse("")).toEqual([])
  t.expect(FileRouter.parse("/")).toEqual([])
})

t.it("groups", () => {
  t.expect(FileRouter.parse("(admin)")).toEqual([
    { _tag: "GroupSegment", name: "admin" },
  ])
  t.expect(FileRouter.parse("/(admin)/users")).toEqual([
    { _tag: "GroupSegment", name: "admin" },
    { _tag: "LiteralSegment", value: "users" },
  ])
  t.expect(FileRouter.parse("(auth)/login/(step1)")).toEqual([
    { _tag: "GroupSegment", name: "auth" },
    { _tag: "LiteralSegment", value: "login" },
    { _tag: "GroupSegment", name: "step1" },
  ])
})

t.it("handle files parsed as Literal", () => {
  t.expect(FileRouter.parse("route.ts")).toEqual([
    { _tag: "LiteralSegment", value: "route.ts" },
  ])
  t.expect(FileRouter.parse("/api/route.js")).toEqual([
    { _tag: "LiteralSegment", value: "api" },
    { _tag: "LiteralSegment", value: "route.js" },
  ])
  t.expect(FileRouter.parse("layer.tsx")).toEqual([
    { _tag: "LiteralSegment", value: "layer.tsx" },
  ])
  t.expect(FileRouter.parse("/blog/layer.jsx")).toEqual([
    { _tag: "LiteralSegment", value: "blog" },
    { _tag: "LiteralSegment", value: "layer.jsx" },
  ])
})

t.it("parseRoute extracts handle from Literal", () => {
  const route = FileRouter.parseRoute("users/route.tsx")
  t.expect(route.handle).toBe("route")
  t.expect(route.routePath).toBe("/users")
  t.expect(route.segments).toEqual([
    { _tag: "LiteralSegment", value: "users" },
  ])

  const layer = FileRouter.parseRoute("api/layer.ts")
  t.expect(layer.handle).toBe("layer")
  t.expect(layer.routePath).toBe("/api")
})

t.it("parseRoute with groups", () => {
  const route = FileRouter.parseRoute("(admin)/users/route.tsx")
  t.expect(route.handle).toBe("route")
  t.expect(route.routePath).toBe("/users")
  t.expect(route.segments).toEqual([
    { _tag: "GroupSegment", name: "admin" },
    { _tag: "LiteralSegment", value: "users" },
  ])
})

t.it("parseRoute with params and rest", () => {
  const route = FileRouter.parseRoute("users/[userId]/posts/route.tsx")
  t.expect(route.handle).toBe("route")
  t.expect(route.routePath).toBe("/users/[userId]/posts")
  t.expect(route.segments).toEqual([
    { _tag: "LiteralSegment", value: "users" },
    { _tag: "ParamSegment", name: "userId" },
    { _tag: "LiteralSegment", value: "posts" },
  ])

  const rest = FileRouter.parseRoute("api/[[...path]]/route.ts")
  t.expect(rest.handle).toBe("route")
  t.expect(rest.segments).toEqual([
    { _tag: "LiteralSegment", value: "api" },
    { _tag: "RestSegment", name: "path", optional: true },
  ])
})

t.it("invalid paths", () => {
  t.expect(() => FileRouter.parse("$...")).toThrow()
  t.expect(() => FileRouter.parse("invalid%char")).toThrow()
  t.expect(() => FileRouter.parse("path with spaces")).toThrow()
})

t.it("segments with extensions (literal with dots)", () => {
  t.expect(FileRouter.parse("events.json/route.ts")).toEqual([
    { _tag: "LiteralSegment", value: "events.json" },
    { _tag: "LiteralSegment", value: "route.ts" },
  ])
})
