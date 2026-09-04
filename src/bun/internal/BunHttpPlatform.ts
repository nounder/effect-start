/**
 * Ported from effect@4.0.0-rc.112.
 */
import type * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Etag from "effect/unstable/http/Etag"
import * as Platform from "effect/unstable/http/HttpPlatform"
import * as Response from "effect/unstable/http/HttpServerResponse"
import * as NodeHttpCompression from "../../node/internal/NodeHttpCompression.ts"
import * as BunFileSystem from "../BunFileSystem.ts"

// Bun's CompressionStream supports an extended format set covering brotli and
// zstd
const compression = NodeHttpCompression.make(Platform.makeCompressionWeb({
  algorithms: ["gzip", "deflate", "br", "zstd"],
  transform: (algorithm) => Platform.compressionTransformWeb(algorithm === "br" ? "brotli" : algorithm),
}))

const make: Effect.Effect<
  Platform.HttpPlatform["Service"],
  never,
  FileSystem.FileSystem | Etag.Generator
> = Platform.make({
  platform: "bun",
  compression,
  fileResponse(path, status, statusText, headers, start, end, _contentLength) {
    let file = Bun.file(path)
    if (start > 0 || end !== undefined) {
      file = file.slice(start, end)
    }
    return Response.raw(file, { headers, status, statusText })
  },
  fileWebResponse(file, status, statusText, headers, options) {
    const start = Number(options?.offset ?? 0)
    const end = options?.bytesToRead !== undefined ? start + Number(options.bytesToRead) : undefined
    const body = start > 0 || end !== undefined
      ? (file as File).slice(start, end, file.type)
      : file
    return Response.raw(body, { headers, status, statusText })
  },
})

export const layer = Layer.effect(Platform.HttpPlatform)(make).pipe(
  Layer.provide(BunFileSystem.layer),
  Layer.provide(Etag.layer),
)
