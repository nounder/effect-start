import {
  expect,
  it,
  test,
} from "bun:test"
import * as FileRouter from "../../FileRouter"
import * as TanstackRouter from "./TanstackRouter"

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
