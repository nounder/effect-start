import {
  FileSystem,
} from "@effect/platform"
import {
  Effect,
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
    // example: 'server.ts'
    type: "ServerHandle"
    extension: Extension
  }
  | {
    // example: 'page.tsx'
    type: "PageHandle"
    extension: Extension
  }
  | {
    // example: 'layout.tsx'
    type: "LayoutHandle"
    extension: Extension
  }

export type Segment =
  | LiteralSegment
  | ParamSegment
  | SplatSegment
  | HandleSegment

export type Route =
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

const ROUTE_PATH_REGEX = /^\/?(.*\/?)(server|page|layout)\.(jsx?|tsx?)$/

type RoutePathMatch = [path: string, kind: string, ext: string]

export function parsePath(path: string): Segment[] | null {
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
      // Check if it's a handle (server.ts, page.tsx, layout.jsx, etc.)
      const [, kind, ext] = s.match(/^(server|page|layout)\.(tsx?|jsx?)$/)
        ?? []

      if (kind === "server") {
        return { type: "ServerHandle", extension: ext as Extension }
      } else if (kind === "page") {
        return { type: "PageHandle", extension: ext as Extension }
      } else if (kind === "layout") {
        return { type: "LayoutHandle", extension: ext as Extension }
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
        return { type: "Literal", text: s }
      }

      return null
    },
  )

  if (segments.some((seg) => seg === null)) {
    return null
  }

  return segments as Segment[]
}

export function extractRoute(path: string): Route | null {
  const segs = parsePath(path)
  if (!segs) return null

  const handle = segs.at(-1)

  if (
    !handle
    || (handle.type !== "ServerHandle"
      && handle.type !== "PageHandle"
      && handle.type !== "LayoutHandle")
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

  return segs as Route
}

/**
 * Finds all route files in directory.
 *
 * Routes are sorted by depth, like so:
 * - layout.tsx
 * - users/page.tsx
 * - users/$userId/page.tsx
 * - $/page.tsx
 */
export function walkRoutes(dir: string) {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const files = yield* fs.readDirectory(dir, { recursive: true })

    const filteredFiles = files
      .map(f => f.match(ROUTE_PATH_REGEX) as RoutePathMatch)
      .filter(Boolean)
      .map(v => {
        const path = v[0]
        const route = extractRoute(path)
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
        const aSplat = +a.splat
        const bSplat = +b.splat

        return (
          // splat is a dominant factor
          (aSplat - bSplat) * 1000
          // depth is reversed for splats
          + (a.depth - b.depth) * (1 - 2 * aSplat)
          // lexicographic comparison as tiebreaker
          + a.path.localeCompare(b.path) * 0.001
        )
      })

    return filteredFiles
  })
}
