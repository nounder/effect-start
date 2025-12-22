import * as test from "bun:test"
import * as FileRouter from "./FileRouter.ts"

test.it("tree with root only", () => {
  const handles = [
    "route.tsx",
    "layer.tsx",
  ]
    .map(FileRouter.parseRoute)
  const tree = FileRouter.treeFromRouteHandles(handles)

  test
    .expect(tree)
    .toEqual({
      path: "/",
      handles: [
        test.expect.objectContaining({
          handle: "route",
        }),
        test.expect.objectContaining({
          handle: "layer",
        }),
      ],
    })
})

test.it("tree without root", () => {
  const handles = []
    .map(FileRouter.parseRoute)
  const tree = FileRouter.treeFromRouteHandles(handles)

  test
    .expect(tree)
    .toEqual({
      path: "/",
      handles: [],
    })
})

test.it("deep tree", () => {
  const handles = [
    "users/route.tsx",
    "users/layer.tsx",
    "users/[userId]/route.tsx",
    "layer.tsx",
  ]
    .map(FileRouter.parseRoute)
  const tree = FileRouter.treeFromRouteHandles(handles)

  test
    .expect(tree)
    .toEqual({
      path: "/",
      handles: [
        test.expect.objectContaining({
          handle: "layer",
        }),
      ],
      children: [
        {
          path: "/users",
          handles: [
            test.expect.objectContaining({
              handle: "route",
            }),
            test.expect.objectContaining({
              handle: "layer",
            }),
          ],
          children: [
            {
              path: "/[userId]",
              handles: [
                test.expect.objectContaining({
                  handle: "route",
                }),
              ],
            },
          ],
        },
      ],
    })
})

test.it("throws on overlapping routes from groups", () => {
  test
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

test.it("throws on overlapping routes with same path", () => {
  test
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

test.it("allows route and layer at same path", () => {
  test
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
