/**
 * Ported from effect@4.0.0-rc.112.
 */
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as PlatformError from "effect/PlatformError"
import * as NodePath from "node:path"
import * as NodeUrl from "node:url"

const fileUrlOps = (windows: boolean | undefined) => ({
  fromFileUrl: (url: URL): Effect.Effect<string, PlatformError.BadArgument> =>
    Effect.try({
      try: () => NodeUrl.fileURLToPath(url, { windows }),
      catch: (cause) =>
        new PlatformError.BadArgument({
          module: "Path",
          method: "fromFileUrl",
          cause,
        }),
    }),
  toFileUrl: (path: string): Effect.Effect<URL, PlatformError.BadArgument> =>
    Effect.try({
      try: () => NodeUrl.pathToFileURL(path, { windows }),
      catch: (cause) =>
        new PlatformError.BadArgument({
          module: "Path",
          method: "toFileUrl",
          cause,
        }),
    }),
})

export const layerPosix: Layer.Layer<Path.Path> = Layer.succeed(Path.Path)({
  [Path.TypeId]: Path.TypeId,
  ...NodePath.posix,
  ...fileUrlOps(false),
})

export const layerWin32: Layer.Layer<Path.Path> = Layer.succeed(Path.Path)({
  [Path.TypeId]: Path.TypeId,
  ...NodePath.win32,
  ...fileUrlOps(true),
})

export const layer: Layer.Layer<Path.Path> = Layer.succeed(Path.Path)({
  [Path.TypeId]: Path.TypeId,
  ...NodePath,
  ...fileUrlOps(undefined),
})
