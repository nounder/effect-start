import {
  createRouter,
  Outlet,
} from "@tanstack/react-router"
import {
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router"
import {
  afterEach,
  beforeEach,
  expect,
  it,
} from "bun:test"
import React from "react"
import { renderToReadableStream } from "react-dom/server"
import { parseRoute } from "../../FileRouter.ts"
import type { RouteHandle } from "../../FileRouter.ts"
import { importBlob } from "../../JsModule.ts"
import * as TanstackRouterCodegen from "./TanstackRouterCodegen.ts"

const MODULE_PREFIX = "./"

beforeEach(() => {
  // Initialize the global test component registry
  globalThis["__componentMocks"] = {}
})

afterEach(() => {
  // Clean up the global test component registry
  delete globalThis["__componentMocks"]
})

it("generates correct code for a simple flat structure", async () => {
  const handles: RouteHandle[] = [
    parseRoute("_page.tsx"),
    parseRoute("about/_page.tsx"),
  ]
  const mockComps = {
    "_page.tsx": createMockComponent("RootPage"),
    "about/_page.tsx": createMockComponent("AboutPage"),
  }

  // Test rendering root
  let html = await evalAndRender(handles, "/", mockComps)
  expect(html).toContain("RootPage")

  // Test rendering about
  html = await evalAndRender(handles, "/about", mockComps)
  expect(html).toContain("AboutPage")

  const code = TanstackRouterCodegen.generateCode(handles)

  expect(
    code,
  )
    .toContain(
      `export const route_root = createRootRoute({
  component: () => React.createElement(
    "div",
    {},
    React.createElement(Outlet),
  ),
});`,
    )

  expect(code)
    .toMatch(/const route_root_page = /)

  expect(code)
    .toMatch(/const route_about_page = /)
})

it("generate correct code for nested routes with layouts", async () => {
  const handles: RouteHandle[] = [
    parseRoute("_page.tsx"),
    parseRoute("dashboard/_layout.tsx"),
    parseRoute("dashboard/_page.tsx"),
    parseRoute("dashboard/settings/_page.tsx"),
  ]

  const mockComps = {
    "_page.tsx": createMockComponent("RootPage"),
    "dashboard/_layout.tsx": createMockComponent("DashboardLayout", true),
    "dashboard/_page.tsx": createMockComponent("DashboardPage"),
    "dashboard/settings/_page.tsx": createMockComponent("SettingsPage"),
  }

  // Test rendering root
  let html = await evalAndRender(handles, "/", mockComps)
  expect(html).toContain("RootPage")

  html = await evalAndRender(handles, "/dashboard", mockComps)
  expect(html).toContain("DashboardLayout") // Layout content
  expect(html).toContain("DashboardPage") // Page content

  html = await evalAndRender(handles, "/dashboard/settings", mockComps)
  expect(html).toContain("DashboardLayout")
  expect(html).toContain("SettingsPage")

  const code = TanstackRouterCodegen.generateCode(handles)

  expect(code).toMatch(/const route_dashboard_layout = /)

  expect(code).toMatch(/const route_dashboard_page = /)

  expect(code).toMatch(/const route_dashboard_settings_page = /)
})

it("generates code for dynamic and splat routes", async () => {
  const handles: RouteHandle[] = [
    parseRoute("posts/$postId/_page.tsx"),
    parseRoute("files/$/_page.tsx"),
  ]

  const mockComps = {
    "posts/$postId/_page.tsx": createMockComponent("PostIdPage"),
    "files/$/_page.tsx": createMockComponent("FilesSplatPage"),
  }

  // Test rendering dynamic route
  let html = await evalAndRender(handles, "/posts/abc", mockComps)
  expect(html).toContain("PostIdPage")

  // Test rendering splat route
  html = await evalAndRender(handles, "/files/a/b/c", mockComps)
  expect(html).toContain("FilesSplatPage")

  const code = TanstackRouterCodegen.generateCode(handles)
  const normalizedCodeNoSpace = code.replace(/\/\/.*$/gm, "").replace(
    /\s/g,
    "",
  )

  expect(code).toMatch(/const route_posts_\$postId_page = /)

  expect(code).toMatch(/const route_files_\$_page = /)

  const expectedRouteTreeDynamicSplat =
    `export const routeTree = route_root.addChildren([
  route_files_$_page,
  route_posts_$postId_page
]);`
  expect(normalizedCodeNoSpace)
    .toContain(expectedRouteTreeDynamicSplat.replace(/\s/g, ""))
})

it("should generate correct code for an empty array of handles", async () => {
  const handles: RouteHandle[] = []

  const html = await evalAndRender(handles, "/", {}) // No components to mock
  // Since root component is just Outlet wrapped in a div, it should be minimal but present.
  expect(html).toContain("<div>")

  const code = TanstackRouterCodegen.generateCode(handles)
  const normalizedCodeNoSpace = code
    .replace(/\/\/.*$/gm, "")
    .replace(/\s/g, "")

  const expectedRootRoute = `export const route_root = createRootRoute({
  component: () => React.createElement(
    "div",
    {},
    React.createElement(Outlet),
  ),
});`
  expect(
    code.replace(/\/\/.*$/gm, ""), // Remove comments
  )
    .toContain(
      expectedRootRoute,
    )

  const expectedEmptyTree = `export const routeTree = route_root.addChildren([
  
]);`

  expect(normalizedCodeNoSpace).toContain(
    expectedEmptyTree.replace(/\s/g, ""),
  )
})

it("should handle layouts without direct pages and deeply nested structures", async () => {
  const handles: RouteHandle[] = [
    parseRoute("admin/_layout.tsx"),
    parseRoute("admin/users/_page.tsx"),
    parseRoute("admin/settings/_layout.tsx"),
    parseRoute("admin/settings/profile/_page.tsx"),
    parseRoute("_page.tsx"),
  ]

  const mockComps = {
    "_page.tsx": createMockComponent("RootPage"),
    "admin/_layout.tsx": createMockComponent("AdminLayout", true),
    "admin/users/_page.tsx": createMockComponent("AdminUsersPage"),
    "admin/settings/_layout.tsx": createMockComponent(
      "AdminSettingsLayout",
      true,
    ),
    "admin/settings/profile/_page.tsx": createMockComponent("AdminProfilePage"),
  }

  // Test root
  let html = await evalAndRender(handles, "/", mockComps)
  expect(html).toContain("RootPage")

  // Test admin users (AdminLayout -> AdminUsersPage)
  html = await evalAndRender(handles, "/admin/users", mockComps)
  expect(html).toContain("AdminLayout")
  expect(html).toContain("AdminUsersPage")

  // Test admin settings profile (AdminLayout -> AdminSettingsLayout -> AdminProfilePage)
  html = await evalAndRender(handles, "/admin/settings/profile", mockComps)
  expect(html).toContain("AdminLayout")
  expect(html).toContain("AdminSettingsLayout")
  expect(html).toContain("AdminProfilePage")

  const code = TanstackRouterCodegen.generateCode(handles)
  const normalizedCodeNoSpace = code.replace(/\/\/.*$/gm, "").replace(
    /\s/g,
    "",
  )

  // Check for rootRoute export
  const expectedRootRoute = `export const route_root = createRootRoute({
  component: () => React.createElement(
    "div",
    {},
    React.createElement(Outlet),
  ),
});`
  expect(
    code.replace(/\/\/.*$/gm, ""),
  )
    .toContain(
      expectedRootRoute,
    )

  expect(code).toMatch(/const route_admin_layout = /)

  expect(code).toMatch(/const route_admin_users_page = /)

  expect(code).toMatch(/const route_admin_settings_layout = /)

  expect(code).toMatch(/const route_admin_settings_profile_page = /)

  const expectedAdminSettingsChildren =
    `route_admin_settings_layout.addChildren([
  route_admin_settings_profile_page
])`
  expect(normalizedCodeNoSpace)
    .toContain(expectedAdminSettingsChildren.replace(/\s/g, ""))

  const expectedAdminChildren = `route_admin_layout.addChildren([
  route_admin_settings_layout.addChildren([
    route_admin_settings_profile_page
  ]),
  route_admin_users_page
])`
  expect(normalizedCodeNoSpace)
    .toContain(expectedAdminChildren.replace(/\s/g, ""))

  const expectedRouteTreeComplex =
    `export const routeTree = route_root.addChildren([
  route_admin_layout.addChildren([
    route_admin_settings_layout.addChildren([
      route_admin_settings_profile_page
    ]),
    route_admin_users_page
  ]),
  route_root_page
]);`
  expect(normalizedCodeNoSpace)
    .toContain(expectedRouteTreeComplex.replace(/\s/g, ""))
})

// Helper to create a mock component
const createMockComponent = (
  name: string,
  renderOutlet?: boolean,
) => {
  const Comp = () => {
    const elements: React.ReactNode[] = []
    // Always render the name as content
    elements.push(name)
    if (renderOutlet) {
      elements.push(React.createElement(Outlet, { key: "outlet" }))
    }
    // Wrap in a div with data-testid
    return React.createElement(
      "div",
      { "data-testid": `mock-${name}` },
      ...elements,
    )
  }
  Comp.displayName = name
  return Comp
}

// Helper function to evaluate generated code and render
async function evalAndRender(
  handles: RouteHandle[],
  initialUrl: string,
  mocks: Record<string, React.ComponentType<any>>,
) {
  const prefixedMocks: Record<string, React.ComponentType<any>> = {}
  for (const [key, value] of Object.entries(mocks)) {
    prefixedMocks[MODULE_PREFIX + key] = value
  }
  globalThis["__componentMocks"] = prefixedMocks

  let code = TanstackRouterCodegen.generateCode(handles)

  const importHelper = `
function __import(path) {
  return Promise.resolve({ 
    default: globalThis["__componentMocks"][path] || (() => null) 
  });
};
`

  // Replace import() expressions with __import()
  code = code.replace(
    /import\((.*?)\)/g,
    (_, path) => {
      return `__import(${path})`
    },
  ) + "\n\n" + importHelper

  const blob = new Blob([code], {
    type: "application/javascript",
  })

  const importedModule = await importBlob<{
    routeTree: any
    route_root: any
  }>(blob)

  const memoryHistory = createMemoryHistory({
    initialEntries: [initialUrl],
  })

  const router = createRouter({
    routeTree: importedModule.routeTree,
    history: memoryHistory,
  })

  await router.load()

  const stream = await renderToReadableStream(
    React.createElement(RouterProvider, { router }),
  )
  return await new Response(stream).text()
}
