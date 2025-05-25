import {
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router"
import {
  Data,
  Effect,
  Layer,
  pipe,
  Stream,
} from "effect"
import {
  FileRouter,
} from "effect-bundler"
import {
  watchFileChanges,
} from "effect-bundler/files"
import React from "react"

const RoutesDir = import.meta.dir + "/routes"

export class TanstackRouterError
  extends Data.TaggedError("TanstackRouterError")<{
    message: string
    cause?: unknown
  }>
{}

type RouteModules = {
  [path: string]: () =>
    | Promise<{
      default: any
    }>
    | {
      default: any
    }
}

export function generateRouteTree(paths: RouteModules) {
  const routes = FileRouter.getDirectoryRoutesFromPaths(Object.keys(paths))

  // Create the actual root route using TanStack Router API
  const rootRoute = createRootRoute({
    component: () => React.createElement(Outlet),
  })

  // Convert routes to TanStack routes and build the tree
  const childRoutes = convertRoutesToTanstackRoutes(
    routes,
    paths,
    rootRoute as any,
  )

  return rootRoute.addChildren(childRoutes as any) as any
}

export function layer() {
  const root = process.cwd()

  return Layer.scopedDiscard(
    Effect.gen(function*() {
      yield* pipe(
        watchFileChanges(root),
        Stream.runForEach(() =>
          Effect.tryPromise({
            try: async () => console.log("generating routes"),
            catch: cause =>
              new TanstackRouterError({
                message: "Failed to generate routes",
                cause,
              }),
          })
        ),
      )
    }),
  )
}

function convertRoutesToTanstackRoutes(
  routes: FileRouter.RouteHandle[],
  modules: RouteModules,
  rootRoute: any,
): any[] {
  const childRoutes: any[] = []

  // Filter to only page routes
  const pageRoutes = routes.filter(route => route.type === "PageHandle")

  for (const route of pageRoutes) {
    const routePath = route.routePath

    // For TanStack Router, all routes are direct children of root in this implementation
    // This matches the test expectations where routes are flattened
    const tanstackRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: routePath,
      component: () => {
        let Component: any = null
        const moduleResult = modules[route.modulePath]()

        if (moduleResult instanceof Promise) {
          Component = React.lazy(() => moduleResult)
          return React.createElement(
            React.Suspense,
            { fallback: null },
            React.createElement(Component),
          )
        } else {
          Component = moduleResult.default
          return React.createElement(Component)
        }
      },
      loader: async () => {
        const moduleResult = modules[route.modulePath]()
        const module = moduleResult instanceof Promise
          ? await moduleResult
          : moduleResult
        return module
      },
    })

    childRoutes.push(tanstackRoute)
  }

  return childRoutes
}

