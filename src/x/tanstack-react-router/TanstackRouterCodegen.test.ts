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
import {
  FileRouter,
} from "effect-bundler"
import React from "react"
import {
  renderToReadableStream,
} from "react-dom/server"
import {
  importJsBlob,
} from "../../esm.ts"
import * as TanstackRouterCodegen from "./TanstackRouterCodegen.ts"

it("should generate correct code for a simple flat structure", async () => {
  const handles: FileRouter.RouteHandle[] = [
    {
      type: "PageHandle",
      modulePath: "./routes/_page.tsx",
      routePath: "" as any,
      splat: false,
      segments: [],
    },
    {
      type: "PageHandle",
      modulePath: "./routes/about/_page.tsx",
      routePath: "/about",
      splat: false,
      segments: [{ type: "Literal", text: "about" }],
    },
  ]
  const mockComps = {
    "./routes/_page.tsx": createMockComponent(
      "RootPage",
      "Root Page Content",
    ),
    "./routes/about/_page.tsx": createMockComponent(
      "AboutPage",
      "About Page Content",
    ),
  }

  // Test rendering root
  let html = await evalAndRender(handles, "/", mockComps)
  expect(html).toContain("data-testid=\"mock-RootPage\"")
  expect(html).toContain("Root Page Content")

  // Test rendering about
  html = await evalAndRender(handles, "/about", mockComps)
  expect(html).toContain("data-testid=\"mock-AboutPage\"")
  expect(html).toContain("About Page Content")

  const code = TanstackRouterCodegen.generateRouteCode(handles)
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
  expect(normalizedCode).toContain(
    `export const rootRoute = createRootRoute({ component: () => React.createElement("div", { "data-testid": "root-outlet-wrapper" }, React.createElement(Outlet)) });` // Updated component
      .replace(/\s+/g, " "),
  )

  const expectedIndexRoute =
    `const route_root = createRoute({ getParentRoute: () => rootRoute, path: "/", component: React.lazy(() => importModule("./routes/_page.tsx")), });`
  expect(normalizedCode).toContain(expectedIndexRoute.replace(/\s+/g, " "))

  const expectedAboutRoute =
    `const route_about = createRoute({ getParentRoute: () => rootRoute, path: "/about", component: React.lazy(() => importModule("./routes/about/_page.tsx")), });`
  expect(normalizedCode).toContain(expectedAboutRoute.replace(/\s+/g, " "))

  const expectedRouteTreeAssemblySimple =
    `export const routeTree = rootRoute.addChildren([ route_about, route_root ]);`
  expect(normalizedCodeNoSpace).toContain(
    expectedRouteTreeAssemblySimple.replace(/\s/g, ""),
  )
})

