import {
  describe,
  expect,
  test,
} from "bun:test"
import * as FileRouter from "./FileRouter.ts"

const Paths = [
  "about/_layout.tsx",
  "about/_page.tsx",
  "users/_page.tsx",
  "users/_layout.tsx",
  "users/$userId/_page.tsx",
  "_layout.tsx",
]

test.skip("treeFromRouteHandles", () => {
  const handles = Paths.map(FileRouter.parseRoute)
  const tree = FileRouter.treeFromRouteHandles(handles)
  expect(tree).toEqual({
    children: [
      { path: "/about", children: [] },
    ],
  })
})
