import { FileSystem } from "@effect/platform"
import { Effect } from "effect"

type PathSegment =
  | {
    type: "Literal"
    text: string // eg. "users"
  }
  | {
    type: "DynamicParam"
    text: string // eg. "userId"
  }
  | {
    type: "OptionalParam"
    text: string // eg. "userId"
  }
  | {
    type: "RestParam"
    text: string // eg. "[...name]"
  }

type Extension = "tsx" | "jsx" | "ts" | "js"

type HandleSegment =
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

type Segment =
  | PathSegment
  | HandleSegment

type Route = [
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

      // [[name]]
      if (/^\[\[\w+\]\]$/.test(s)) {
        const name = s.substring(2, s.length - 2)
        if (name !== "" && !name.startsWith("...")) {
          return { type: "OptionalParam", text: name }
        }
        // "[[...foo]]" falls through to Literal. Correctly formed "[[]]" already returned null.
      }

      // [...name]
      if (/^\[\.{3}\w+\]$/.test(s)) {
        const name = s.substring(4, s.length - 1)
        if (name !== "") {
          return { type: "RestParam", text: name }
        }
      }

      // [name]
      if (/^\[\w+\]$/.test(s)) {
        const name = s.substring(1, s.length - 1)
        if (name !== "") {
          return { type: "DynamicParam", text: name }
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
 * - [users]/page.tsx
 * - [users]/[userId]/page.tsx
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
      .map(v => `${baseDir}/${v[0]}`)

    return filteredFiles
  })
}
