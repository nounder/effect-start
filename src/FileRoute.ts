import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as NPath from "node:path"
import * as NUrl from "node:url"
import * as Entity from "./Entity.ts"
import * as FileSystem from "./FileSystem.ts"
import * as ContentNegotiation from "./internal/ContentNegotiation.ts"
import * as Mime from "./internal/Mime.ts"
import * as Route from "./Route.ts"

const notFound = Entity.make(new Uint8Array(0), { status: 404 })

export const from = (options: { path: string | URL; directoryIndex: boolean }) => {
  const rootPath = options.path instanceof URL || options.path.startsWith("file://")
    ? NUrl.fileURLToPath(options.path)
    : options.path

  return Route.get(
    Route.schemaPathParams(Schema.Struct({
      path: Schema.optional(Schema.String),
    })),
    Route.handle((ctx) =>
      Effect
        .gen(function*() {
          const fs = yield* FileSystem.FileSystem
          const normalized = normalizeRelativePath(ctx.pathParams.path)
          if (normalized === null) return notFound

          const rootInfo = yield* fs.stat(rootPath)
          if (rootInfo.type !== "Directory" && normalized !== "") return notFound
          const filePath = rootInfo.type === "Directory" && normalized !== ""
            ? NPath.join(rootPath, normalized)
            : rootPath
          const info = filePath === rootPath ? rootInfo : yield* fs.stat(filePath)

          if (info.type === "File") {
            const request = yield* Route.Request
            const mtime = Option.getOrUndefined(info.mtime)
            const etag = `"${Math.floor((mtime?.getTime() ?? 0) / 1000).toString(16)}-${info.size.toString(16)}"`
            const headers = {
              "accept-ranges": "bytes",
              "content-type": Mime.fromPath(filePath),
              etag,
              ...(mtime ? { "last-modified": mtime.toUTCString() } : {}),
            }
            const ifMatch = request.headers.get("if-match")
            if (ifMatch !== null && !etagMatches(ifMatch, etag, false)) {
              return Entity.make(new Uint8Array(0), { status: 412, headers })
            }
            const ifUnmodifiedSince = request.headers.get("if-unmodified-since")
            if (
              ifMatch === null &&
              mtime !== undefined &&
              ifUnmodifiedSince !== null &&
              modifiedAfter(mtime, ifUnmodifiedSince) === true
            ) {
              return Entity.make(new Uint8Array(0), { status: 412, headers })
            }

            const ifNoneMatch = request.headers.get("if-none-match")
            if (ifNoneMatch !== null && etagMatches(ifNoneMatch, etag, true)) {
              return Entity.make(new Uint8Array(0), { status: 304, headers })
            }
            const ifModifiedSince = request.headers.get("if-modified-since")
            if (
              ifNoneMatch === null &&
              mtime !== undefined &&
              ifModifiedSince !== null &&
              modifiedAfter(mtime, ifModifiedSince) === false
            ) {
              return Entity.make(new Uint8Array(0), { status: 304, headers })
            }

            const size = Number(info.size)
            const rangeHeader = request.headers.get("range")
            const ifRange = request.headers.get("if-range")
            const useRange = rangeHeader !== null &&
              (ifRange === null ||
                ifRange === etag ||
                (mtime !== undefined &&
                  !ifRange.startsWith("W/") &&
                  modifiedAfter(mtime, ifRange) === false))
            const range = useRange ? parseRange(rangeHeader, size) : null
            if (range === "unsatisfiable") {
              return Entity.make(new Uint8Array(0), {
                status: 416,
                headers: {
                  ...headers,
                  "content-range": `bytes */${size}`,
                },
              })
            }

            const bytes = yield* fs.readFile(filePath)
            if (range !== null) {
              const body = bytes.slice(range.start, range.end + 1)
              return Entity.make(body, {
                status: 206,
                headers: {
                  ...headers,
                  "content-length": String(body.length),
                  "content-range": `bytes ${range.start}-${range.end}/${size}`,
                },
              })
            }
            return Entity.make(bytes, {
              headers: {
                ...headers,
                "content-length": String(info.size),
              },
            })
          }
          if (info.type !== "Directory" || !options.directoryIndex) return notFound

          const names = (yield* fs.readDirectory(filePath)).sort((a, b) => a.localeCompare(b))
          const entries = yield* Effect.forEach(names, (name) =>
            fs.stat(NPath.join(filePath, name)).pipe(
              Effect.map((info) => ({ name, info })),
            ))
          const directories = entries.filter((entry) => entry.info.type === "Directory")
          const files = entries.filter((entry) => entry.info.type === "File")
          const request = yield* Route.Request
          const format = ContentNegotiation
            .media(
              request.headers.get("accept") ?? "*/*",
              ["application/json", "text/html"],
            )[0]

          const pathParam = ctx.pathParams.path?.replace(/^\/+|\/+$/g, "") ?? ""
          const pathname = pathParam === "" ? "/" : `/${pathParam}/`
          if (format === "text/html") {
            return Entity.make(
              `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Index of ${escapeHtml(pathname)}</title>
  </head>
  <body>
    <h1>Index of ${escapeHtml(pathname)}</h1>
    <ul>
${
                [
                  ...directories.map((entry) =>
                    `      <li><a href="${pathname}${encodeURIComponent(entry.name)}/">${
                      escapeHtml(entry.name)
                    }/</a></li>`
                  ),
                  ...files.map((entry) =>
                    `      <li><a href="${pathname}${encodeURIComponent(entry.name)}">${
                      escapeHtml(entry.name)
                    }</a></li>`
                  ),
                ]
                  .join("\n")
              }
    </ul>
  </body>
</html>`,
              {
                headers: {
                  "content-type": "text/html; charset=utf-8",
                  vary: "Accept",
                },
              },
            )
          }
          if (format === "application/json") {
            return Entity.make(
              JSON.stringify({
                path: pathname,
                files: files.map((entry) => ({
                  name: entry.name,
                  size: Number(entry.info.size),
                  type: Mime.fromPath(entry.name, { charset: false }),
                  lastModified: Option.match(entry.info.mtime, {
                    onNone: () => 0,
                    onSome: (mtime) => mtime.getTime(),
                  }),
                })),
              }),
              {
                headers: {
                  "content-type": "application/json",
                  vary: "Accept",
                },
              },
            )
          }
          return Entity.make(JSON.stringify({ status: 406, message: "not acceptable" }), {
            status: 406,
            headers: {
              "content-type": "application/json",
              vary: "Accept",
            },
          })
        })
        .pipe(
          Effect.catchAll((error) => isNotFound(error) ? Effect.succeed(notFound) : Effect.fail(error)),
        )
    ),
  )
}

