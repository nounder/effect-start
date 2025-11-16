import {
  expect,
  test,
} from "bun:test"
import * as FileRouter from "./FileRouter.ts"

test("tree with root only", () => {
  const handles = [
    "route.tsx",
    "layer.tsx",
  ]
    .map(FileRouter.parseRoute)
  const tree = FileRouter.treeFromRouteHandles(handles)

  expect(tree).toEqual({
    path: "/",
    handles: [
      expect.objectContaining({
        handle: "route",
      }),
      expect.objectContaining({
        handle: "layer",
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
    "users/route.tsx",
    "users/layer.tsx",
    "users/[userId]/route.tsx",
    "layer.tsx",
  ]
    .map(FileRouter.parseRoute)
  const tree = FileRouter.treeFromRouteHandles(handles)

  expect(tree).toEqual({
    path: "/",
    handles: [
      expect.objectContaining({
        handle: "layer",
      }),
    ],
    children: [
      {
        path: "/users",
        handles: [
          expect.objectContaining({
            handle: "route",
          }),
          expect.objectContaining({
            handle: "layer",
          }),
        ],
        children: [
          {
            path: "/[userId]",
            handles: [
              expect.objectContaining({
                handle: "route",
              }),
            ],
          },
        ],
      },
    ],
  })
})

test("throws on overlapping routes from groups", () => {
  expect(() => {
    const handles = [
      "(admin)/users/route.tsx",
      "users/route.tsx",
    ]
      .map(FileRouter.parseRoute)

    FileRouter.getRouteHandlesFromPaths(
      handles.map(h => h.modulePath),
    )
  })
    .toThrow("Conflicting routes detected at path /users")
})

test("throws on overlapping routes with same path", () => {
  expect(() => {
    const handles = [
      "about/route.tsx",
      "about/route.ts",
    ]
      .map(FileRouter.parseRoute)

    FileRouter.getRouteHandlesFromPaths(
      handles.map(h => h.modulePath),
    )
  })
    .toThrow("Conflicting routes detected at path /about")
})

test("allows route and layer at same path", () => {
  expect(() => {
    const handles = [
      "users/route.tsx",
      "users/layer.tsx",
    ]
      .map(FileRouter.parseRoute)

    FileRouter.getRouteHandlesFromPaths(
      handles.map(h => h.modulePath),
    )
  })
    .not
    .toThrow()
})
