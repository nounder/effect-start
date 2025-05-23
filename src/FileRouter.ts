import { FileSystem } from "@effect/platform"
import { Effect } from "effect"

export type PathSegment =
  | {
    type: "Literal"
    text: string // eg. "users"
  }
  | {
    type: "Param"
    param: string // eg. "userId"
    text: string // eg. "$userId"
  }
  | {
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
  | PathSegment
  | HandleSegment

export type Route = [
  ...Segment[],
  HandleSegment[],
]

const ROUTE_PATH_REGEX = /^\/?(.*\/?)(server|page|layout)\.(jsx?|tsx?)$/

type RoutePathMatch = [path: string, kind: string, ext: string]

export function extractSegments(path: string): Segment[] | null {
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

function extractRoute(path: string): Route | null {
  const segs = extractSegments(path)
  const handle = segs?.at(-1)

  if (
    !handle
    || (handle.type !== "ServerHandle"
      && handle.type !== "PageHandle"
      && handle.type !== "LayoutHandle")
  ) {
    return null
  }

  return segs as Route
}

/**
 * Finds all route files in directory.
 *
 * Routes are sorted by depth, like so:
 * - layout.tsx
 * - $users/page.tsx
 * - $users/$userId/page.tsx
 * - $/page.tsx
 */
export function walkRoutes(dir: string) {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const baseDir = dir.replace(/\/$/, "")
    const files = yield* fs.readDirectory(dir, { recursive: true })

    const filteredFiles = files
      .map(f => f.match(ROUTE_PATH_REGEX) as RoutePathMatch)
      .filter(Boolean)
      .toSorted((a, b) =>
        (a.length > b.length ? 1 : -1)
        + a[0].localeCompare(b[1])
        + a[1].localeCompare(b[1])
      )
      .map(v => {
        const path = v[0]
        const route = extractRoute(path)!

        return {
          path,
          route,
        }
      })

    return filteredFiles
  })
}