it("should generate correct code for nested routes with layouts", async () => {
  const handles: FileRouter.RouteHandle[] = [
    {
      type: "PageHandle",
      modulePath: "./routes/_page.tsx",
      routePath: "" as any,
      splat: false,
      segments: [],
    },
    {
      type: "LayoutHandle",
      modulePath: "./routes/dashboard/_layout.tsx",
      routePath: "/dashboard",
      splat: false,
      segments: [{ type: "Literal", text: "dashboard" }],
    },
    {
      type: "PageHandle",
      modulePath: "./routes/dashboard/_page.tsx",
      routePath: "/dashboard",
      splat: false,
      segments: [{ type: "Literal", text: "dashboard" }],
    },
    {
      type: "PageHandle",
      modulePath: "./routes/dashboard/settings/_page.tsx",
      routePath: "/dashboard/settings",
      splat: false,
      segments: [
        { type: "Literal", text: "dashboard" },
        { type: "Literal", text: "settings" },
      ],
    },
  ]

  const mockComps = {
    "./routes/_page.tsx": createMockComponent("RootPage", "Root Content"),
    "./routes/dashboard/_layout.tsx": createMockComponent(
      "DashboardLayout",
      "Dashboard Layout ",
      true,
    ),
    "./routes/dashboard/_page.tsx": createMockComponent(
      "DashboardPage",
      "Dashboard Index Page",
    ),
    "./routes/dashboard/settings/_page.tsx": createMockComponent(
      "SettingsPage",
      "Settings Page Content",
    ),
  }

  // Test rendering root
  let html = await evalAndRender(handles, "/", mockComps)
  expect(html).toContain("data-testid=\"mock-RootPage\"")
  expect(html).toContain("Root Content")

  // Test rendering dashboard index (should be wrapped by layout)
  html = await evalAndRender(handles, "/dashboard", mockComps)
  expect(html).toContain("data-testid=\"mock-DashboardLayout\"")
  expect(html).toContain("Dashboard Layout ") // Layout content
  expect(html).toContain("data-testid=\"mock-DashboardPage\"")
  expect(html).toContain("Dashboard Index Page") // Page content

  // Test rendering dashboard settings (should be wrapped by layout)
  html = await evalAndRender(handles, "/dashboard/settings", mockComps)
  expect(html).toContain("data-testid=\"mock-DashboardLayout\"")
  expect(html).toContain("Dashboard Layout ")
  expect(html).toContain("data-testid=\"mock-SettingsPage\"")
  expect(html).toContain("Settings Page Content")

  const code = TanstackRouterCodegen.generateRouteCode(handles)
  const normalizedCode = code.replace(/\/\/.*$/gm, "").replace(/\s+/g, " ")
  const normalizedCodeNoSpace = code.replace(/\/\/.*$/gm, "").replace(
    /\s/g,
    "",
  )

  const expectedDashboardLayoutRoute =
    `const route_dashboard = createRoute({ getParentRoute: () => rootRoute, path: "/dashboard", component: React.lazy(() => importModule("./routes/dashboard/_layout.tsx")), });`
  expect(normalizedCode).toContain(
    expectedDashboardLayoutRoute.replace(/\s+/g, " "),
  )

  const expectedDashboardPageRoute =
    `const route_dashboard_page = createRoute({ getParentRoute: () => route_dashboard, path: "/", component: React.lazy(() => importModule("./routes/dashboard/_page.tsx")), });`
  expect(normalizedCode).toContain(
    expectedDashboardPageRoute.replace(/\s+/g, " "),
  )

  const expectedDashboardSettingsRoute =
    `const route_dashboard_settings = createRoute({ getParentRoute: () => route_dashboard, path: "/settings", component: React.lazy(() => importModule("./routes/dashboard/settings/_page.tsx")), });`
  expect(normalizedCode).toContain(
    expectedDashboardSettingsRoute.replace(/\s+/g, " "),
  )

  const expectedDashboardChildren =
    `route_dashboard.addChildren([ route_dashboard_page, route_dashboard_settings ])`
  expect(normalizedCodeNoSpace)
    .toContain(expectedDashboardChildren.replace(/\s/g, ""))

  const expectedRouteTreeAssemblyNested =
    `export const routeTree = rootRoute.addChildren([ route_dashboard.addChildren([ route_dashboard_page, route_dashboard_settings ]), route_root ]);`
  expect(normalizedCodeNoSpace)
    .toContain(expectedRouteTreeAssemblyNested.replace(/\s/g, ""))
})

it("should generate code for dynamic and splat routes", async () => {
  const handles: FileRouter.RouteHandle[] = [
    {
      type: "PageHandle",
      modulePath: "./routes/posts/$postId/_page.tsx",
      routePath: "/posts/$postId",
      splat: false,
      segments: [
        { type: "Literal", text: "posts" },
        { type: "Param", param: "postId", text: "$postId" },
      ],
    },
    {
      type: "PageHandle",
      modulePath: "./routes/files/$/_page.tsx",
      routePath: "/files/$",
      splat: true,
      segments: [
        { type: "Literal", text: "files" },
        { type: "Splat", text: "$" },
      ],
    },
  ]

  const mockComps = {
    "./routes/posts/$postId/_page.tsx": createMockComponent(
      "PostIdPage",
      "Post ID Page",
    ),
    "./routes/files/$/_page.tsx": createMockComponent(
      "FilesSplatPage",
      "Files Splat Page",
    ),
  }

  // Test rendering dynamic route
  let html = await evalAndRender(handles, "/posts/abc", mockComps)
  expect(html).toContain("data-testid=\"mock-PostIdPage\"")
  expect(html).toContain("Post ID Page")

  // Test rendering splat route
  html = await evalAndRender(handles, "/files/a/b/c", mockComps)
  expect(html).toContain("data-testid=\"mock-FilesSplatPage\"")
  expect(html).toContain("Files Splat Page")

  const code = TanstackRouterCodegen.generateRouteCode(handles)
  const normalizedCode = code.replace(/\/\/.*$/gm, "").replace(/\s+/g, " ")
  const normalizedCodeNoSpace = code.replace(/\/\/.*$/gm, "").replace(
    /\s/g,
    "",
  )

  const expectedPostIdRoute =
    `const route_posts_postId = createRoute({ getParentRoute: () => rootRoute, path: "/posts/$postId", component: React.lazy(() => importModule("./routes/posts/$postId/_page.tsx")), });`
  expect(normalizedCode).toContain(expectedPostIdRoute.replace(/\s+/g, " "))

  const expectedFilesSplatRoute =
    `const route_files_Splat = createRoute({ getParentRoute: () => rootRoute, path: "/files/$", component: React.lazy(() => importModule("./routes/files/$/_page.tsx")), });`
  expect(normalizedCode).toContain(
    expectedFilesSplatRoute.replace(/\s+/g, " "),
  )

  const expectedRouteTreeDynamicSplat =
    `export const routeTree = rootRoute.addChildren([ route_files_Splat, route_posts_postId ]);`
  expect(normalizedCodeNoSpace)
    .toContain(expectedRouteTreeDynamicSplat.replace(/\s/g, ""))
})

