import { describe, expect, test } from "bun:test"
import { extractSegments } from "./FileRouter.ts"
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
  expect(extractSegments("[userId]")).toEqual([
    { type: "DynamicParam", param: "userId", text: "[userId]" },
  ])
  expect(extractSegments("/users/[userId]")).toEqual([
    { type: "Literal", text: "users" },
    { type: "DynamicParam", param: "userId", text: "[userId]" },
  ])
  expect(extractSegments("/posts/[postId]/comments/[commentId]")).toEqual([
    { type: "Literal", text: "posts" },
    { type: "DynamicParam", param: "postId", text: "[postId]" },
    { type: "Literal", text: "comments" },
    { type: "DynamicParam", param: "commentId", text: "[commentId]" },
  ])
})

test("optional parameters", () => {
  expect(extractSegments("[[id]]")).toEqual([
    { type: "OptionalParam", param: "id", text: "[[id]]" },
  ])
  expect(extractSegments("/items/[[itemId]]")).toEqual([
    { type: "Literal", text: "items" },
    { type: "OptionalParam", param: "itemId", text: "[[itemId]]" },
  ])
  expect(extractSegments("/categories/[[categoryId]]/products/[[productId]]"))
    .toEqual([
      { type: "Literal", text: "categories" },
      { type: "OptionalParam", param: "categoryId", text: "[[categoryId]]" },
      { type: "Literal", text: "products" },
      { type: "OptionalParam", param: "productId", text: "[[productId]]" },
    ])
})

test("rest parameters", () => {
  expect(extractSegments("[...files]")).toEqual([
    { type: "RestParam", param: "files", text: "[...files]" },
  ])
  expect(extractSegments("/docs/[...slug]")).toEqual([
    { type: "Literal", text: "docs" },
    { type: "RestParam", param: "slug", text: "[...slug]" },
  ])
  expect(extractSegments("/user/[...path]/details")).toEqual([
    { type: "Literal", text: "user" },
    { type: "RestParam", param: "path", text: "[...path]" },
    { type: "Literal", text: "details" },
  ])
})

test("server handles", () => {
  expect(extractSegments("server.ts")).toEqual([
    { type: "ServerHandle", extension: "ts" },
  ])
  expect(extractSegments("/api/server.js")).toEqual([
    { type: "Literal", text: "api" },
    { type: "ServerHandle", extension: "js" },
  ])
})

test("page handles", () => {
  expect(extractSegments("page.tsx")).toEqual([
    { type: "PageHandle", extension: "tsx" },
  ])
  expect(extractSegments("/blog/page.jsx")).toEqual([
    { type: "Literal", text: "blog" },
    { type: "PageHandle", extension: "jsx" },
  ])
})

test("complex combinations", () => {
  expect(extractSegments("/users/[userId]/posts/[[postId]]/page.tsx")).toEqual(
    [
      { type: "Literal", text: "users" },
      { type: "DynamicParam", param: "userId", text: "[userId]" },
      { type: "Literal", text: "posts" },
      { type: "OptionalParam", param: "postId", text: "[[postId]]" },
      { type: "PageHandle", extension: "tsx" },
    ],
  )
  expect(extractSegments("/api/v1/[...proxy]/server.ts")).toEqual([
    { type: "Literal", text: "api" },
    { type: "Literal", text: "v1" },
    { type: "RestParam", param: "proxy", text: "[...proxy]" },
    { type: "ServerHandle", extension: "ts" },
  ])
})

test("invalid paths", () => {
  expect(extractSegments("/[")).toEqual(null) // Unterminated dynamic
  expect(extractSegments("/test/[]")).toEqual(null) // Empty dynamic
  expect(extractSegments("/[[name")).toEqual(null) // Unterminated optional
  expect(extractSegments("/test/[[]]")).toEqual(null) // Empty optional
  expect(extractSegments("/test/[[...name]]")).toEqual(null) // Was: Literal for test, Literal for [[...name]]. Now invalid.
  expect(extractSegments("/[...path")).toEqual(null) // Unterminated rest
  expect(extractSegments("invalid.ts")).toEqual(null) // Invalid handle
  expect(extractSegments("abc/def/[a]/[...b]/[[c]]/page.xyz")).toEqual(null) // Invalid extension
})

test("leading/trailing/multiple slashes", () => {
  expect(extractSegments("//users///[id]//")).toEqual([
    { type: "Literal", text: "users" },
    { type: "DynamicParam", param: "id", text: "[id]" },
  ])
})

test("param types and misclassification", () => {
  // These look like optional/rest but are not, so should be literal
  // With stricter literal rule, these (containing [ or ]) become null if not valid params.
  expect(extractSegments("[[...test]]")).toEqual(null) // Was: Literal. Now invalid (mixed optional/rest like syntax).
  expect(extractSegments("f[...test]")).toEqual(null) // Was: Literal. Now invalid (contains [ and ] but not valid param).
  expect(extractSegments("[...test]g]")).toEqual(null)
  expect(extractSegments("f[[test]]")).toEqual(null) // Was: Literal. Now invalid (contains [ and ] but not valid param).
  expect(extractSegments("[[test]]g")).toEqual(null) // Was: Literal. Now invalid (contains [ and ] but not valid param).

  // Min length for DynamicParam [a] is 3
  expect(extractSegments("[]")).toEqual(null)
  expect(extractSegments("[a]")).toEqual([{
    type: "DynamicParam",
    param: "a",
    text: "[a]",
  }])
  expect(extractSegments("[[]]")).toEqual(null) // This is an invalid optional, not dynamic
  expect(extractSegments("[[a]]")).toEqual([{
    type: "OptionalParam",
    param: "a",
    text: "[[a]]",
  }])

  // Min length for OptionalParam [[a]] is 5
  expect(extractSegments("[[]]")).toEqual(null)
  expect(extractSegments("[[a]]")).toEqual([{
    type: "OptionalParam",
    param: "a",
    text: "[[a]]",
  }])
  expect(extractSegments("[[ab]]")).toEqual([{
    type: "OptionalParam",
    param: "ab",
    text: "[[ab]]",
  }])

  // Min length for RestParam [...a] is 5
  expect(extractSegments("[...]")).toEqual(null)
  expect(extractSegments("[...a]")).toEqual([{
    type: "RestParam",
    param: "a",
    text: "[...a]",
  }])
  expect(extractSegments("[...ab]")).toEqual([{
    type: "RestParam",
    param: "ab",
    text: "[...ab]",
  }])

  // Ensure no misclassification between param types
  // This was expect(parsePath("[[...slug]]")).toEqual([{ type: "Literal", text: "[[...slug]]" }])
  // Now, like [[...test]], it should be null.
  expect(extractSegments("[[...slug]]")).toEqual(null)
})
