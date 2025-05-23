import {
  describe,
  expect,
  test,
} from "bun:test"
import {
  extractSegments,
} from "./FileRouter.ts"
test("empty path as null", () => {
  expect(extractSegments("")).toEqual([])
  expect(extractSegments("/")).toEqual([])
})

test("literal segments", () => {
  expect(extractSegments("users")).toEqual([{ type: "Literal", text: "users" }])
  expect(extractSegments("/users")).toEqual([{
    type: "Literal",
    text: "users",
  }])
  expect(extractSegments("users/")).toEqual([{
    type: "Literal",
    text: "users",
  }])
  expect(extractSegments("/users/create")).toEqual([
    { type: "Literal", text: "users" },
    { type: "Literal", text: "create" },
  ])
  expect(extractSegments("path with spaces")).toEqual(null)
})

test("dynamic parameters", () => {
  expect(extractSegments("$userId")).toEqual([
    { type: "Param", param: "userId", text: "$userId" },
  ])
  expect(extractSegments("/users/$userId")).toEqual([
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
  expect(extractSegments("/posts/$postId/comments/$commentId")).toEqual([
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
  expect(extractSegments("$")).toEqual([
    {
      type: "Splat",
      text: "$",
    },
  ])
  expect(extractSegments("/docs/$")).toEqual([
    {
      type: "Literal",
      text: "docs",
    },
    {
      type: "Splat",
      text: "$",
    },
  ])
  expect(extractSegments("/user/$/details")).toEqual([
    { type: "Literal", text: "user" },
    {
      type: "Splat",
      text: "$",
    },
    { type: "Literal", text: "details" },
  ])
  expect(extractSegments("/$")).toEqual([
    {
      type: "Splat",
      text: "$",
    },
  ])
  expect(extractSegments("/test/$")).toEqual([
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
  expect(extractSegments("server.ts")).toEqual([
    {
      type: "ServerHandle",
      extension: "ts",
    },
  ])
  expect(extractSegments("/api/server.js")).toEqual([
    {
      type: "Literal",
      text: "api",
    },
    {
      type: "ServerHandle",
      extension: "js",
    },
  ])
})

test("page handles", () => {
  expect(extractSegments("page.tsx")).toEqual([
    {
      type: "PageHandle",
      extension: "tsx",
    },
  ])
  expect(extractSegments("/blog/page.jsx")).toEqual([
    {
      type: "Literal",
      text: "blog",
    },
    {
      type: "PageHandle",
      extension: "jsx",
    },
  ])
})

test("complex combinations", () => {
  expect(extractSegments("/users/$userId/posts/page.tsx")).toEqual(
    [
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
        extension: "tsx",
      },
    ],
  )
  expect(extractSegments("/api/v1/$/server.ts")).toEqual([
    { type: "Literal", text: "api" },
    { type: "Literal", text: "v1" },
    { type: "Splat", text: "$" },
    { type: "ServerHandle", extension: "ts" },
  ])
})

test("invalid paths", () => {
  expect(extractSegments("/$...")).toEqual(null) // $... is no longer valid
  expect(extractSegments("invalid.ts")).toEqual(null) // Invalid handle
  expect(extractSegments("abc/def/$a/$/page.xyz")).toEqual(null) // Invalid extension
})

test("leading/trailing/multiple slashes", () => {
  expect(extractSegments("//users///$id//")).toEqual([
    { type: "Literal", text: "users" },
    { type: "Param", param: "id", text: "$id" },
  ])
})

test("param and splat types", () => {
  // Splat is just $
  expect(extractSegments("$")).toEqual([{
    type: "Splat",
    text: "$",
  }]) // $ is now a valid Splat

  // Min length for Param $a is 2
  expect(extractSegments("$a")).toEqual([{
    type: "Param",
    param: "a",
    text: "$a",
  }])

  // Splat variations that are no longer valid
  expect(extractSegments("$...")).toEqual(null) // $... is no longer valid
  expect(extractSegments("$...ab")).toEqual(null) // $...ab is no longer valid
})
