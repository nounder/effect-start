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
  expect(
    FileRouter.segmentPath("path with spaces"),
  )
    .toEqual(null)
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
        extension: "ts",
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
        extension: "js",
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
        extension: "js",
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
        extension: "tsx",
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
        extension: "jsx",
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
        extension: "js",
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
        extension: "jsx",
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
        extension: "tsx",
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
        extension: "ts",
      },
    ])
})

test("invalid paths", () => {
  expect(
    FileRouter.segmentPath("/$..."),
  )
    .toEqual(null) // $... is no longer valid
  expect(
    FileRouter.segmentPath("invalid.ts"),
  )
    .toEqual(null) // Invalid handle
  expect(
    FileRouter.segmentPath("abc/def/$a/$/page.xyz"),
  )
    .toEqual(null) // Invalid extension
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
  expect(
    FileRouter.segmentPath("$..."),
  )
    .toEqual(null) // $... is no longer valid
  expect(
    FileRouter.segmentPath("$...ab"),
  )
    .toEqual(null) // $...ab is no longer valid
})

test("route validation - valid routes without splat", () => {
  expect(
    FileRouter.segmentPath("_page.tsx"),
  )
    .toEqual([
      {
        type: "PageHandle",
        text: "_page.tsx",
        handle: "page",
        extension: "tsx",
      },
    ])

  expect(
    FileRouter.segmentPath("users/$id/_page.tsx"),
  )
    .toEqual([
      { type: "Literal", text: "users" },
      { type: "Param", param: "id", text: "$id" },
      {
        type: "PageHandle",
        text: "_page.tsx",
        handle: "page",
        extension: "tsx",
      },
    ])
})

test("route validation - valid routes with splat", () => {
  expect(
    FileRouter.segmentPath("$/_page.tsx"),
  )
    .toEqual([
      { type: "Splat", text: "$" },
      {
        type: "PageHandle",
        text: "_page.tsx",
        handle: "page",
        extension: "tsx",
      },
    ])

  expect(
    FileRouter.segmentPath("users/$id/$/_page.tsx"),
  )
    .toEqual([
      {
        type: "Literal",
        text: "users",
      },
      {
        type: "Param",
        param: "id",
        text: "$id",
      },
      {
        type: "Splat",
        text: "$",
      },
      {
        type: "PageHandle",
        text: "_page.tsx",
        handle: "page",
        extension: "tsx",
      },
    ])

  expect(
    FileRouter.segmentPath("api/$version/$/_server.ts"),
  )
    .toEqual([
      { type: "Literal", text: "api" },
      { type: "Param", param: "version", text: "$version" },
      { type: "Splat", text: "$" },
      {
        type: "ServerHandle",
        text: "_server.ts",
        handle: "server",
        extension: "ts",
      },
    ])
})

test("route validation - invalid routes with splat in wrong position", () => {
  // Splat must be the last segment before handle
  expect(
    FileRouter.parseRoute("$/users/_page.tsx"),
  )
    .toEqual(null)
  expect(
    FileRouter.parseRoute("docs/$/extra/_page.tsx"),
  )
    .toEqual(null)
  expect(
    FileRouter.parseRoute("api/$/v1/$id/_server.ts"),
  )
    .toEqual(null)
})

test("route validation - routes without handles", () => {
  expect(
    FileRouter.parseRoute("users"),
  )
    .toEqual(null)
  expect(
    FileRouter.parseRoute("users/$userId"),
  )
    .toEqual(null)
  expect(
    FileRouter.parseRoute("docs/$"),
  )
    .toEqual(null)
})

test("route validation - invalid file extensions", () => {
  expect(
    FileRouter.parseRoute("_page.py"),
  )
    .toEqual(null)
  expect(
    FileRouter.parseRoute("_server.exe"),
  )
    .toEqual(null)
  expect(
    FileRouter.parseRoute("_layout.html"),
  )
    .toEqual(null)
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
        extension: "ts",
      },
    ])
})
