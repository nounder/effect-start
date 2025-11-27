import type { PlatformError } from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Record from "effect/Record"
import * as Stream from "effect/Stream"
import * as NPath from "node:path"
import * as NUrl from "node:url"
import * as FileRouterCodegen from "./FileRouterCodegen.ts"
import * as FileRouterPattern from "./FileRouterPattern.ts"
import * as FileSystemExtra from "./FileSystemExtra.ts"
import * as Router from "./Router.ts"

export type GroupSegment<Name extends string = string> =
  FileRouterPattern.GroupSegment<Name>

export type Segment = FileRouterPattern.Segment

export type RouteManifest = {
  routes: readonly Router.LazyRoute[]
}

export type RouteHandle = {
  handle: "route" | "layer"
  // eg. `about/route.tsx`, `users/[userId]/route.tsx`, `(admin)/users/route.tsx`
  modulePath: string
  // eg. `/about`, `/users/[userId]`, `/users` (groups stripped)
  routePath: `/${string}`
  segments: Segment[]
}

/**
 * Routes are sorted by depth, layers are first,
 * rest parameters are put at the end for each segment.
 * - layer.tsx
 * - users/route.tsx
 * - users/[userId]/route.tsx
 * - [[...rest]]/route.tsx
 */
export type OrderedRouteHandles = RouteHandle[]

const ROUTE_PATH_REGEX = /^\/?(.*\/?)(?:route|layer)\.(jsx?|tsx?)$/

export const parse = FileRouterPattern.parse
export const formatSegment = FileRouterPattern.formatSegment
export const format = FileRouterPattern.format

export function parseRoute(
  path: string,
): RouteHandle {
  const segs = parse(path)

  const lastSeg = segs.at(-1)
  const handleMatch = lastSeg?._tag === "LiteralSegment"
    && lastSeg.value.match(/^(route|layer)\.(tsx?|jsx?)$/)
  const handle = handleMatch ? handleMatch[1] as "route" | "layer" : null

  if (!handle) {
    throw new Error(
      `Invalid route path "${path}": must end with a valid handle (route or layer)`,
    )
  }

  // Validate Route constraints: rest segments must be the last segment before the handle
  const pathSegments = segs.slice(0, -1) // All segments except the handle
  const restIndex = pathSegments.findIndex(seg => seg._tag === "RestSegment")

  if (restIndex !== -1) {
    // If there's a rest, it must be the last path segment
    if (restIndex !== pathSegments.length - 1) {
      throw new Error(
        `Invalid route path "${path}": rest segment ([...rest] or [[...rest]]) must be the last path segment before the handle`,
      )
    }

    // Validate that all segments before the rest are literal, param, or group
    for (let i = 0; i < restIndex; i++) {
      const seg = pathSegments[i]
      if (
        seg._tag !== "LiteralSegment"
        && seg._tag !== "ParamSegment"
        && seg._tag !== "GroupSegment"
      ) {
        throw new Error(
          `Invalid route path "${path}": segments before rest must be literal, param, or group segments`,
        )
      }
    }
  } else {
    // No rest: validate that all path segments are literal, param, or group
    for (const seg of pathSegments) {
      if (
        seg._tag !== "LiteralSegment"
        && seg._tag !== "ParamSegment"
        && seg._tag !== "GroupSegment"
      ) {
        throw new Error(
          `Invalid route path "${path}": path segments must be literal, param, or group segments`,
        )
      }
    }
  }

  // Construct routePath from path segments (excluding groups)
  // Groups like (admin) are stripped from the URL path
  const routePathSegments = pathSegments.filter(
    seg => seg._tag !== "GroupSegment",
  )
  const routePath = FileRouterPattern.format(routePathSegments)

  return {
    handle,
    modulePath: path,
    routePath,
    segments: pathSegments,
  }
}

/**
 * Generates a manifest file that references all routes.
 */
