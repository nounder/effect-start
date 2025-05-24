import {
  describe,
  expect,
  test,
} from "bun:test"
import * as FileRouter from "./FileRouter.ts"

test("tree with root only", () => {
  const handles = [
    "_page.tsx",
    "_layout.tsx",
  ]
    .map(FileRouter.parseRoute)
  const tree = FileRouter.treeFromRouteHandles(handles)

  expect(tree).toEqual({
    path: "/",
    handles: [
      expect.objectContaining({
        type: "PageHandle",
      }),
      expect.objectContaining({
        type: "LayoutHandle",
      }),
    ],
  })
})

test("tree without root", () => {
  const handles = []
    .map(FileRouter.parseRoute)
  const tree = FileRouter.treeFromRouteHandles(handles)

  expect(tree).toEqual({
    path: "/",
    handles: [],
  })
})

test("deep tree", () => {
  const handles = [
    "users/_page.tsx",
    "users/_server.ts",
    "users/_layout.tsx",
    "users/$userId/_page.tsx",
    "_layout.tsx",
  ]
    .map(FileRouter.parseRoute)
  const tree = FileRouter.treeFromRouteHandles(handles)

  expect(tree).toEqual({
    path: "/",
    handles: [
      expect.objectContaining({
        type: "LayoutHandle",
      }),
    ],
    children: [
      {
        path: "/users",
        handles: [
          expect.objectContaining({
            type: "PageHandle",
          }),
          expect.objectContaining({
            type: "ServerHandle",
          }),
          expect.objectContaining({
            type: "LayoutHandle",
          }),
        ],
        children: [
          {
            path: "/$userId",
            handles: [
              expect.objectContaining({
                type: "PageHandle",
              }),
            ],
          },
        ],
      },
    ],
  })
})
