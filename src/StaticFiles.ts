import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Entity from "./Entity.ts"
import * as FileSystem from "./FileSystem.ts"
import type * as PathPattern from "./internal/PathPattern.ts"
import * as Mime from "./internal/Mime.ts"
import * as Route from "./Route.ts"
import * as RouteSchema from "./RouteSchema.ts"

const defaultMountPath = "/assets"
const PathParamsSchema = Schema.Struct({
  path: Schema.optional(Schema.String),
})

const emptyNotFound = Entity.make(new Uint8Array(0), { status: 404 })

export const make = (directory: string) =>
  Route.get(
    RouteSchema.schemaPathParams(PathParamsSchema),
    Route.render(function* (ctx) {
      const fs = yield* FileSystem.FileSystem
      const relativePath =
        typeof ctx.pathParams.path === "string" ? normalizeRelativePath(ctx.pathParams.path) : null

      if (!relativePath) {
        return emptyNotFound
      }

      const absolutePath = `${directory.replace(/[\\/]+$/, "")}/${relativePath}`
      const info = yield* fs
        .stat(absolutePath)
        .pipe(
          Effect.catchAll((error) =>
            isNotFound(error) ? Effect.succeed(null) : Effect.fail(error),
          ),
        )

      if (info === null || info.type !== "File") {
        return emptyNotFound
      }

      const bytes = yield* fs.readFile(absolutePath)
      return Entity.make(bytes, {
        headers: {
          "content-length": String(info.size),
          "content-type": Mime.fromPath(relativePath),
          ...(Option.isSome(info.mtime) ? { "last-modified": info.mtime.value.toUTCString() } : {}),
        },
      })
    }),
  )

export const layer = (options: { directory: string; path?: string }) => {
  const trimmedMountPath = (options.path ?? defaultMountPath).trim().replace(/^\/+|\/+$/g, "")
  const mountPattern = (
    trimmedMountPath.length > 0 ? `/${trimmedMountPath}/:path+` : "/:path+"
  ) as PathPattern.PathPattern
  return Route.layerMerge({
    [mountPattern]: make(options.directory),
  })
}

function normalizeRelativePath(path: string): string | null {
  if (path.length === 0 || path.startsWith("/") || path.startsWith("\\")) {
    return null
  }

  const segments = path.split(/[\\/]+/)
  const normalized: Array<string> = []

  for (const segment of segments) {
    if (segment === "" || segment === ".") {
      continue
    }
    if (segment === ".." || segment.includes("\0")) {
      return null
    }
    normalized.push(segment)
  }

  return normalized.length > 0 ? normalized.join("/") : null
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "SystemError" &&
    "reason" in error &&
    error.reason === "NotFound"
  )
}
