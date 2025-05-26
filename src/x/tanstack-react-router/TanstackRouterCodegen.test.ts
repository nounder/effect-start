import {
  createRouter,
  Outlet,
} from "@tanstack/react-router"
import {
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router"
import {
  expect,
  it,
} from "bun:test"
import React from "react"
import {
  renderToReadableStream,
} from "react-dom/server"
import {
  importJsBlob,
} from "../../esm.ts"
import {
  parseRoute,
} from "../../FileRouter.ts"
import type {
  RouteHandle,
} from "../../FileRouter.ts"
import * as TanstackRouterCodegen from "./TanstackRouterCodegen.ts"

it("should generate correct code for a simple flat structure", async () => {
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
  expect(html).toContain("data-testid=\"mock-RootPage\"")
  expect(html).toContain("RootPage")

  // Test rendering about
  html = await evalAndRender(handles, "/about", mockComps)
  expect(html).toContain("data-testid=\"mock-AboutPage\"")
  expect(html).toContain("AboutPage")

  const code = TanstackRouterCodegen.generateCode(handles)
  const normalizedCode = code.replace(/\/\/.*$/gm, "").replace(/\s+/g, " ")
  const normalizedCodeNoSpace = code.replace(/\/\/.*$/gm, "").replace(
    /\s/g,
    "",
  )

  // Check for imports
  const expectedImport =
    "import { createRootRoute, createRoute, Outlet, } from \"@tanstack/react-router\";" // Removed Link, useParams
  expect(normalizedCode).toContain(expectedImport.replace(/\s+/g, " "))
  expect(code).toContain("import React from \"react\";")

  // Check for rootRoute export
  const expectedRootRoute = `export const rootRoute = createRootRoute({
  component: () => React.createElement(
    "div",
    {
      "data-testid": "root-outlet-wrapper",
    },
    React.createElement(Outlet),
  ),
});`
  expect(
    code,
  )
    .toContain(
      expectedRootRoute,
    )

  expect(code).toMatch(/const route_root = /)

  expect(code).toMatch(/const route_about = /)

  const expectedRouteTreeAssemblySimple =
    `export const routeTree = rootRoute.addChildren([ route_about, route_root ]);`
  expect(normalizedCodeNoSpace).toContain(
    expectedRouteTreeAssemblySimple.replace(/\s/g, ""),
  )
})

it("should generate correct code for nested routes with layouts", async () => {
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
  expect(html).toContain("data-testid=\"mock-RootPage\"")
  expect(html).toContain("RootPage")

  // Test rendering dashboard index (should be wrapped by layout)
  html = await evalAndRender(handles, "/dashboard", mockComps)
  expect(html).toContain("data-testid=\"mock-DashboardLayout\"")
  expect(html).toContain("DashboardLayout") // Layout content
  expect(html).toContain("data-testid=\"mock-DashboardPage\"")
  expect(html).toContain("DashboardPage") // Page content

  // Test rendering dashboard settings (should be wrapped by layout)
  html = await evalAndRender(handles, "/dashboard/settings", mockComps)
  expect(html).toContain("data-testid=\"mock-DashboardLayout\"")
  expect(html).toContain("DashboardLayout")
  expect(html).toContain("data-testid=\"mock-SettingsPage\"")
  expect(html).toContain("SettingsPage")

  const code = TanstackRouterCodegen.generateCode(handles)
  const normalizedCode = code.replace(/\/\/.*$/gm, "").replace(/\s+/g, " ")
  const normalizedCodeNoSpace = code.replace(/\/\/.*$/gm, "").replace(
    /\s/g,
    "",
  )

  expect(code).toMatch(/const route_dashboard = /)

  expect(code).toMatch(/const route_dashboard_page = /)

  expect(code).toMatch(/const route_dashboard_settings = /)

  const expectedDashboardChildren = `route_dashboard.addChildren([ 
  route_dashboard_page,
  route_dashboard_settings
])`
  expect(normalizedCodeNoSpace)
    .toContain(expectedDashboardChildren.replace(/\s/g, ""))

  const expectedRouteTreeAssemblyNested =
    `export const routeTree = rootRoute.addChildren([
  route_dashboard.addChildren([
    route_dashboard_page,
    route_dashboard_settings
  ]),
  route_root
]);`
  expect(normalizedCodeNoSpace)
    .toContain(expectedRouteTreeAssemblyNested.replace(/\s/g, ""))
})

it("should generate code for dynamic and splat routes", async () => {
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
  expect(html).toContain("data-testid=\"mock-PostIdPage\"")
  expect(html).toContain("PostIdPage")

  // Test rendering splat route
  html = await evalAndRender(handles, "/files/a/b/c", mockComps)
  expect(html).toContain("data-testid=\"mock-FilesSplatPage\"")
  expect(html).toContain("FilesSplatPage")

  const code = TanstackRouterCodegen.generateCode(handles)
  const normalizedCodeNoSpace = code.replace(/\/\/.*$/gm, "").replace(
    /\s/g,
    "",
  )

  expect(code).toMatch(/const route_posts_\$postId = /)

  expect(code).toMatch(/const route_files_\$ = /)

  const expectedRouteTreeDynamicSplat =
    `export const routeTree = rootRoute.addChildren([ route_files_$, route_posts_$postId ]);`
  expect(normalizedCodeNoSpace)
    .toContain(expectedRouteTreeDynamicSplat.replace(/\s/g, ""))
})

it("should generate correct code for an empty array of handles", async () => {
  const handles: RouteHandle[] = []

  const html = await evalAndRender(handles, "/", {}) // No components to mock
  // Since root component is just Outlet wrapped in a div, it should be minimal but present.
  expect(html).toContain("data-testid=\"root-outlet-wrapper\"")

  const code = TanstackRouterCodegen.generateCode(handles)
  const normalizedCodeNoSpace = code
    .replace(/\/\/.*$/gm, "")
    .replace(/\s/g, "")

  const expectedRootRoute = `export const rootRoute = createRootRoute({
  component: () => React.createElement(
    "div",
    {
      "data-testid": "root-outlet-wrapper",
    },
    React.createElement(Outlet),
  ),
});`
  expect(
    code.replace(/\/\/.*$/gm, ""), // Remove comments
  )
    .toContain(
      expectedRootRoute, // Direct comparison
    )

  const expectedEmptyTree =
    `export const routeTree = rootRoute.addChildren([ ]);`
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
  expect(html).toContain("data-testid=\"mock-RootPage\"")
  expect(html).toContain("RootPage")

  // Test admin users (AdminLayout -> AdminUsersPage)
  html = await evalAndRender(handles, "/admin/users", mockComps)
  expect(html).toContain("data-testid=\"mock-AdminLayout\"")
  expect(html).toContain("AdminLayout")
  expect(html).toContain("data-testid=\"mock-AdminUsersPage\"")
  expect(html).toContain("AdminUsersPage")

  // Test admin settings profile (AdminLayout -> AdminSettingsLayout -> AdminProfilePage)
  html = await evalAndRender(handles, "/admin/settings/profile", mockComps)
  expect(html).toContain("data-testid=\"mock-AdminLayout\"")
  expect(html).toContain("AdminLayout")
  expect(html).toContain("data-testid=\"mock-AdminSettingsLayout\"")
  expect(html).toContain("AdminSettingsLayout")
  expect(html).toContain("data-testid=\"mock-AdminProfilePage\"")
  expect(html).toContain("AdminProfilePage")

  const code = TanstackRouterCodegen.generateCode(handles)
  const normalizedCode = code.replace(/\/\/.*$/gm, "").replace(/\s+/g, " ")
  const normalizedCodeNoSpace = code.replace(/\/\/.*$/gm, "").replace(
    /\s/g,
    "",
  )

  // Check for rootRoute export
  const expectedRootRoute = `export const rootRoute = createRootRoute({
  component: () => React.createElement(
    "div",
    {
      "data-testid": "root-outlet-wrapper",
    },
    React.createElement(Outlet),
  ),
});`
  expect(
    code.replace(/\/\/.*$/gm, ""), // Remove comments
  )
    .toContain(
      expectedRootRoute, // Direct comparison
    )

  expect(code).toMatch(/const route_admin = /)

  expect(code).toMatch(/const route_admin_users = /)

  expect(code).toMatch(/const route_admin_settings = /)

  expect(code).toMatch(/const route_admin_settings_profile = /)

  const expectedAdminSettingsChildren =
    `route_admin_settings.addChildren([ route_admin_settings_profile ])`
  expect(normalizedCodeNoSpace)
    .toContain(expectedAdminSettingsChildren.replace(/\s/g, ""))

  const expectedAdminChildren =
    `route_admin.addChildren([ route_admin_settings.addChildren([ route_admin_settings_profile ]), route_admin_users ])`
  expect(normalizedCodeNoSpace)
    .toContain(expectedAdminChildren.replace(/\s/g, ""))

  const expectedRouteTreeComplex =
    `export const routeTree = rootRoute.addChildren([ route_admin.addChildren([ route_admin_settings.addChildren([ route_admin_settings_profile ]), route_admin_users ]), route_root ]);`
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
  mockComponents: Record<string, React.ComponentType<any>>,
) {
  const code = TanstackRouterCodegen.generateCode(handles)
  const blob = new Blob([code], { type: "application/javascript" })

  const importedModule = await importJsBlob<{
    routeTree: any
    rootRoute: any
    __setCustomModuleImporter: (importer: any) => void
  }>(blob)

  importedModule.__setCustomModuleImporter((path: string) => {
    const componentName = Object.keys(mockComponents).find(key => key === path)
    if (componentName && mockComponents[componentName]) {
      return Promise.resolve({ default: mockComponents[componentName] })
    }
    return Promise.resolve({
      default: () =>
        React.createElement("div", {}, `Component for ${path} not found`),
    })
  })

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