it("should generate correct code for an empty array of handles", async () => {
  const handles: FileRouter.RouteHandle[] = []

  const html = await evalAndRender(handles, "/", {}) // No components to mock
  // Since root component is just Outlet wrapped in a div, it should be minimal but present.
  expect(html).toContain("data-testid=\"root-outlet-wrapper\"")

  const code = TanstackRouterCodegen.generateRouteCode(handles)
  const normalizedCode = code.replace(/\/\/.*$/gm, "").replace(/\s+/g, " ")
  const normalizedCodeNoSpace = code.replace(/\/\/.*$/gm, "").replace(
    /\s/g,
    "",
  )

  expect(normalizedCode).toContain(
    `export const rootRoute = createRootRoute({ component: () => React.createElement("div", { "data-testid": "root-outlet-wrapper" }, React.createElement(Outlet)) });` // Updated component
      .replace(/\s+/g, " "),
  )
  const expectedEmptyTree =
    `export const routeTree = rootRoute.addChildren([ ]);`
  expect(normalizedCodeNoSpace).toContain(
    expectedEmptyTree.replace(/\s/g, ""),
  )
})

it("should handle layouts without direct pages and deeply nested structures", async () => {
  const handles: FileRouter.RouteHandle[] = [
    {
      type: "LayoutHandle",
      routePath: "/admin",
      modulePath: "./routes/admin/_layout.tsx",
      splat: false,
      segments: [{ type: "Literal", text: "admin" }],
    },
    {
      type: "PageHandle",
      routePath: "/admin/users",
      modulePath: "./routes/admin/users/_page.tsx",
      splat: false,
      segments: [
        { type: "Literal", text: "admin" },
        { type: "Literal", text: "users" },
      ],
    },
    {
      type: "LayoutHandle",
      routePath: "/admin/settings",
      modulePath: "./routes/admin/settings/_layout.tsx",
      splat: false,
      segments: [
        { type: "Literal", text: "admin" },
        { type: "Literal", text: "settings" },
      ],
    },
    {
      type: "PageHandle",
      routePath: "/admin/settings/profile",
      modulePath: "./routes/admin/settings/profile/_page.tsx",
      splat: false,
      segments: [
        { type: "Literal", text: "admin" },
        { type: "Literal", text: "settings" },
        { type: "Literal", text: "profile" },
      ],
    },
    {
      type: "PageHandle",
      routePath: "" as any,
      modulePath: "./routes/_page.tsx",
      splat: false,
      segments: [],
    },
  ]

  const mockComps = {
    "./routes/_page.tsx": createMockComponent("RootPage", "Site Root Page"),
    "./routes/admin/_layout.tsx": createMockComponent(
      "AdminLayout",
      "Admin Area Layout ",
      true,
    ),
    "./routes/admin/users/_page.tsx": createMockComponent(
      "AdminUsersPage",
      "Admin Users",
    ),
    "./routes/admin/settings/_layout.tsx": createMockComponent(
      "AdminSettingsLayout",
      "Admin Settings Layout ",
      true,
    ),
    "./routes/admin/settings/profile/_page.tsx": createMockComponent(
      "AdminProfilePage",
      "Admin User Profile",
    ),
  }

  // Test root
  let html = await evalAndRender(handles, "/", mockComps)
  expect(html).toContain("data-testid=\"mock-RootPage\"")
  expect(html).toContain("Site Root Page")

  // Test admin users (AdminLayout -> AdminUsersPage)
  html = await evalAndRender(handles, "/admin/users", mockComps)
  expect(html).toContain("data-testid=\"mock-AdminLayout\"")
  expect(html).toContain("Admin Area Layout ")
  expect(html).toContain("data-testid=\"mock-AdminUsersPage\"")
  expect(html).toContain("Admin Users")

  // Test admin settings profile (AdminLayout -> AdminSettingsLayout -> AdminProfilePage)
  html = await evalAndRender(handles, "/admin/settings/profile", mockComps)
  expect(html).toContain("data-testid=\"mock-AdminLayout\"")
  expect(html).toContain("Admin Area Layout ")
  expect(html).toContain("data-testid=\"mock-AdminSettingsLayout\"")
  expect(html).toContain("Admin Settings Layout ")
  expect(html).toContain("data-testid=\"mock-AdminProfilePage\"")
  expect(html).toContain("Admin User Profile")

  const code = TanstackRouterCodegen.generateRouteCode(handles)
  const normalizedCode = code.replace(/\/\/.*$/gm, "").replace(/\s+/g, " ")
  const normalizedCodeNoSpace = code.replace(/\/\/.*$/gm, "").replace(
    /\s/g,
    "",
  )

  expect(normalizedCode).toContain(
    `export const rootRoute = createRootRoute({ component: () => React.createElement("div", { "data-testid": "root-outlet-wrapper" }, React.createElement(Outlet)) });` // Updated component
      .replace(/\s+/g, " "),
  )

  const expectedAdminLayoutRoute =
    `const route_admin = createRoute({ getParentRoute: () => rootRoute, path: "/admin", component: React.lazy(() => importModule("./routes/admin/_layout.tsx")), });`
  expect(normalizedCode).toContain(
    expectedAdminLayoutRoute.replace(/\s+/g, " "),
  )

  const expectedAdminUsersRoute =
    `const route_admin_users = createRoute({ getParentRoute: () => route_admin, path: "/users", component: React.lazy(() => importModule("./routes/admin/users/_page.tsx")), });`
  expect(normalizedCode).toContain(
    expectedAdminUsersRoute.replace(/\s+/g, " "),
  )

  const expectedAdminSettingsLayoutRoute =
    `const route_admin_settings = createRoute({ getParentRoute: () => route_admin, path: "/settings", component: React.lazy(() => importModule("./routes/admin/settings/_layout.tsx")), });`
  expect(normalizedCode).toContain(
    expectedAdminSettingsLayoutRoute.replace(/\s+/g, " "),
  )

  const expectedAdminSettingsProfileRoute =
    `const route_admin_settings_profile = createRoute({ getParentRoute: () => route_admin_settings, path: "/profile", component: React.lazy(() => importModule("./routes/admin/settings/profile/_page.tsx")), });`
  expect(normalizedCode).toContain(
    expectedAdminSettingsProfileRoute.replace(/\s+/g, " "),
  )

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
  content?: string | React.ReactElement,
  renderOutlet?: boolean,
) => {
  const Comp = () => {
    const elements: React.ReactNode[] = []
    if (content) {
      if (typeof content === "string") {
        elements.push(content)
      } else {
        elements.push(content) // Already a ReactElement
      }
    }
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
  handles: FileRouter.RouteHandle[],
  initialUrl: string,
  mockComponents: Record<string, React.ComponentType<any>>,
) {
  const code = TanstackRouterCodegen.generateRouteCode(handles)
  const blob = new Blob([code], { type: "application/javascript" })

  const importedModule = await importJsBlob<{
    routeTree: any
    rootRoute: any
    __setCustomModuleImporter: (importer: any) => void
  }>(blob)

  importedModule.__setCustomModuleImporter((path: string) => {
    const componentName = Object.keys(mockComponents).find(key =>
      path.includes(key)
    )
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
