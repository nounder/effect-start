/**
 * Ported from effect@4.0.0-rc.112.
 */
import * as Effect from "effect/Effect"
import * as HttpBody from "effect/unstable/http/HttpBody"
import type * as Platform from "effect/unstable/http/HttpPlatform"
import * as Response from "effect/unstable/http/HttpServerResponse"
import type { Duplex } from "node:stream"
import { Readable } from "node:stream"
import * as Zlib from "node:zlib"

export const algorithms: ReadonlySet<Platform.CompressionAlgorithm> = new Set(
  typeof Zlib.zstdCompress === "function"
    ? ["gzip", "deflate", "br", "zstd"]
    : ["gzip", "deflate", "br"],
)

const brotliParams = (level: number | undefined, sizeHint?: number): Zlib.BrotliOptions => {
  const params: Record<number, number> = {}
  if (level !== undefined) {
    params[Zlib.constants.BROTLI_PARAM_QUALITY] = level
  }
  if (sizeHint !== undefined) {
    params[Zlib.constants.BROTLI_PARAM_SIZE_HINT] = sizeHint
  }
  return { params }
}

const zstdParams = (level: number | undefined): Zlib.ZstdOptions | undefined =>
  level === undefined || level === 3 ? undefined : { params: { [Zlib.constants.ZSTD_c_compressionLevel]: level } }

const compress = (
  data: Uint8Array,
  algorithm: Platform.CompressionAlgorithm,
  options?: Platform.CompressionOptions | undefined,
): Effect.Effect<Uint8Array> =>
  Effect.callback((resume) => {
    const complete = (error: Error | null, result: Uint8Array) =>
      resume(error === null ? Effect.succeed(result) : Effect.die(error))
    switch (algorithm) {
      case "gzip": {
        Zlib.gzip(data, { level: options?.level }, complete)
        break
      }
      case "deflate": {
        Zlib.deflate(data, { level: options?.level }, complete)
        break
      }
      case "br": {
        Zlib.brotliCompress(data, brotliParams(options?.level, data.byteLength), complete)
        break
      }
      case "zstd": {
        const params = zstdParams(options?.level)
        if (params === undefined) {
          Zlib.zstdCompress(data, complete)
        } else {
          Zlib.zstdCompress(data, params, complete)
        }
        break
      }
    }
  })

export const make = (fallback: Platform.Compression): Platform.Compression => ({
  algorithms: fallback.algorithms,
  compressResponse(response, algorithm, options) {
    const body = response.body
    if (body._tag !== "Uint8Array") {
      return fallback.compressResponse(response, algorithm, options)
    }
    return Effect.map(compress(body.body, algorithm, options), (result) =>
      Response.setHeader(
        Response.setBody(response, HttpBody.uint8Array(result, body.contentType)),
        "content-length",
        result.byteLength.toString(),
      ))
  },
})

export const compressTransform = (
  algorithm: Platform.CompressionAlgorithm,
  options?: Platform.CompressionOptions | undefined,
): Duplex => {
  switch (algorithm) {
    case "gzip": {
      return Zlib.createGzip({ level: options?.level, flush: Zlib.constants.Z_SYNC_FLUSH })
    }
    case "deflate": {
      return Zlib.createDeflate({ level: options?.level, flush: Zlib.constants.Z_SYNC_FLUSH })
    }
    case "br": {
      return Zlib.createBrotliCompress({
        ...brotliParams(options?.level),
        flush: Zlib.constants.BROTLI_OPERATION_FLUSH,
      })
    }
    case "zstd": {
      return Zlib.createZstdCompress({
        ...zstdParams(options?.level),
        flush: Zlib.constants.ZSTD_e_flush,
      })
    }
  }
}

export const compressTransformWeb = (
  algorithm: Platform.CompressionAlgorithm,
  options?: Platform.CompressionOptions | undefined,
) =>
(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> => {
  const transform = compressTransform(algorithm, options)
  const source = Readable.fromWeb(stream as any)
  source.on("error", (cause) => transform.destroy(cause))
  transform.on("close", () => source.destroy())
  return Readable.toWeb(source.pipe(transform)) as unknown as ReadableStream<Uint8Array>
}
