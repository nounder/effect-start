import {
  createMemoryHistory,
  createRouter,
  Outlet,
  RouterProvider,
  useParams,
} from "@tanstack/react-router"
import {
  describe,
  expect,
  it,
  test,
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
} from "../../../src/esm.ts" // Adjusted import path
import * as TanstackRouter from "./TanstackRouter.ts"

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
  const code = TanstackRouter.generateRouteCode(handles)
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

test("generateRouteTree creates root node with correct structure", () => {
  const paths = {
    "_page.tsx": async () => ({ default: () => "RootPage" }),
  }

  const tree = TanstackRouter.generateRouteTree(paths)

  // Check that we get a proper TanStack Router root route
  expect(tree.isRoot)
    .toBe(true)

  expect((tree.children as any).length)
    .toBe(1)

  // Check the child route structure
  const childRoute = (tree.children as any)[0]
  expect(childRoute.options.path)
    .toBe("/")

  expect(childRoute.options.loader)
    .toBeDefined()

  expect(childRoute.options.getParentRoute())
    .toBe(tree)
})

test("generateRouteTree handles nested routes", () => {
  const paths = {
    "_page.tsx": async () => ({ default: () => "RootPage" }),
    "about/_page.tsx": async () => ({ default: () => "AboutPage" }),
    "users/_page.tsx": async () => ({ default: () => "UsersPage" }),
    "users/$userId/_page.tsx": async () => ({
      default: () => "UserDetailPage",
    }),
  }

  const tree = TanstackRouter.generateRouteTree(paths)

  expect((tree.children as any).length)
    .toBe(4) // root, about, users, users/$userId (flattened)

  // Check root page
  const rootPage = (tree.children as any).find((c: any) =>
    c.options.path === "/"
  )
  expect(rootPage)
    .toBeDefined()

  expect(rootPage.options.path)
    .toBe("/")

  // Check about page
  const aboutPage = (tree.children as any).find((c: any) =>
    c.options.path === "/about"
  )
  expect(aboutPage)
    .toBeDefined()

  expect(aboutPage.options.path)
    .toBe("/about")

  // Check users page
  const usersPage = (tree.children as any).find((c: any) =>
    c.options.path === "/users"
  )
  expect(usersPage)
    .toBeDefined()

  expect(usersPage.options.path)
    .toBe("/users")

  // Check users/$userId page
  const userDetailPage = (tree.children as any).find((c: any) =>
    c.options.path === "/users/$userId"
  )
  expect(userDetailPage)
    .toBeDefined()

  expect(userDetailPage.options.path)
    .toBe("/users/$userId")
})

test("generateRouteTree handles dynamic segments", () => {
  const paths = {
    "posts/$postId/_page.tsx": async () => ({ default: () => "PostPage" }),
    "users/$userId/posts/$postId/_page.tsx": async () => ({
      default: () => "UserPostPage",
    }),
  }

  const tree = TanstackRouter.generateRouteTree(paths)

  const postsRoute = (tree.children as any).find((c: any) =>
    c.options.path === "/posts/$postId"
  )
  expect(postsRoute)
    .toBeDefined()

  expect(postsRoute.options.path)
    .toBe("/posts/$postId")

  const userPostsRoute = (tree.children as any).find((c: any) =>
    c.options.path === "/users/$userId/posts/$postId"
  )
  expect(userPostsRoute)
    .toBeDefined()

  expect(userPostsRoute.options.path)
    .toBe("/users/$userId/posts/$postId")
})

test("generateRouteTree handles splat routes", () => {
  const paths = {
    "$/_page.tsx": async () => ({ default: () => "CatchAllPage" }),
    "files/$/_page.tsx": async () => ({ default: () => "FilesCatchAllPage" }),
  }

  const tree = TanstackRouter.generateRouteTree(paths)

  // Note: FileRouter sorts splat routes last, so files/$ comes before /$
  const filesSplatRoute = (tree.children as any).find((c: any) =>
    c.options.path === "/files/$"
  )

  expect(filesSplatRoute)
    .toBeDefined()

  expect(filesSplatRoute.options.path)
    .toBe("/files/$")

  const rootSplatRoute = (tree.children as any).find((c: any) =>
    c.options.path === "/$"
  )
  expect(rootSplatRoute)
    .toBeDefined()

  expect(rootSplatRoute.options.path)
    .toBe("/$")
})

