import * as FileSystem from "@effect/platform/FileSystem"
import type { PlatformError } from "@effect/platform/Error"
import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Record from "effect/Record"
import * as Stream from "effect/Stream"
import * as NPath from "node:path"
import * as NUrl from "node:url"
import * as FileRouterCodegen from "./FileRouterCodegen.ts"
import * as FileSystemExtra from "./FileSystemExtra.ts"
import { ServerModule } from "./Router.ts"

type LiteralSegment = {
  literal: string
}

type GroupSegment = {
  group: string
}

type ParamSegment = {
  param: string
  optional?: true
}

type RestSegment = {
  rest: string
  optional?: true
}

type HandleSegment = {
  handle: "route" | "layer"
}

export type Extension = "tsx" | "jsx" | "ts" | "js"

export type Segment =
  | LiteralSegment
  | GroupSegment
  | ParamSegment
  | RestSegment
  | HandleSegment

export function isSegmentEqual(a: Segment, b: Segment): boolean {
  if ("literal" in a && "literal" in b) return a.literal === b.literal
  if ("group" in a && "group" in b) return a.group === b.group
  if ("param" in a && "param" in b) return a.param === b.param
  if ("rest" in a && "rest" in b) return a.rest === b.rest
  if ("handle" in a && "handle" in b) return a.handle === b.handle
  return false
}

export type RouteModule = {
  path: `/${string}`
  segments: readonly Segment[]
  load: () => Promise<ServerModule>
  layers?: ReadonlyArray<() => Promise<unknown>>
}

export type RouteManifest = {
  Modules: readonly RouteModule[]
}

export type RouteHandle = {
  handle: "route" | "layer"
  modulePath: string // eg. `about/route.tsx`, `users/[userId]/route.tsx`, `(admin)/users/route.tsx`
  routePath: `/${string}` // eg. `/about`, `/users/[userId]`, `/users` (groups stripped)
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

const ROUTE_PATH_REGEX = /^\/?(.*\/?)((route|layer))\.(jsx?|tsx?)$/

type RoutePathMatch = [
  path: string,
  kind: string,
  kind: string,
  ext: string,
]

export function segmentPath(path: string): Segment[] {
  const trimmedPath = path.replace(/(^\/)|(\/$)/g, "") // trim leading/trailing slashes

  if (trimmedPath === "") {
    return [] // Handles "" and "/"
  }

  const segmentStrings = trimmedPath
    .split("/")
    .filter(s => s !== "") // Remove empty segments from multiple slashes, e.g. "foo//bar"

  if (segmentStrings.length === 0) {
    return []
  }

  const segments: (Segment | null)[] = segmentStrings.map(
    (s): Segment | null => {
      // Check if it's a handle (route.ts, layer.tsx, etc.)
      const [, handle] = s.match(/^(route|layer)\.(tsx?|jsx?)$/)
        ?? []

      if (handle) {
        // @ts-expect-error regexp group ain't typed
        return { handle }
      }

      // (group) - Groups
      const groupMatch = s.match(/^\((\w+)\)$/)
      if (groupMatch) {
        return { group: groupMatch[1] }
      }

      // [[...rest]] - Optional rest parameter
      const optionalRestMatch = s.match(/^\[\[\.\.\.(\w+)\]\]$/)
      if (optionalRestMatch) {
        return {
          rest: optionalRestMatch[1],
          optional: true,
        }
      }

      // [...rest] - Required rest parameter
      const requiredRestMatch = s.match(/^\[\.\.\.(\w+)\]$/)
      if (requiredRestMatch) {
        return { rest: requiredRestMatch[1] }
      }

      // [param] - Dynamic parameter
      const paramMatch = s.match(/^\[(\w+)\]$/)
      if (paramMatch) {
        return { param: paramMatch[1] }
      }

      // Literal segment
      if (/^[A-Za-z0-9._~-]+$/.test(s)) {
        return { literal: s }
      }

      return null
    },
  )

  if (segments.some((seg) => seg === null)) {
    throw new Error(
      `Invalid path segment in "${path}": contains invalid characters or format`,
    )
  }

  return segments as Segment[]
}

function segmentToText(seg: Segment): string {
  if ("literal" in seg) return seg.literal
  if ("group" in seg) return `(${seg.group})`
  if ("param" in seg) return `[${seg.param}]`
  if ("rest" in seg) {
    return seg.optional ? `[[...${seg.rest}]]` : `[...${seg.rest}]`
  }
  if ("handle" in seg) return seg.handle
  return ""
}

export function parseRoute(
  path: string,
): RouteHandle {
  const segs = segmentPath(path)

  const handle = segs.at(-1)

  if (!handle || !("handle" in handle)) {
    throw new Error(
      `Invalid route path "${path}": must end with a valid handle (route or layer)`,
    )
  }

  // Validate Route constraints: rest segments must be the last segment before the handle
  const pathSegments = segs.slice(0, -1) // All segments except the handle
  const restIndex = pathSegments.findIndex(seg => "rest" in seg)

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
      if (!("literal" in seg) && !("param" in seg) && !("group" in seg)) {
        throw new Error(
          `Invalid route path "${path}": segments before rest must be literal, param, or group segments`,
        )
      }
    }
  } else {
    // No rest: validate that all path segments are literal, param, or group
    for (const seg of pathSegments) {
      if (!("literal" in seg) && !("param" in seg) && !("group" in seg)) {
        throw new Error(
          `Invalid route path "${path}": path segments must be literal, param, or group segments`,
        )
      }
    }
  }

  // Construct routePath from path segments (excluding handle and groups)
  // Groups like (admin) are stripped from the URL path
  const routePathSegments = pathSegments
    .filter(seg => !("group" in seg))
    .map(segmentToText)

  const routePath = (routePathSegments.length > 0
    ? `/${routePathSegments.join("/")}`
    : "/") as `/${string}`

  return {
    handle: handle.handle,
    modulePath: path,
    routePath,
    segments: segs,
  }
}

/**
 * Generates a file that references all routes.
 */
export function layer(options: {
  load: () => Promise<unknown>
  path: string
}) {
  let manifestPath = options.path

  // handle use of import.meta.resolve
  if (manifestPath.startsWith("file://")) {
    manifestPath = NUrl.fileURLToPath(manifestPath)
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
    .map(f => f.match(ROUTE_PATH_REGEX) as RoutePathMatch)
    .filter(Boolean)
    .map(v => {
      const path = v[0]
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
      const aHasRest = a.segments.some(seg => "rest" in seg)
      const bHasRest = b.segments.some(seg => "rest" in seg)

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
