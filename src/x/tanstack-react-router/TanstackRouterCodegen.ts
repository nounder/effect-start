import {
  FileRouter,
} from "effect-bundler"

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
    `export const rootRoute = createRootRoute({
  component: () => React.createElement(
    "div",
    {
      "data-testid": "root-outlet-wrapper",
    },
    React.createElement(Outlet),
  ),
});
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

export function getTanstackRelativePath(
  handle: FileRouter.RouteHandle,
  parentHandle: FileRouter.RouteHandle | null,
): string {
  if (parentHandle === null) { // Root child
    return handle.routePath
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

export function getRouteVarName(
  handle: FileRouter.RouteHandle,
  layoutHandles: FileRouter.RouteHandle[],
): string {
  const pathForSanitization = handle.routePath
  let pathPart = sanitizeForVarName(pathForSanitization)

  if (handle.type === "PageHandle") {
    const hasCollidingLayout = layoutHandles.some(
      lh => lh.routePath === handle.routePath && lh !== handle,
    )
    if (hasCollidingLayout) {
      // If pathPart is "root" (from "/"), this page is the root index page,
      // and if there was a root layout (uncommon, but possible), avoid "root_page" if not needed.
      // However, for /dashboard + /dashboard/_page, pathPart will be "dashboard", making it "dashboard_page".
      if (pathPart === "root" && handle.routePath === "/") {
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
      // If pathPart is "root" but handle.routePath is not "/" (e.g. a file named `_page.tsx` inside a folder that becomes part of root path somehow, not standard)
      // this logic might need more refinement, but for typical structures, this should be okay.
    }
  }
  return `route_${pathPart}`
}

export function sanitizeForVarName(tanstackRoutePath: string): string {
  if (tanstackRoutePath === "/") return "root"

  return tanstackRoutePath
    .replace(/^\//, "")
    .replace(/[^a-zA-Z0-9_$]/g, "_")
}