test("generateRouteTree ignores non-page handles", () => {
  const paths = {
    "_page.tsx": async () => ({ default: () => "RootPage" }),
    "_layout.tsx": async () => ({ default: () => "RootLayout" }),
    "api/_server.ts": async () => ({ default: () => "ApiServer" }),
    "about/_page.tsx": async () => ({ default: () => "AboutPage" }),
  }

  const tree = TanstackRouter.generateRouteTree(paths)

  // Should only include page handles
  expect((tree.children as any).length)
    .toBe(2) // root page and about page

  const routePaths = (tree.children as any)
    .map((c: any) => c.options.path)
    .sort()

  expect(routePaths)
    .toEqual(["/", "/about"])
})

test("generateRouteTree assigns correct loaders", () => {
  const rootLoader = async () => ({ default: () => "RootPage" })
  const aboutLoader = async () => ({ default: () => "AboutPage" })

  const paths = {
    "_page.tsx": rootLoader,
    "about/_page.tsx": aboutLoader,
  }

  const tree = TanstackRouter.generateRouteTree(paths)

  const rootRoute = (tree.children as any).find((c: any) =>
    c.options.path === "/"
  )
  expect(rootRoute.options.loader)
    .toBeDefined()

  const aboutRoute = (tree.children as any).find((c: any) =>
    c.options.path === "/about"
  )

  expect(aboutRoute.options.loader)
    .toBeDefined()
})

test("generateRouteTree getParentRoute returns correct parent id", () => {
  const paths = {
    "_page.tsx": async () => ({ default: () => "RootPage" }),
    "users/_page.tsx": async () => ({ default: () => "UsersPage" }),
    "users/$userId/_page.tsx": async () => ({
      default: () => "UserDetailPage",
    }),
  }

  const tree = TanstackRouter.generateRouteTree(paths)

  // Find routes by path
  const indexRoute = (tree.children as any).find((r: any) =>
    r.options.path === "/"
  )
  const usersRoute = (tree.children as any).find((r: any) =>
    r.options.path === "/users"
  )
  const userIdRoute = (tree.children as any).find((r: any) =>
    r.options.path === "/users/$userId"
  )

  // All routes should have the root route as parent in this flattened structure
  expect(indexRoute.options.getParentRoute())
    .toBe(tree)

  expect(usersRoute.options.getParentRoute())
    .toBe(tree)

  expect(userIdRoute.options.getParentRoute())
    .toBe(tree)
})

test("generateRouteTree handles empty paths", () => {
  const paths = {}

  const tree = TanstackRouter.generateRouteTree(paths)

  expect(tree.isRoot)
    .toBe(true)

  expect((tree.children as any).length)
    .toBe(0)
})

test("generateRouteTree handles complex nested structure", () => {
  const paths = {
    "_page.tsx": async () => ({ default: () => "RootPage" }),
    "dashboard/_page.tsx": async () => ({ default: () => "DashboardPage" }),
    "dashboard/settings/_page.tsx": async () => ({
      default: () => "SettingsPage",
    }),
    "dashboard/settings/profile/_page.tsx": async () => ({
      default: () => "ProfilePage",
    }),
    "blog/_page.tsx": async () => ({ default: () => "BlogPage" }),
    "blog/$postId/_page.tsx": async () => ({ default: () => "BlogPostPage" }),
  }

  const tree = TanstackRouter.generateRouteTree(paths)

  // Should have root, dashboard, dashboard/settings, dashboard/settings/profile, blog, blog/$postId
  expect((tree.children as any).length)
    .toBe(6)

  // Verify structure by checking paths
  const routePaths = (tree.children as any)
    .map((c: any) => c.options.path)
    .sort()

  expect(routePaths)
    .toContain("/")

  expect(routePaths)
    .toContain("/dashboard")

  expect(routePaths)
    .toContain("/dashboard/settings")

  expect(routePaths)
    .toContain("/dashboard/settings/profile")

  expect(routePaths)
    .toContain("/blog")

  expect(routePaths)
    .toContain("/blog/$postId")
})

