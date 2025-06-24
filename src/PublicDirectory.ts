import {
  HttpApp,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { FileSystem } from "@effect/platform"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import {
  Effect,
  pipe,
} from "effect"
import * as NPath from "node:path"

export interface PublicDirectoryOptions {
  readonly directory?: string
  readonly prefix?: string
}

export const publicDirectory = (
  options: PublicDirectoryOptions = {},
): HttpApp.Default<RouteNotFound, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const fs = yield* FileSystem.FileSystem
    
    const directory = options.directory ?? NPath.join(process.cwd(), "public")
    const prefix = options.prefix ?? ""
    
    const url = new URL(request.url)
    let pathname = decodeURIComponent(url.pathname)
    
    if (prefix && !pathname.startsWith(prefix)) {
      return yield* Effect.fail(new RouteNotFound({ request }))
    }
    
    if (prefix) {
      pathname = pathname.slice(prefix.length)
    }
    
    if (pathname.startsWith("/")) {
      pathname = pathname.slice(1)
    }
    
    if (pathname === "") {
      pathname = "index.html"
    }
    
    const filePath = NPath.join(directory, pathname)
    
    if (!filePath.startsWith(directory)) {
      return yield* Effect.fail(new RouteNotFound({ request }))
    }
    
    const exists = yield* pipe(
      fs.exists(filePath),
      Effect.catchAll(() => Effect.succeed(false))
    )
    
    if (!exists) {
      return yield* Effect.fail(new RouteNotFound({ request }))
    }
    
    const stat = yield* pipe(
      fs.stat(filePath),
      Effect.catchAll(() => Effect.fail(new RouteNotFound({ request })))
    )
    
    if (stat.type !== "File") {
      return yield* Effect.fail(new RouteNotFound({ request }))
    }
    
    const content = yield* pipe(
      fs.readFile(filePath),
      Effect.catchAll(() => Effect.fail(new RouteNotFound({ request })))
    )
    
    const mimeType = getMimeType(filePath)
    
    return HttpServerResponse.uint8Array(content, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600",
      },
    })
  })

function getMimeType(filePath: string): string {
  const ext = NPath.extname(filePath).toLowerCase()
  
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain",
    ".pdf": "application/pdf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".eot": "application/vnd.ms-fontobject",
  }
  
  return mimeTypes[ext] ?? "application/octet-stream"
}