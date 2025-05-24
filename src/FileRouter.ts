import {
  FileSystem,
} from "@effect/platform"
import type {
  PlatformError,
} from "@effect/platform/Error"
import {
  Effect,
  Either,
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
    extension: Extension
  }
  | {
    // example: '_page.tsx'
    type: "PageHandle"
    text: `_page.${Extension}`
    handle: "page"
    extension: Extension
  }
  | {
    // example: '_layout.tsx'
    type: "LayoutHandle"
    text: `_layout.${Extension}`
    handle: "layout"
    extension: Extension
  }

export type Segment =
  | LiteralSegment
  | ParamSegment
  | SplatSegment
  | HandleSegment

export type SegmentRoute =
  | [
    ...(LiteralSegment | ParamSegment)[],
    HandleSegment,
  ]
  // Route with a splat segment must be the last segment before the handle
  | [
    ...(LiteralSegment | ParamSegment)[],
    SplatSegment,
    HandleSegment,
  ]

const ROUTE_PATH_REGEX = /^\/?(.*\/?)(_(server|page|layout))\.(jsx?|tsx?)$/

type RoutePathMatch = [
  path: string,
  kind: string,
  kind: string,
  ext: string,
]

type DirectoryRoute = {
  path: string
  route: SegmentRoute
  splat: boolean
  depth: number
}

export function segmentPath(path: string): Segment[] | null {
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
          extension: ext as Extension,
        }
      } else if (kind === "page") {
        return {
          type: "PageHandle",
          text: s as `_page.${Extension}`,
          handle: "page",
          extension: ext as Extension,
        }
      } else if (kind === "layout") {
        return {
          type: "LayoutHandle",
          text: s as `_layout.${Extension}`,
          handle: "layout",
          extension: ext as Extension,
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
    return null
  }

  return segments as Segment[]
}

export function parseRoute(
  path: string,
): SegmentRoute | null {
  const segs = segmentPath(path)
  if (!segs) return null

  const handle = segs.at(-1)

  if (
    !handle
    || (
      handle.type !== "ServerHandle"
      && handle.type !== "PageHandle"
      && handle.type !== "LayoutHandle"
    )
  ) {
    return null
  }

  // Validate Route constraints: splat segments must be the last segment before the handle
  const pathSegments = segs.slice(0, -1) // All segments except the handle
  const splatIndex = pathSegments.findIndex(seg => seg.type === "Splat")

  if (splatIndex !== -1) {
    // If there's a splat, it must be the last path segment
    if (splatIndex !== pathSegments.length - 1) {
      return null // Invalid: splat is not the last path segment
    }

    // Validate that all segments before the splat are literal or param
    for (let i = 0; i < splatIndex; i++) {
      const seg = pathSegments[i]
      if (seg.type !== "Literal" && seg.type !== "Param") {
        return null
      }
    }
  } else {
    // No splat: validate that all path segments are literal or param
    for (const seg of pathSegments) {
      if (
        seg.type !== "Literal"
        && seg.type !== "Param"
      ) {
        return null
      }
    }
  }

  return segs as SegmentRoute
}

export function walkRoutesDirectory(
  dir: string,
): Effect.Effect<DirectoryRoute[], PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const files = yield* fs.readDirectory(dir, { recursive: true })

    return getDirectoryRoutesFromPaths(files)
  })
}

/**
 * Given a list of paths, return a list of directory routes.
 * Routes are sorted by depth, splats are put at the end for each segment, like so:
 * - _layout.tsx
 * - users/_page.tsx
 * - users/$userId/_page.tsx
 * - $/_page.tsx
 */
export function getDirectoryRoutesFromPaths(
  paths: string[],
): DirectoryRoute[] {
  return paths
    .map(f => f.match(ROUTE_PATH_REGEX) as RoutePathMatch)
    .filter(Boolean)
    .map(v => {
      const path = v[0]
      const route = parseRoute(path)!
      const segments = path.split("/")
      const splat = /(^|\/)\$\//.test(path)

      return {
        path,
        route,
        splat,
        depth: segments.length,
      }
    })
    .filter(f => f.route !== null)
    .toSorted((a, b) => {
      return (
        // splat is a dominant factor
        (+a.splat - +b.splat) * 1000
        // depth is reversed for splats
        + (a.depth - b.depth) * (1 - 2 * +a.splat)
        // lexicographic comparison as tiebreaker
        + a.path.localeCompare(b.path) * 0.001
      )
    })
}

type RouteTree = {
  path: `/${string}`
  children?: RouteTree[]
}