test("generateRouteTree renders React components properly", async () => {
  const RootComponent = () =>
    React.createElement("div", { id: "root" }, "Root Page Content")
  const AboutComponent = () =>
    React.createElement("div", { id: "about" }, "About Page Content")
  const UsersComponent = () =>
    React.createElement("div", { id: "users" }, "Users Page Content")

  const paths = {
    "_page.tsx": () => ({ default: RootComponent }),
    "about/_page.tsx": () => ({ default: AboutComponent }),
    "users/_page.tsx": () => ({ default: UsersComponent }),
  }

  const tree = TanstackRouter.generateRouteTree(paths)

  // Test root route renders correctly
  const rootHtml = await renderRouterToString(tree, "/")

  expect(rootHtml)
    .toContain("Root Page Content")
  expect(rootHtml)
    .toContain("<div id=\"root\">")

  // Test about route renders correctly
  const aboutHtml = await renderRouterToString(tree, "/about")
  expect(aboutHtml)
    .toContain("About Page Content")
  expect(aboutHtml)
    .toContain("<div id=\"about\">")

  // Test users route renders correctly
  const usersHtml = await renderRouterToString(tree, "/users")
  expect(usersHtml)
    .toContain("Users Page Content")
  expect(usersHtml)
    .toContain("<div id=\"users\">")
})

test("generateRouteTree renders async components and complex routes", async () => {
  const BlogComponent = () =>
    React.createElement("div", { id: "blog" }, "Blog Home")
  const PostComponent = () => {
    const params = useParams({ strict: false })
    return React.createElement(
      "div",
      { id: "post" },
      `Blog Post Detail: ${params.postId}`,
    )
  }
  const UserDetailComponent = () => {
    const params = useParams({ strict: false })
    return React.createElement(
      "div",
      { id: "user-detail" },
      `User Profile: ${params.userId}`,
    )
  }

  const paths = {
    "blog/_page.tsx": async () => ({ default: BlogComponent }),
    "blog/$postId/_page.tsx": () => ({ default: PostComponent }),
    "users/$userId/_page.tsx": async () => ({ default: UserDetailComponent }),
  }

  const tree = TanstackRouter.generateRouteTree(paths)

  // Test blog route renders correctly
  const blogHtml = await renderRouterToString(tree, "/blog")
  expect(blogHtml)
    .toContain("Blog Home")
  expect(blogHtml)
    .toContain("<div id=\"blog\">")

  // Test blog post route with dynamic segment
  const postHtml = await renderRouterToString(tree, "/blog/123")
  expect(postHtml)
    .toContain("Blog Post Detail: 123")
  expect(postHtml)
    .toContain("<div id=\"post\">")

  // Test user detail route with dynamic segment
  const userHtml = await renderRouterToString(tree, "/users/456")
  expect(userHtml)
    .toContain("User Profile: 456")
  expect(userHtml)
    .toContain("<div id=\"user-detail\">")
})

async function renderRouterToString(
  routeTree: any,
  path: string,
): Promise<string> {
  const memoryHistory = createMemoryHistory({
    initialEntries: [path],
  })

  const router = createRouter({
    routeTree,
    history: memoryHistory,
  })

  await router.load()

  const stream = await renderToReadableStream(
    React.createElement(RouterProvider, { router }),
  )

  return await new Response(stream).text()
}

describe("generateRouteCode", () => {
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

    const code = TanstackRouter.generateRouteCode(handles)
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

    const code = TanstackRouter.generateRouteCode(handles)
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

    const code = TanstackRouter.generateRouteCode(handles)
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

    const code = TanstackRouter.generateRouteCode(handles)
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

    const code = TanstackRouter.generateRouteCode(handles)
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
})
