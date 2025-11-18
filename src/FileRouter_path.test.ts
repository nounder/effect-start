import * as t from "bun:test"
import * as FileRouter from "./FileRouter.ts"

t.it("empty path as null", () => {
  t.expect(FileRouter.segmentPath("")).toEqual([])
  t.expect(FileRouter.segmentPath("/")).toEqual([])
})

t.it("literal segments", () => {
  t.expect(FileRouter.segmentPath("users")).toEqual([{ literal: "users" }])
  t.expect(FileRouter.segmentPath("/users")).toEqual([{ literal: "users" }])
  t.expect(FileRouter.segmentPath("users/")).toEqual([{ literal: "users" }])
  t.expect(FileRouter.segmentPath("/users/create")).toEqual([
    { literal: "users" },
    { literal: "create" },
  ])
  t.expect(() => FileRouter.segmentPath("path with spaces")).toThrow()
})

t.it("dynamic parameters", () => {
  t.expect(FileRouter.segmentPath("[userId]")).toEqual([{ param: "userId" }])
  t.expect(FileRouter.segmentPath("/users/[userId]")).toEqual([
    { literal: "users" },
    { param: "userId" },
  ])
  t.expect(FileRouter.segmentPath("/posts/[postId]/comments/[commentId]"))
    .toEqual([
      { literal: "posts" },
      { param: "postId" },
      { literal: "comments" },
      { param: "commentId" },
    ])
})

t.it("rest parameters", () => {
  t.expect(FileRouter.segmentPath("[[...rest]]")).toEqual([
    { rest: "rest", optional: true },
  ])
  t.expect(FileRouter.segmentPath("[...rest]")).toEqual([{ rest: "rest" }])
  t.expect(FileRouter.segmentPath("/docs/[[...slug]]")).toEqual([
    { literal: "docs" },
    { rest: "slug", optional: true },
  ])
  t.expect(FileRouter.segmentPath("/api/[...path]")).toEqual([
    { literal: "api" },
    { rest: "path" },
  ])
})

t.it("groups", () => {
  t.expect(FileRouter.segmentPath("(admin)")).toEqual([{ group: "admin" }])
  t.expect(FileRouter.segmentPath("/(admin)/users")).toEqual([
    { group: "admin" },
    { literal: "users" },
  ])
  t.expect(FileRouter.segmentPath("(auth)/login/(step1)")).toEqual([
    { group: "auth" },
    { literal: "login" },
    { group: "step1" },
  ])
})

t.it("route handles", () => {
  t.expect(FileRouter.segmentPath("route.ts")).toEqual([{ handle: "route" }])
  t.expect(FileRouter.segmentPath("/api/route.js")).toEqual([
    { literal: "api" },
    { handle: "route" },
  ])
  t.expect(FileRouter.segmentPath("route.tsx")).toEqual([{ handle: "route" }])
})

t.it("layer handles", () => {
  t.expect(FileRouter.segmentPath("layer.tsx")).toEqual([{ handle: "layer" }])
  t.expect(FileRouter.segmentPath("layer.jsx")).toEqual([{ handle: "layer" }])
  t.expect(FileRouter.segmentPath("layer.js")).toEqual([{ handle: "layer" }])
  t.expect(FileRouter.segmentPath("/blog/layer.jsx")).toEqual([
    { literal: "blog" },
    { handle: "layer" },
  ])
})

t.it("complex combinations", () => {
  t.expect(FileRouter.segmentPath("/users/[userId]/posts/route.tsx")).toEqual([
    { literal: "users" },
    { param: "userId" },
    { literal: "posts" },
    { handle: "route" },
  ])
  t.expect(FileRouter.segmentPath("/api/v1/[[...path]]/route.ts")).toEqual([
    { literal: "api" },
    { literal: "v1" },
    { rest: "path", optional: true },
    { handle: "route" },
  ])
  t.expect(FileRouter.segmentPath("(admin)/users/route.tsx")).toEqual([
    { group: "admin" },
    { literal: "users" },
    { handle: "route" },
  ])
})

t.it("invalid paths", () => {
  t.expect(() => FileRouter.segmentPath("$...")).toThrow()
  t.expect(() => FileRouter.segmentPath("invalid%char")).toThrow()
})

t.it("param and rest types", () => {
  t.expect(FileRouter.segmentPath("[a]")).toEqual([{ param: "a" }])
  t.expect(FileRouter.segmentPath("[...rest]")).toEqual([{ rest: "rest" }])
  t.expect(FileRouter.segmentPath("[[...rest]]")).toEqual([
    { rest: "rest", optional: true },
  ])
})

t.it("extractRoute - users/route.ts", () => {
  t.expect(FileRouter.segmentPath("users/route.ts")).toEqual([
    { literal: "users" },
    { handle: "route" },
  ])
})

t.it("segments with extensions", () => {
  t.expect(FileRouter.segmentPath("events.json/route.ts")).toEqual([
    { literal: "events.json" },
    { handle: "route" },
  ])
  t.expect(FileRouter.segmentPath("config.yaml.backup/route.ts")).toEqual([
    { literal: "config.yaml.backup" },
    { handle: "route" },
  ])
})
