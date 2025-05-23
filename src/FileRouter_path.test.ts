import {
  describe,
  expect,
  test,
} from "bun:test"
import {
  extractRoute,
  parsePath,
} from "./FileRouter.ts"

test("empty path as null", () => {
  expect(
    parsePath(""),
  )
    .toEqual([])
  expect(
    parsePath("/"),
  )
    .toEqual([])
})

test("literal segments", () => {
  expect(
    parsePath("users"),
  )
    .toEqual([{ type: "Literal", text: "users" }])
  expect(
    parsePath("/users"),
  )
    .toEqual([{
      type: "Literal",
      text: "users",
    }])
  expect(
    parsePath("users/"),
  )
    .toEqual([{
      type: "Literal",
      text: "users",
    }])
  expect(
    parsePath("/users/create"),
  )
    .toEqual([
      { type: "Literal", text: "users" },
      { type: "Literal", text: "create" },
    ])
  expect(
    parsePath("path with spaces"),
  )
    .toEqual(null)
})

test("dynamic parameters", () => {
  expect(
    parsePath("$userId"),
  )
    .toEqual([
      { type: "Param", param: "userId", text: "$userId" },
    ])
  expect(
    parsePath("/users/$userId"),
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
    parsePath("/posts/$postId/comments/$commentId"),
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
    parsePath("$"),
  )
    .toEqual([
      {
        type: "Splat",
        text: "$",
      },
    ])
  expect(
    parsePath("/docs/$"),
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
    parsePath("/user/$/details"),
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
    parsePath("/$"),
  )
    .toEqual([
      {
        type: "Splat",
        text: "$",
      },
    ])
  expect(
    parsePath("/test/$"),
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
    parsePath("_server.ts"),
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
    parsePath("/api/_server.js"),
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
    parsePath("_server.js"),
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
    parsePath("_page.tsx"),
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
    parsePath("_page.jsx"),
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
    parsePath("_page.js"),
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
    parsePath("/blog/_page.jsx"),
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
    parsePath("/users/$userId/posts/_page.tsx"),
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
    parsePath("/api/v1/$/_server.ts"),
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
    parsePath("/$..."),
  )
    .toEqual(null) // $... is no longer valid
  expect(
    parsePath("invalid.ts"),
  )
    .toEqual(null) // Invalid handle
  expect(
    parsePath("abc/def/$a/$/page.xyz"),
  )
    .toEqual(null) // Invalid extension
})

test("leading/trailing/multiple slashes", () => {
  expect(
    parsePath("//users///$id//"),
  )
    .toEqual([
      { type: "Literal", text: "users" },
      { type: "Param", param: "id", text: "$id" },
    ])
})

test("param and splat types", () => {
  // Splat is just $
  expect(
    parsePath("$"),
  )
    .toEqual([{
      type: "Splat",
      text: "$",
    }]) // $ is now a valid Splat

  // Min length for Param $a is 2
  expect(
    parsePath("$a"),
  )
    .toEqual([{
      type: "Param",
      param: "a",
      text: "$a",
    }])

  // Splat variations that are no longer valid
  expect(
    parsePath("$..."),
  )
    .toEqual(null) // $... is no longer valid
  expect(
    parsePath("$...ab"),
  )
    .toEqual(null) // $...ab is no longer valid
})

test("route validation - valid routes without splat", () => {
  expect(
    extractRoute("_page.tsx"),
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
    extractRoute("users/$id/_page.tsx"),
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
    extractRoute("$/_page.tsx"),
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
    extractRoute("users/$id/$/_page.tsx"),
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
    extractRoute("api/$version/$/_server.ts"),
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
    extractRoute("$/users/_page.tsx"),
  )
    .toEqual(null)
  expect(
    extractRoute("docs/$/extra/_page.tsx"),
  )
    .toEqual(null)
  expect(
    extractRoute("api/$/v1/$id/_server.ts"),
  )
    .toEqual(null)
})

test("route validation - routes without handles", () => {
  expect(
    extractRoute("users"),
  )
    .toEqual(null)
  expect(
    extractRoute("users/$userId"),
  )
    .toEqual(null)
  expect(
    extractRoute("docs/$"),
  )
    .toEqual(null)
})

test("route validation - invalid file extensions", () => {
  expect(
    extractRoute("_page.py"),
  )
    .toEqual(null)
  expect(
    extractRoute("_server.exe"),
  )
    .toEqual(null)
  expect(
    extractRoute("_layout.html"),
  )
    .toEqual(null)
})

test("extractRoute - users/_server.ts", () => {
  expect(
    extractRoute("users/_server.ts"),
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
