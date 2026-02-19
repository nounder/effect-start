import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as FileRouter from "../src/FileRouter.ts"
import * as FileRouterCodegen from "../src/FileRouterCodegen.ts"

const getRoutes = (paths: Array<string>) => Effect.runSync(FileRouter.getFileRoutes(paths))

test.describe("generateCode", () => {
  test.it("generates code for simple routes", () => {
    const routes = getRoutes(["route.tsx", "about/route.tsx", "users/route.tsx"])

    const code = FileRouterCodegen.generateCode(routes)

    test.expect(code).toContain(`  "/": [
    () => import("./route.tsx"),
  ]`)
    test.expect(code).toContain(`  "/about": [
    () => import("./about/route.tsx"),
  ]`)
    test.expect(code).toContain(`  "/users": [
    () => import("./users/route.tsx"),
  ]`)
  })

  test.it("includes layers in route entries", () => {
    const routes = getRoutes(["layer.tsx", "about/route.tsx", "users/route.tsx", "users/layer.tsx"])

    const code = FileRouterCodegen.generateCode(routes)

    test.expect(code).toContain(`  "/about": [
    () => import("./about/route.tsx"),
    () => import("./layer.tsx"),
  ]`)
    test.expect(code).toContain(`  "/users": [
    () => import("./users/route.tsx"),
    () => import("./users/layer.tsx"),
    () => import("./layer.tsx"),
  ]`)
  })

  test.it("handles param segments", () => {
    const routes = getRoutes(["users/[userId]/route.tsx"])

    const code = FileRouterCodegen.generateCode(routes)

    test.expect(code).toContain(`  "/users/:userId": [
    () => import("./users/[userId]/route.tsx"),
  ]`)
  })

  test.it("handles deep nesting with layers", () => {
    const routes = getRoutes([
      "layer.tsx",
      "users/route.tsx",
      "users/layer.tsx",
      "users/[userId]/route.tsx",
    ])

    const code = FileRouterCodegen.generateCode(routes)

    test.expect(code).toContain(`  "/users": [
    () => import("./users/route.tsx"),
    () => import("./users/layer.tsx"),
    () => import("./layer.tsx"),
  ]`)
    test.expect(code).toContain(`  "/users/:userId": [
    () => import("./users/[userId]/route.tsx"),
    () => import("./users/layer.tsx"),
    () => import("./layer.tsx"),
  ]`)
  })

  test.it("handles rest segments", () => {
    const routes = getRoutes(["docs/[[path]]/route.tsx"])

    const code = FileRouterCodegen.generateCode(routes)

    test.expect(code).toContain(`  "/docs/:path*": [
    () => import("./docs/[[path]]/route.tsx"),
  ]`)
  })

  test.it("handles root-level catch-all route", () => {
    const routes = getRoutes(["route.tsx", "[[404]]/route.tsx"])

    const code = FileRouterCodegen.generateCode(routes)

    test.expect(code).toContain(`  "/": [
    () => import("./route.tsx"),
  ]`)
    test.expect(code).toContain(`  "/:404*": [
    () => import("./[[404]]/route.tsx"),
  ]`)
  })

  test.it("strips groups from path pattern but keeps in module path", () => {
    const routes = getRoutes(["(admin)/users/route.tsx"])

    const code = FileRouterCodegen.generateCode(routes)

    test.expect(code).toContain(`  "/users": [
    () => import("./(admin)/users/route.tsx"),
  ]`)
  })

  test.it("group layers only apply to routes within the group", () => {
    const routes = getRoutes([
      "users/route.tsx",
      "(admin)/layer.tsx",
      "(admin)/users/manage/route.tsx",
    ])

    const code = FileRouterCodegen.generateCode(routes)

    // /users should NOT have the (admin)/layer.tsx
    test.expect(code).toContain(`  "/users": [
    () => import("./users/route.tsx"),
  ]`)

    // /users/manage should inherit (admin)/layer.tsx
    test.expect(code).toContain(`  "/users/manage": [
    () => import("./(admin)/users/manage/route.tsx"),
    () => import("./(admin)/layer.tsx"),
  ]`)
  })

  test.it("returns null for empty routes", () => {
    const routes = getRoutes([])

    const code = FileRouterCodegen.generateCode(routes)

    test.expect(code).toBeNull()
  })

  test.it("returns null for routes with only layers", () => {
    const routes = getRoutes(["layer.tsx", "users/layer.tsx"])

    const code = FileRouterCodegen.generateCode(routes)

    test.expect(code).toBeNull()
  })

  test.it("generates valid TypeScript with satisfies", () => {
    const routes = getRoutes(["route.tsx"])

    const code = FileRouterCodegen.generateCode(routes)

    test.expect(code).toContain(`} satisfies import("effect-start/FileRouter").FileRoutes`)
  })

  test.it("multiple groups with layers only apply to their own routes", () => {
    const routes = getRoutes([
      "(admin)/layer.tsx",
      "(public)/layer.tsx",
      "(admin)/users/route.tsx",
      "(public)/home/route.tsx",
    ])

    const code = FileRouterCodegen.generateCode(routes)

    // /users should only get (admin)/layer.tsx
    test.expect(code).toContain(`  "/users": [
    () => import("./(admin)/users/route.tsx"),
    () => import("./(admin)/layer.tsx"),
  ]`)

    // /home should only get (public)/layer.tsx
    test.expect(code).toContain(`  "/home": [
    () => import("./(public)/home/route.tsx"),
    () => import("./(public)/layer.tsx"),
  ]`)
  })

  test.it("nested groups", () => {
    const routes = getRoutes([
      "(admin)/layer.tsx",
      "(admin)/(internal)/layer.tsx",
      "(admin)/(internal)/users/route.tsx",
    ])

    const code = FileRouterCodegen.generateCode(routes)

    // Should get both layers, inner first then outer
    test.expect(code).toContain(`  "/users": [
    () => import("./(admin)/(internal)/users/route.tsx"),
    () => import("./(admin)/(internal)/layer.tsx"),
    () => import("./(admin)/layer.tsx"),
  ]`)
  })

  test.it("layer at group root applies to group root route", () => {
    const routes = getRoutes(["(admin)/layer.tsx", "(admin)/route.tsx"])

    const code = FileRouterCodegen.generateCode(routes)

    test.expect(code).toContain(`  "/": [
    () => import("./(admin)/route.tsx"),
    () => import("./(admin)/layer.tsx"),
  ]`)
  })

  test.it("multiple rest routes ordered by depth", () => {
    const routes = getRoutes(["route.tsx", "docs/[[path]]/route.tsx", "[[404]]/route.tsx"])

    const code = FileRouterCodegen.generateCode(routes)

    test.expect(code).toBe(`/**
 * Auto-generated by effect-start on startup and changes. Do not edit manually.
 */

export default {
  "/": [
    () => import("./route.tsx"),
  ],
  "/docs/:path*": [
    () => import("./docs/[[path]]/route.tsx"),
  ],
  "/:404*": [
    () => import("./[[404]]/route.tsx"),
  ],
} satisfies import("effect-start/FileRouter").FileRoutes
`)
  })
})
