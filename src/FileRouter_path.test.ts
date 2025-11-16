import {
  expect,
  test,
} from "bun:test"
import * as FileRouter from "./FileRouter.ts"

test("empty path as null", () => {
  expect(FileRouter.segmentPath("")).toEqual([])
  expect(FileRouter.segmentPath("/")).toEqual([])
})

test("literal segments", () => {
  expect(FileRouter.segmentPath("users")).toEqual([{ literal: "users" }])
  expect(FileRouter.segmentPath("/users")).toEqual([{ literal: "users" }])
  expect(FileRouter.segmentPath("users/")).toEqual([{ literal: "users" }])
  expect(FileRouter.segmentPath("/users/create")).toEqual([
    { literal: "users" },
    { literal: "create" },
  ])
  expect(() => FileRouter.segmentPath("path with spaces")).toThrow()
})

test("dynamic parameters", () => {
  expect(FileRouter.segmentPath("[userId]")).toEqual([{ param: "userId" }])
  expect(FileRouter.segmentPath("/users/[userId]")).toEqual([
    { literal: "users" },
    { param: "userId" },
  ])
  expect(FileRouter.segmentPath("/posts/[postId]/comments/[commentId]"))
    .toEqual([
      { literal: "posts" },
      { param: "postId" },
      { literal: "comments" },
      { param: "commentId" },
    ])
})

test("rest parameters", () => {
  expect(FileRouter.segmentPath("[[...rest]]")).toEqual([
    { rest: "rest", optional: true },
  ])
  expect(FileRouter.segmentPath("[...rest]")).toEqual([{ rest: "rest" }])
  expect(FileRouter.segmentPath("/docs/[[...slug]]")).toEqual([
    { literal: "docs" },
    { rest: "slug", optional: true },
  ])
  expect(FileRouter.segmentPath("/api/[...path]")).toEqual([
    { literal: "api" },
    { rest: "path" },
  ])
})

test("groups", () => {
  expect(FileRouter.segmentPath("(admin)")).toEqual([{ group: "admin" }])
  expect(FileRouter.segmentPath("/(admin)/users")).toEqual([
    { group: "admin" },
    { literal: "users" },
  ])
  expect(FileRouter.segmentPath("(auth)/login/(step1)")).toEqual([
    { group: "auth" },
    { literal: "login" },
    { group: "step1" },
  ])
})

test("route handles", () => {
  expect(FileRouter.segmentPath("route.ts")).toEqual([{ handle: "route" }])
  expect(FileRouter.segmentPath("/api/route.js")).toEqual([
    { literal: "api" },
    { handle: "route" },
  ])
  expect(FileRouter.segmentPath("route.tsx")).toEqual([{ handle: "route" }])
})

test("layer handles", () => {
  expect(FileRouter.segmentPath("layer.tsx")).toEqual([{ handle: "layer" }])
  expect(FileRouter.segmentPath("layer.jsx")).toEqual([{ handle: "layer" }])
  expect(FileRouter.segmentPath("layer.js")).toEqual([{ handle: "layer" }])
  expect(FileRouter.segmentPath("/blog/layer.jsx")).toEqual([
    { literal: "blog" },
    { handle: "layer" },
  ])
})

test("complex combinations", () => {
  expect(FileRouter.segmentPath("/users/[userId]/posts/route.tsx")).toEqual([
    { literal: "users" },
    { param: "userId" },
    { literal: "posts" },
    { handle: "route" },
  ])
  expect(FileRouter.segmentPath("/api/v1/[[...path]]/route.ts")).toEqual([
    { literal: "api" },
    { literal: "v1" },
    { rest: "path", optional: true },
    { handle: "route" },
  ])
  expect(FileRouter.segmentPath("(admin)/users/route.tsx")).toEqual([
    { group: "admin" },
    { literal: "users" },
    { handle: "route" },
  ])
})

test("invalid paths", () => {
  expect(() => FileRouter.segmentPath("$...")).toThrow()
  expect(() => FileRouter.segmentPath("invalid%char")).toThrow()
})

test("param and rest types", () => {
  expect(FileRouter.segmentPath("[a]")).toEqual([{ param: "a" }])
  expect(FileRouter.segmentPath("[...rest]")).toEqual([{ rest: "rest" }])
  expect(FileRouter.segmentPath("[[...rest]]")).toEqual([
    { rest: "rest", optional: true },
  ])
})

test("extractRoute - users/route.ts", () => {
  expect(FileRouter.segmentPath("users/route.ts")).toEqual([
    { literal: "users" },
    { handle: "route" },
  ])
})

test("segments with extensions", () => {
  expect(FileRouter.segmentPath("events.json/route.ts")).toEqual([
    { literal: "events.json" },
    { handle: "route" },
  ])
  expect(FileRouter.segmentPath("config.yaml.backup/route.ts")).toEqual([
    { literal: "config.yaml.backup" },
    { handle: "route" },
  ])
})