export function layerManifest(options: {
  load: () => Promise<unknown>
  path: string
}) {
  let manifestPath = options.path
  if (manifestPath.startsWith("file://")) {
    manifestPath = NUrl.fileURLToPath(manifestPath)
  }
  if (NPath.extname(manifestPath) === "") {
    manifestPath = NPath.join(manifestPath, "index.ts")
  }

  const routesPath = NPath.dirname(manifestPath)
  const manifestFilename = NPath.basename(manifestPath)
  const resolvedManifestPath = NPath.resolve(routesPath, manifestFilename)

  return Layer.scopedDiscard(
    Effect.gen(function*() {
      yield* FileRouterCodegen.update(routesPath, manifestFilename)

      const stream = Function.pipe(
        FileSystemExtra.watchSource({
          path: routesPath,
          filter: (e) => !e.path.includes("node_modules"),
        }),
        Stream.onError((e) => Effect.logError(e)),
      )

      yield* Function.pipe(
        stream,
        // filter out edits to gen file
        Stream.filter(e => e.path !== resolvedManifestPath),
        Stream.runForEach(() =>
          FileRouterCodegen.update(routesPath, manifestFilename)
        ),
        Effect.fork,
      )
    }),
  )
}

export function layer(options: {
  load: () => Promise<Router.RouterManifest>
  path: string
}) {
  return Layer.mergeAll(
    Layer.effect(
      Router.Router,
      Effect.promise(() => options.load()),
    ),
    layerManifest(options),
  )
}

export function walkRoutesDirectory(
  dir: string,
): Effect.Effect<
  OrderedRouteHandles,
  PlatformError,
  FileSystem.FileSystem
> {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const files = yield* fs.readDirectory(dir, { recursive: true })

    return getRouteHandlesFromPaths(files)
  })
}

/**
 * Given a list of paths, return a list of route handles.
 */
export function getRouteHandlesFromPaths(
  paths: string[],
): OrderedRouteHandles {
  const handles = paths
    .map(f => f.match(ROUTE_PATH_REGEX))
    .filter(Boolean)
    .map(v => {
      const path = v![0]
      try {
        return parseRoute(path)
      } catch {
        return null
      }
    })
    .filter((route): route is RouteHandle => route !== null)
    .toSorted((a, b) => {
      const aDepth = a.segments.length
      const bDepth = b.segments.length
      const aHasRest = a.segments.some(seg => seg._tag === "RestSegment")
      const bHasRest = b.segments.some(seg => seg._tag === "RestSegment")

      return (
        // rest is a dominant factor (routes with rest come last)
        (+aHasRest - +bHasRest) * 1000
        // depth is reversed for rest
        + (aDepth - bDepth) * (1 - 2 * +aHasRest)
        // lexicographic comparison as tiebreaker
        + a.modulePath.localeCompare(b.modulePath) * 0.001
      )
    })

  // Detect conflicting routes at the same path
  const routesByPath = new Map<string, RouteHandle[]>()
  for (const handle of handles) {
    const existing = routesByPath.get(handle.routePath) || []
    existing.push(handle)
    routesByPath.set(handle.routePath, existing)
  }

  for (const [path, pathHandles] of routesByPath) {
    const routeHandles = pathHandles.filter(h => h.handle === "route")

    if (routeHandles.length > 1) {
      const modulePaths = routeHandles.map(h => h.modulePath).join(", ")
      throw new Error(
        `Conflicting routes detected at path ${path}: ${modulePaths}`,
      )
    }
  }

  return handles
}

type RouteTree = {
  path: `/${string}`
  handles: RouteHandle[]
  children?: RouteTree[]
}

export function treeFromRouteHandles(
  handles: RouteHandle[],
): RouteTree {
  const handlesByPath = Array.groupBy(handles, handle => handle.routePath)
  const paths = Record.keys(handlesByPath)
  const root: RouteTree = {
    path: "/",
    handles: handlesByPath["/"] || [],
  }

  const nodeMap = new Map<string, RouteTree>([["/", root]])

  for (const absolutePath of paths) {
    if (absolutePath === "/") continue

    // Find parent path
    const segments = absolutePath.split("/").filter(Boolean)
    const parentPath = segments.length === 1
      ? "/"
      : "/" + segments.slice(0, -1).join("/")

    const parent = nodeMap.get(parentPath)
    if (!parent) {
      continue // Skip orphaned paths
    }

    // Create node with relative path
    const relativePath = parent.path === "/"
      ? absolutePath
      : absolutePath.slice(parentPath.length)

    const node: RouteTree = {
      path: relativePath as `/${string}`,
      handles: handlesByPath[absolutePath]!,
    }

    // Add to parent
    if (!parent.children) {
      parent.children = []
    }

    parent.children.push(node)

    // Store for future children
    nodeMap.set(absolutePath, node)
  }

  return root
}
