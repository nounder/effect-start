import { FileSystem } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import {
  Array,
  Effect,
  Record,
} from "effect"

type LiteralSegment = {
  type: "Literal"
  text: string // eg. "users"
}

type ParamSegment = {
  type: "Param"
  param: string // eg. "userId"
  text: string // eg. "$userId"
}

type SplatSegment = {
  type: "Splat"
  text: "$"
}

export type Extension = "tsx" | "jsx" | "ts" | "js"

export type HandleSegment =
  | {
    // example: '_server.ts'
    type: "ServerHandle"
    text: `_server.${Extension}`
    handle: "server"
  }
  | {
    // example: '_page.tsx'
    type: "PageHandle"
    text: `_page.${Extension}`
    handle: "page"
  }
  | {
    // example: '_layout.tsx'
    type: "LayoutHandle"
    text: `_layout.${Extension}`
    handle: "layout"
  }

export type Segment =
  | LiteralSegment
  | ParamSegment
  | SplatSegment
  | HandleSegment

export type RouteHandle = {
  type: "ServerHandle" | "PageHandle" | "LayoutHandle"
  modulePath: string // eg. `about/_page.tsx`, `users/$userId/_page.tsx`, `users/$/page.tsx`
  routePath: `/${string}` // eg. `/about`,`/users/$userId`, `/users/$`
  segments: Segment[]
  splat: boolean // if check if route is a splat
}

const ROUTE_PATH_REGEX = /^\/?(.*\/?)(_(server|page|layout))\.(jsx?|tsx?)$/

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
      // Check if it's a handle (_server.ts, _page.tsx, _layout.jsx, etc.)
      const [, kind, ext] = s.match(/^_(server|page|layout)\.(tsx?|jsx?)$/)
        ?? []

      if (kind === "server") {
        return {
          type: "ServerHandle",
          text: s as `_server.${Extension}`,
          handle: "server",
        }
      } else if (kind === "page") {
        return {
          type: "PageHandle",
          text: s as `_page.${Extension}`,
          handle: "page",
        }
      } else if (kind === "layout") {
        return {
          type: "LayoutHandle",
          text: s as `_layout.${Extension}`,
          handle: "layout",
        }
      }

      // $ (Splat)
      if (s === "$") {
        return {
          type: "Splat",
          text: "$",
        }
      }

      // $name (Param)
      if (/^\$\w+$/.test(s)) {
        const name = s.substring(1) // Remove "$"
        if (name !== "") {
          return {
            type: "Param",
            param: name,
            text: s,
          }
        }
      }

      if (/^\w+$/.test(s)) {
        return {
          type: "Literal",
          text: s,
        }
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

export function parseRoute(
  path: string,
): RouteHandle {
  const segs = segmentPath(path)

  const handle = segs.at(-1)

  if (
    !handle
    || (
      handle.type !== "ServerHandle"
      && handle.type !== "PageHandle"
      && handle.type !== "LayoutHandle"
    )
  ) {
    throw new Error(
      `Invalid route path "${path}": must end with a valid handle (_server, _page, or _layout)`,
    )
  }

  // Validate Route constraints: splat segments must be the last segment before the handle
  const pathSegments = segs.slice(0, -1) // All segments except the handle
  const splatIndex = pathSegments.findIndex(seg => seg.type === "Splat")

  if (splatIndex !== -1) {
    // If there's a splat, it must be the last path segment
    if (splatIndex !== pathSegments.length - 1) {
      throw new Error(
        `Invalid route path "${path}": splat segment ($) must be the last path segment before the handle`,
      )
    }

    // Validate that all segments before the splat are literal or param
    for (let i = 0; i < splatIndex; i++) {
      const seg = pathSegments[i]
      if (seg.type !== "Literal" && seg.type !== "Param") {
        throw new Error(
          `Invalid route path "${path}": segments before splat must be literal or param segments`,
        )
      }
    }
  } else {
    // No splat: validate that all path segments are literal or param
    for (const seg of pathSegments) {
      if (
        seg.type !== "Literal"
        && seg.type !== "Param"
      ) {
        throw new Error(
          `Invalid route path "${path}": path segments must be literal or param segments`,
        )
      }
    }
  }

  // Construct routePath from path segments (excluding handle)
  const routePath = (pathSegments.length > 0
    ? `/${pathSegments.map(seg => seg.text).join("/")}`
    : "/") as `/${string}`

  // Check if route has splat
  const hasSplat = pathSegments.some(seg => seg.type === "Splat")

  return {
    type: handle.type,
    modulePath: path,
    routePath,
    segments: segs,
    splat: hasSplat,
  }
}

export function walkRoutesDirectory(
  dir: string,
): Effect.Effect<RouteHandle[], PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const files = yield* fs.readDirectory(dir, { recursive: true })

    return getRouteHandlesFromPaths(files)
  })
}

/**
 * Given a list of paths, return a list of route handles.
 * Routes are sorted by depth, splats are put at the end for each segment, like so:
 * - _layout.tsx
 * - users/_page.tsx
 * - users/$userId/_page.tsx
 * - $/_page.tsx
 */
export function getRouteHandlesFromPaths(
  paths: string[],
): RouteHandle[] {
  return paths
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

      return (
        // splat is a dominant factor
        (+a.splat - +b.splat) * 1000
        // depth is reversed for splats
        + (aDepth - bDepth) * (1 - 2 * +a.splat)
        // lexicographic comparison as tiebreaker
        + a.modulePath.localeCompare(b.modulePath) * 0.001
      )
    })
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
