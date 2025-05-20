import { FileSystem } from "@effect/platform"
import { Effect } from "effect"
import * as NFS from "node:fs"
import * as NFSp from "node:fs/promises"
import * as NPath from "node:path"

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
    // example: '+server.ts'
    type: "ServerHandle"
    extension: Extension
  }
  | {
    // example: '+page.tsx'
    type: "PageHandle"
    extension: Extension
  }

type Segment =
  | PathSegment
  | HandleSegment

type Route = [
  ...Segment[],
  HandleSegment[],
]

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
      // 2. Handles: +server.ext, +page.ext
      if (s.startsWith("+")) {
        const parts = s.split(".")
        if (parts.length !== 2) {
          return null // e.g. /api/+server (missing ext) or +server.foo.bar
        }
        const [name, ext] = parts
        if (!["ts", "js", "tsx", "jsx"].includes(ext)) {
          return null // eg. +page.xyz
        }
        if (name === "+server") {
          return { type: "ServerHandle", extension: ext as Extension }
        }
        if (name === "+page") {
          return { type: "PageHandle", extension: ext as Extension }
        }
        return null // e.g. +invalid.ts
      }

      // [[name]]
      if (s.startsWith("[[") && s.endsWith("]]") && s.length >= 5) {
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
          return { type: "RestParam", text: s }
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

  if (
    !segs
    || segs.length === 0
    || segs.at(-1)?.type !== "ServerHandle"
    || segs.at(-1)?.type !== "PageHandle"
  ) {
    return null
  }

  return segs as Route
}

export function walkRotues(dir: string) {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem

    fs.readDirectory(dir, { recursive: true })
  })
}

export async function* walkRoutesDirectory(
  dir: string,
): AsyncGenerator<Route> {
  for (
    const path of await NFSp.readdir(dir, {
      recursive: true,
    })
  ) {
    const segs = extractRoute(path)

    if (segs) {
      yield segs
    }
  }
}
