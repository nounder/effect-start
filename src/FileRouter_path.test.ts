import {
  describe,
  expect,
  test,
} from "bun:test"
import * as FileRouter from "./FileRouter.ts"

test("empty path as null", () => {
  expect(
    FileRouter.segmentPath(""),
  )
    .toEqual([])
  expect(
    FileRouter.segmentPath("/"),
  )
    .toEqual([])
})

test("literal segments", () => {
  expect(
    FileRouter.segmentPath("users"),
  )
    .toEqual([{ type: "Literal", text: "users" }])
  expect(
    FileRouter.segmentPath("/users"),
  )
    .toEqual([{
      type: "Literal",
      text: "users",
    }])
  expect(
    FileRouter.segmentPath("users/"),
  )
    .toEqual([{
      type: "Literal",
      text: "users",
    }])
  expect(
    FileRouter.segmentPath("/users/create"),
  )
    .toEqual([
      { type: "Literal", text: "users" },
      { type: "Literal", text: "create" },
    ])
  expect(() => FileRouter.segmentPath("path with spaces"))
    .toThrow()
})

test("dynamic parameters", () => {
  expect(
    FileRouter.segmentPath("$userId"),
  )
    .toEqual([
      { type: "Param", param: "userId", text: "$userId" },
    ])
  expect(
    FileRouter.segmentPath("/users/$userId"),
  )
    .toEqual([
      {
        type: "Literal",
        text: "users",
      },
      {
        type: "Param",
        param: "userId",
        text: "$userId",
      },
    ])
  expect(
    FileRouter.segmentPath("/posts/$postId/comments/$commentId"),
  )
    .toEqual([
      {
        type: "Literal",
        text: "posts",
      },
      {
        type: "Param",
        param: "postId",
        text: "$postId",
      },
      {
        type: "Literal",
        text: "comments",
      },
      {
        type: "Param",
        param: "commentId",
        text: "$commentId",
      },
    ])
})

test("rest parameters", () => {
  expect(
    FileRouter.segmentPath("$"),
  )
    .toEqual([
      {
        type: "Splat",
        text: "$",
      },
    ])
  expect(
    FileRouter.segmentPath("/docs/$"),
  )
    .toEqual([
      {
        type: "Literal",
        text: "docs",
      },
      {
        type: "Splat",
        text: "$",
      },
    ])
  expect(
    FileRouter.segmentPath("/user/$/details"),
  )
    .toEqual([
      { type: "Literal", text: "user" },
      {
        type: "Splat",
        text: "$",
      },
      { type: "Literal", text: "details" },
    ])
  expect(
    FileRouter.segmentPath("/$"),
  )
    .toEqual([
      {
        type: "Splat",
        text: "$",
      },
    ])
  expect(
    FileRouter.segmentPath("/test/$"),
  )
    .toEqual([
      {
        type: "Literal",
        text: "test",
      },
      {
        type: "Splat",
        text: "$",
      },
    ])
})

test("server handles", () => {
  expect(
    FileRouter.segmentPath("_server.ts"),
  )
    .toEqual([
      {
        type: "ServerHandle",
        text: "_server.ts",
        handle: "server",
      },
    ])
  expect(
    FileRouter.segmentPath("/api/_server.js"),
  )
    .toEqual([
      {
        type: "Literal",
        text: "api",
      },
      {
        type: "ServerHandle",
        text: "_server.js",
        handle: "server",
      },
    ])
  expect(
    FileRouter.segmentPath("_server.js"),
  )
    .toEqual([
      {
        type: "ServerHandle",
        text: "_server.js",
        handle: "server",
      },
    ])
})

test("page handles", () => {
  expect(
    FileRouter.segmentPath("_page.tsx"),
  )
    .toEqual([
      {
        type: "PageHandle",
        text: "_page.tsx",
        handle: "page",
      },
    ])
  expect(
    FileRouter.segmentPath("_page.jsx"),
  )
    .toEqual([
      {
        type: "PageHandle",
        text: "_page.jsx",
        handle: "page",
      },
    ])
  expect(
    FileRouter.segmentPath("_page.js"),
  )
    .toEqual([
      {
        type: "PageHandle",
        text: "_page.js",
        handle: "page",
      },
    ])
  expect(
    FileRouter.segmentPath("/blog/_page.jsx"),
  )
    .toEqual([
      { type: "Literal", text: "blog" },
      {
        type: "PageHandle",
        text: "_page.jsx",
        handle: "page",
      },
    ])
})

test("complex combinations", () => {
  expect(
    FileRouter.segmentPath("/users/$userId/posts/_page.tsx"),
  )
    .toEqual([
      {
        type: "Literal",
        text: "users",
      },
      {
        type: "Param",
        param: "userId",
        text: "$userId",
      },
      {
        type: "Literal",
        text: "posts",
      },
      {
        type: "PageHandle",
        text: "_page.tsx",
        handle: "page",
      },
    ])
  expect(
    FileRouter.segmentPath("/api/v1/$/_server.ts"),
  )
    .toEqual([
      {
        type: "Literal",
        text: "api",
      },
      {
        type: "Literal",
        text: "v1",
      },
      {
        type: "Splat",
        text: "$",
      },
      {
        type: "ServerHandle",
        text: "_server.ts",
        handle: "server",
      },
    ])
})

test("invalid paths", () => {
  expect(() => FileRouter.segmentPath("/$..."))
    .toThrow() // $... is no longer valid
  expect(() => FileRouter.segmentPath("invalid%char"))
    .toThrow() // Invalid character
})

test("leading/trailing/multiple slashes", () => {
  expect(
    FileRouter.segmentPath("//users///$id//"),
  )
    .toEqual([
      { type: "Literal", text: "users" },
      { type: "Param", param: "id", text: "$id" },
    ])
})

test("param and splat types", () => {
  // Splat is just $
  expect(
    FileRouter.segmentPath("$"),
  )
    .toEqual([{
      type: "Splat",
      text: "$",
    }]) // $ is now a valid Splat

  // Min length for Param $a is 2
  expect(
    FileRouter.segmentPath("$a"),
  )
    .toEqual([{
      type: "Param",
      param: "a",
      text: "$a",
    }])

  // Splat variations that are no longer valid
  expect(() => FileRouter.segmentPath("$..."))
    .toThrow() // $... is no longer valid
  expect(() => FileRouter.segmentPath("$...ab"))
    .toThrow() // $...ab is no longer valid
})

test("extractRoute - users/_server.ts", () => {
  expect(
    FileRouter.segmentPath("users/_server.ts"),
  )
    .toEqual([
      {
        type: "Literal",
        text: "users",
      },
      {
        type: "ServerHandle",
        text: "_server.ts",
        handle: "server",
      },
    ])
})

test("segments with extensions", () => {
  expect(
    FileRouter.segmentPath("events.json/_server.ts"),
  )
    .toEqual([
      {
        type: "Literal",
        text: "events.json",
      },
      {
        type: "ServerHandle",
        text: "_server.ts",
        handle: "server",
      },
    ])

  expect(
    FileRouter.segmentPath("config.yaml.backup/_server.ts"),
  )
    .toEqual([
      {
        type: "Literal",
        text: "config.yaml.backup",
      },
      {
        type: "ServerHandle",
        text: "_server.ts",
        handle: "server",
      },
    ])
})