// Helper function to sanitize a TanStack route path for use in variable names
function sanitizeForVarName(tanstackRoutePath: string): string {
  if (tanstackRoutePath === "/") return "root"
  if (tanstackRoutePath === "") return "root"

  return tanstackRoutePath
    .replace(/^\//, "")
    .replace(/\/\$$/, "/Splat")
    .replace(/^$$/, "Splat")
    .replace(/\$/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
}

// Helper function to generate a variable name for a route
function getRouteVarName(
  handle: FileRouter.RouteHandle,
  layoutHandles: FileRouter.RouteHandle[],
): string {
  // @ts-ignore // FileRouter.RouteHandle.routePath can be "" for root, type `/${string}` is too strict here.
  const pathForSanitization = handle.routePath === "" ? "/" : handle.routePath
  let pathPart = sanitizeForVarName(pathForSanitization)

  if (handle.type === "PageHandle") {
    const hasCollidingLayout = layoutHandles.some(
      lh => lh.routePath === handle.routePath && lh !== handle, // Ensure it's a different handle
    )
    if (hasCollidingLayout) {
      // If pathPart is "root" (from "/"), this page is the root index page,
      // and if there was a root layout (uncommon, but possible), avoid "root_page" if not needed.
      // However, for /dashboard + /dashboard/_page, pathPart will be "dashboard", making it "dashboard_page".
      // @ts-ignore // handle.routePath can be "" for root, type `/${string}` is too strict here.
      if (pathPart === "root" && handle.routePath === "") {
        // This is the root page (e.g. _page.tsx at root level).
        // If there was a root layout (e.g. _layout.tsx at root), its pathPart would also be "root".
        // In this specific root case, let the page also be "route_root" if no layout, or distinguish if layout exists.
        // The `hasCollidingLayout` already checks for a layout at the same path.
        // So, if it's root and there's a colliding layout, make it `route_root_page`.
        pathPart = pathPart + "_page"
      } else if (pathPart !== "root") {
        // For non-root paths like /dashboard, if there's a /dashboard layout, page becomes route_dashboard_page
        pathPart = pathPart + "_page"
      }
      // If pathPart is "root" but handle.routePath is not "" (e.g. a file named `_page.tsx` inside a folder that becomes part of root path somehow, not standard)
      // this logic might need more refinement, but for typical structures, this should be okay.
    }
  }
  return `route_${pathPart}`
}

// Helper function to get the TanStack relativePath for a route
function getTanstackRelativePath(
  handle: FileRouter.RouteHandle,
  parentHandle: FileRouter.RouteHandle | null, // Changed from parentRoutePath
): string {
  if (parentHandle === null) { // Root child
    // @ts-ignore
    return handle.routePath === "" ? "/" : handle.routePath
  }

  const parentRoutePath = parentHandle.routePath
  // If page handle's routePath is same as layout's routePath, it's the layout's index page
  if (handle.routePath === parentRoutePath && handle.type === "PageHandle") {
    return "/"
  }

  let relativePath = handle.routePath.substring(parentRoutePath.length)
  if (relativePath === "") return "/"
  if (!relativePath.startsWith("/")) relativePath = `/${relativePath}`
  return relativePath
}

export function generateRouteCode(
  handles: FileRouter.RouteHandle[],
): string {
  const code: string[] = []

  // 1. Imports
  code.push(
    `import {
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";`,
  )
  code.push(`import React from "react";`)
  code.push(``)

  // NEW: importModule infrastructure
  code.push(`
let customModuleImporter = null;
export function __setCustomModuleImporter(importer) {
  customModuleImporter = importer;
}
function importModule(path) {
  if (customModuleImporter) {
    // customModuleImporter is expected to return Promise<{ default: ComponentType }>
    return customModuleImporter(path);
  }
  // Fallback to standard dynamic import
  return import(path);
}
`)

  const relevantHandles = handles.filter(
    h => h.type === "PageHandle" || h.type === "LayoutHandle",
  )

  const routeInfos: Map<
    string,
    {
      handle: FileRouter.RouteHandle
      varName: string
      parentVarName: string | null
      childrenVarNames: string[]
    }
  > = new Map()

  relevantHandles.sort((a, b) => {
    if (a.routePath.length !== b.routePath.length) {
      return a.routePath.length - b.routePath.length
    }
    if (a.type === "LayoutHandle" && b.type !== "LayoutHandle") return -1
    if (a.type !== "LayoutHandle" && b.type === "LayoutHandle") return 1
    return 0
  })

  const layoutHandles = relevantHandles.filter(h => h.type === "LayoutHandle")

  for (const handle of relevantHandles) {
    const varName = getRouteVarName(handle, layoutHandles)
    let parentVarName: string | null = null
    let parentHandleForRelativePath: FileRouter.RouteHandle | null = null

    let bestParentLayoutMatch: FileRouter.RouteHandle | null = null

    if (handle.type === "PageHandle") {
      const exactLayoutMatch = layoutHandles.find(lh =>
        lh.routePath === handle.routePath && lh !== handle
      )
      if (exactLayoutMatch) {
        bestParentLayoutMatch = exactLayoutMatch
      }
    }

    if (!bestParentLayoutMatch || handle.type === "LayoutHandle") {
      for (const potentialParentLayout of layoutHandles) {
        if (
          potentialParentLayout !== handle
          && handle.routePath.startsWith(potentialParentLayout.routePath + "/")
          && potentialParentLayout.routePath !== handle.routePath
        ) {
          if (
            !bestParentLayoutMatch
            || potentialParentLayout.routePath.length
              > bestParentLayoutMatch.routePath.length
          ) {
            bestParentLayoutMatch = potentialParentLayout
          }
        }
      }
    }

    if (bestParentLayoutMatch) {
      parentVarName = getRouteVarName(bestParentLayoutMatch, layoutHandles)
      parentHandleForRelativePath = bestParentLayoutMatch
    }

    routeInfos.set(varName, {
      handle,
      varName,
      parentVarName,
      childrenVarNames: [],
    })
  }

  for (const info of routeInfos.values()) {
    if (info.parentVarName && routeInfos.has(info.parentVarName)) {
      routeInfos.get(info.parentVarName)!.childrenVarNames.push(
        info.varName,
      )
    }
  }

  code.push(
    `export const rootRoute = createRootRoute({ component: () => React.createElement("div", { "data-testid": "root-outlet-wrapper" }, React.createElement(Outlet)) });
`,
  )

  // 4. Individual Route Definitions (No separate component functions)
  const routeDefinitionCode: string[] = []
  for (const currentInfo of routeInfos.values()) {
    const parentVarNameForCreate = currentInfo.parentVarName
      ? currentInfo.parentVarName
      : "rootRoute"

    const parentHandleForPathCalc = currentInfo.parentVarName
      ? routeInfos.get(currentInfo.parentVarName)?.handle
      : null

    const tanstackRelativePath = getTanstackRelativePath(
      currentInfo.handle,
      parentHandleForPathCalc || null,
    )

    // Ensure modulePath is treated as a string literal in the import
    const modulePathString = JSON.stringify(currentInfo.handle.modulePath)

    routeDefinitionCode.push(
      `const ${currentInfo.varName} = createRoute({
  getParentRoute: () => ${parentVarNameForCreate},
  path: "${tanstackRelativePath}",
  component: React.lazy(() => importModule(${modulePathString})),
});
`,
    )
  }
  code.push(...routeDefinitionCode)

  // 5. Route Tree Assembly
  function buildTreeAssembly(targetParentVarName: string | null): string {
    const childrenInfos = Array.from(routeInfos.values()).filter(
      info => info.parentVarName === targetParentVarName,
    )
    childrenInfos.sort((a, b) => a.varName.localeCompare(b.varName))

    if (childrenInfos.length === 0) return ""

    return childrenInfos
      .map(childInfo => {
        const childrenOfChildAssembly = buildTreeAssembly(
          childInfo.varName,
        )
        if (childrenOfChildAssembly) {
          return `${childInfo.varName}.addChildren([${childrenOfChildAssembly}])`
        }
        return childInfo.varName
      })
      .join(",\n        ")
  }

  const routeTreeAssembly = buildTreeAssembly(null)
  code.push(
    `export const routeTree = rootRoute.addChildren([
        ${routeTreeAssembly}
      ]);
`,
  )

  return code.join("\n")
}
