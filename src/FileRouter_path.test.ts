import * as test from "bun:test"
import * as FilePathPattern from "./FilePathPattern.ts"
import * as FileRouter from "./FileRouter.ts"

test.it("empty path", () => {
  test.expect(FilePathPattern.segments("")).toEqual([])
  test.expect(FilePathPattern.segments("/")).toEqual([])
})

test.it("groups", () => {
  test
    .expect(FilePathPattern.segments("(admin)"))
    .toEqual([{ _tag: "GroupSegment", name: "admin" }])
  test.expect(FilePathPattern.segments("/(admin)/users")).toEqual([
    { _tag: "GroupSegment", name: "admin" },
    { _tag: "LiteralSegment", value: "users" },
  ])
  test.expect(FilePathPattern.segments("(auth)/login/(step1)")).toEqual([
    { _tag: "GroupSegment", name: "auth" },
    { _tag: "LiteralSegment", value: "login" },
    { _tag: "GroupSegment", name: "step1" },
  ])
})

test.it("handle files parsed as Literal", () => {
  test
    .expect(FilePathPattern.segments("route.ts"))
    .toEqual([{ _tag: "LiteralSegment", value: "route.ts" }])
  test.expect(FilePathPattern.segments("/api/route.js")).toEqual([
    { _tag: "LiteralSegment", value: "api" },
    { _tag: "LiteralSegment", value: "route.js" },
  ])
  test
    .expect(FilePathPattern.segments("layer.tsx"))
    .toEqual([{ _tag: "LiteralSegment", value: "layer.tsx" }])
  test.expect(FilePathPattern.segments("/blog/layer.jsx")).toEqual([
    { _tag: "LiteralSegment", value: "blog" },
    { _tag: "LiteralSegment", value: "layer.jsx" },
  ])
})

test.it("parseRoute extracts handle from Literal", () => {
  const route = FileRouter.parseRoute("users/route.tsx")

  test.expect(route).not.toBeNull()
  test.expect(route!.handle).toBe("route")
  test.expect(route!.routePath).toBe("/users")
  test.expect(route!.segments).toEqual([{ _tag: "LiteralSegment", value: "users" }])

  const layer = FileRouter.parseRoute("api/layer.ts")

  test.expect(layer).not.toBeNull()
  test.expect(layer!.handle).toBe("layer")
  test.expect(layer!.routePath).toBe("/api")
})

test.it("parseRoute with groups", () => {
  const route = FileRouter.parseRoute("(admin)/users/route.tsx")

  test.expect(route).not.toBeNull()
  test.expect(route!.handle).toBe("route")
  test.expect(route!.routePath).toBe("/users")
  test.expect(route!.segments).toEqual([
    { _tag: "GroupSegment", name: "admin" },
    { _tag: "LiteralSegment", value: "users" },
  ])
})

test.it("parseRoute with params and rest", () => {
  const route = FileRouter.parseRoute("users/[userId]/posts/route.tsx")

  test.expect(route).not.toBeNull()
  test.expect(route!.handle).toBe("route")
  test.expect(route!.routePath).toBe("/users/[userId]/posts")
  test.expect(route!.segments).toEqual([
    { _tag: "LiteralSegment", value: "users" },
    { _tag: "ParamSegment", name: "userId" },
    { _tag: "LiteralSegment", value: "posts" },
  ])

  const rest = FileRouter.parseRoute("api/[[path]]/route.ts")

  test.expect(rest).not.toBeNull()
  test.expect(rest!.handle).toBe("route")
  test.expect(rest!.segments).toEqual([
    { _tag: "LiteralSegment", value: "api" },
    { _tag: "RestSegment", name: "path" },
  ])
})

test.it("invalid paths", () => {
  test.expect(FilePathPattern.segments("$...")).toEqual([{ _tag: "InvalidSegment", value: "$..." }])
  test
    .expect(FilePathPattern.segments("invalid%char"))
    .toEqual([{ _tag: "InvalidSegment", value: "invalid%char" }])
})

test.it("segments with extensions (literal with dots)", () => {
  test.expect(FilePathPattern.segments("events.json/route.ts")).toEqual([
    { _tag: "LiteralSegment", value: "events.json" },
    { _tag: "LiteralSegment", value: "route.ts" },
  ])
})