function normalizeRelativePath(path: string | undefined): string | null {
  if (path === undefined || path === "") return ""
  if (path.startsWith("/") || path.startsWith("\\")) return null

  const normalized: Array<string> = []
  for (const segment of path.split(/[\\/]+/)) {
    if (segment === "" || segment === ".") continue
    if (segment === ".." || segment.includes("\0")) return null
    normalized.push(segment)
  }
  return normalized.join(NPath.sep)
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "SystemError" &&
    "reason" in error &&
    error.reason === "NotFound"
}

function etagMatches(header: string, etag: string, weak: boolean): boolean {
  if (header.trim() === "*") return true
  const expected = weak ? etag.replace(/^W\//, "") : etag
  return header.split(",").some((value) => {
    const candidate = value.trim()
    if (!weak && candidate.startsWith("W/")) return false
    return (weak ? candidate.replace(/^W\//, "") : candidate) === expected
  })
}

function modifiedAfter(mtime: Date, value: string): boolean | null {
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  return Math.floor(mtime.getTime() / 1000) * 1000 > time
}

function parseRange(
  value: string,
  size: number,
): { start: number; end: number } | "unsatisfiable" | null {
  if (!value.startsWith("bytes=") || value.includes(",")) return null
  const match = /^(\d*)-(\d*)$/.exec(value.slice(6).trim())
  if (match === null || (match[1] === "" && match[2] === "")) return null

  if (match[1] === "") {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0 || size === 0) return "unsatisfiable"
    return { start: Math.max(size - suffixLength, 0), end: size - 1 }
  }

  const start = Number(match[1])
  const requestedEnd = match[2] === "" ? size - 1 : Number(match[2])
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start >= size ||
    start > requestedEnd
  ) {
    return "unsatisfiable"
  }
  return { start, end: Math.min(requestedEnd, size - 1) }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}
