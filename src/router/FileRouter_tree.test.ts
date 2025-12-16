import * as t from "bun:test"
import * as FileRouter from "./FileRouter.ts"

t.it("tree with root only", () => {
  const handles = [
    "route.tsx",
    "layer.tsx",
  ]
    .map(FileRouter.parseRoute)
  const tree = FileRouter.treeFromRouteHandles(handles)

  t.expect(tree).toEqual({
    path: "/",
    handles: [
      t.expect.objectContaining({
        handle: "route",
      }),
      t.expect.objectContaining({
        handle: "layer",
      }),
    ],
  })
})

t.it("tree without root", () => {
  const handles = []
    .map(FileRouter.parseRoute)
  const tree = FileRouter.treeFromRouteHandles(handles)

  t.expect(tree).toEqual({
    path: "/",
    handles: [],
  })
})

t.it("deep tree", () => {
  const handles = [
    "users/route.tsx",
    "users/layer.tsx",
    "users/[userId]/route.tsx",
    "layer.tsx",
  ]
    .map(FileRouter.parseRoute)
  const tree = FileRouter.treeFromRouteHandles(handles)

  t.expect(tree).toEqual({
    path: "/",
    handles: [
      t.expect.objectContaining({
        handle: "layer",
      }),
    ],
    children: [
      {
        path: "/users",
        handles: [
          t.expect.objectContaining({
            handle: "route",
          }),
          t.expect.objectContaining({
            handle: "layer",
          }),
        ],
        children: [
          {
            path: "/[userId]",
            handles: [
              t.expect.objectContaining({
                handle: "route",
              }),
            ],
          },
        ],
      },
    ],
  })
})

t.it("throws on overlapping routes from groups", () => {
  t
    .expect(() => {
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

t.it("throws on overlapping routes with same path", () => {
  t
    .expect(() => {
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

t.it("allows route and layer at same path", () => {
  t
    .expect(() => {
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
