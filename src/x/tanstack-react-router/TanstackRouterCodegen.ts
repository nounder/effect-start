import { FileSystem } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import {
  Effect,
  Iterable,
  pipe,
} from "effect"
import { FileRouter } from "effect-bundler"
import * as NPath from "node:path"

type RouteInfo = {
  handle: FileRouter.RouteHandle
  varName: string
  parentHandle: FileRouter.RouteHandle | null
}

export function generateCode(
  handles: FileRouter.RouteHandle[],
): string {
  const relevantHandles = handles.filter(
    h => h.type === "PageHandle" || h.type === "LayoutHandle",
  )

  const layoutHandles = relevantHandles.filter(h => h.type === "LayoutHandle")
  const rootLayoutHandle = layoutHandles.find(h => h.routePath === "/") ?? null

  // Filter out root layout from route generation if it exists
  const routesToGenerate = rootLayoutHandle
    ? relevantHandles.filter(h => h !== rootLayoutHandle)
    : relevantHandles

  const routeInfos = routesToGenerate.map(handle => ({
    handle,
    varName: getRouteVarName(handle),
    parentHandle: findParentHandle(handle, layoutHandles, rootLayoutHandle),
  }))

  return [
    `import {
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";
import React from "react";`,
    "",
    rootLayoutHandle
      ? `export const route_root = createRootRoute({
  component: React.lazy(() => import(${
        JSON.stringify("./" + rootLayoutHandle.modulePath)
      })),
})`
      : `export const route_root = createRootRoute({
  component: () => React.createElement(
    "div",
    {},
    React.createElement(Outlet),
  ),
});`,
    "",
    ...routeInfos
      .map(info => generateRouteDefinition(info))
      .flatMap(v => [v, ""]),
    generateRouteTree(routeInfos),
  ]
    .join("\n")
}

function findParentHandle(
  handle: FileRouter.RouteHandle,
  layoutHandles: FileRouter.RouteHandle[],
  rootLayoutHandle: FileRouter.RouteHandle | null,
): FileRouter.RouteHandle | null {
  // First check for exact layout match (for pages)
  if (handle.type === "PageHandle") {
    const exactLayoutMatch = layoutHandles
      .find(lh =>
        lh.routePath === handle.routePath
        && lh !== handle
        && lh !== rootLayoutHandle
      ) ?? null
    if (exactLayoutMatch) {
      return exactLayoutMatch
    }
  }

  // Find the deepest parent layout
  return pipe(
    layoutHandles,
    Iterable.filter(layout =>
      layout !== handle
      && layout !== rootLayoutHandle
      && handle.routePath.startsWith(layout.routePath + "/")
      && layout.routePath !== handle.routePath
    ),
    Iterable.reduce(
      null as FileRouter.RouteHandle | null,
      (best, current) =>
        !best || current.routePath.length > best.routePath.length
          ? current
          : best,
    ),
  )
}

function generateRouteDefinition(info: RouteInfo): string {
  const parentVarName = info.parentHandle
    ? getRouteVarName(info.parentHandle)
    : "route_root"

  const relativePath = getTanstackRelativePath(info.handle, info.parentHandle)
  const modulePathString = "./" + info.handle.modulePath

  return `const ${info.varName} = createRoute({
  getParentRoute: () => ${parentVarName},
  path: "${relativePath}",
  component: React.lazy(() => import(${JSON.stringify(modulePathString)})),
});`
}

function generateRouteTree(routeInfos: RouteInfo[]): string {
  function buildTreeChildren(
    parentHandle: FileRouter.RouteHandle | null,
  ): string {
    const children = routeInfos
      .filter(info => info.parentHandle === parentHandle)
      .sort((a, b) => a.varName.localeCompare(b.varName))

    if (children.length === 0) return ""

    return children
      .map(child => {
        const args = buildTreeChildren(child.handle)
        return args
          ? `${child.varName}.addChildren([${args}])`
          : child.varName
      })
      .join(",\n  ")
  }

  const treeAssembly = buildTreeChildren(null)
  return `export const routeTree = route_root.addChildren([
  ${treeAssembly}
]);`
}

function getTanstackRelativePath(
  handle: FileRouter.RouteHandle,
  parentHandle: FileRouter.RouteHandle | null,
): string {
  if (parentHandle === null) { // root
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
): string {
  const pathPart = sanitizeForVarName(handle.routePath)
  const typeSuffix = handle.type === "PageHandle" ? "_page" : "_layout"
  return `route_${pathPart}${typeSuffix}`
}

function sanitizeForVarName(tanstackRoutePath: string): string {
  if (tanstackRoutePath === "/") return "root"

  return tanstackRoutePath
    .replace(/^\//, "")
    .replace(/[^a-zA-Z0-9_$]/g, "_")
}

export function dump(
  path: string,
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const dir = NPath.dirname(path)
    const files = yield* fs.readDirectory(dir, { recursive: true })
    const handles = FileRouter.getRouteHandlesFromPaths(files)
    const code = generateCode(handles)

    yield* Effect.logDebug(`Generating ${path}`)

    yield* fs.writeFileString(
      path,
      code,
    )
  })
}
