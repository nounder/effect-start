import { Error, FileSystem } from "@effect/platform"
import { Effect, Stream } from "effect"
import * as NFS from "node:fs"

/**
 * Watch function with node.js options.
 *
 * Borrowed from:
 * @effect/platform-node-shared/src/internal/fileSystem.ts
 */
export const watchNodeWithOptions =
  (fs: FileSystem.FileSystem) => (path: string, opts: NFS.WatchOptions = {}) =>
    Stream.asyncScoped<FileSystem.WatchEvent, Error.PlatformError>((emit) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const watcher = NFS.watch(path, opts, (event, path) => {
            if (!path) return
            switch (event) {
              case "rename": {
                emit.fromEffect(Effect.match(fs.stat(path), {
                  onSuccess: (_) => FileSystem.WatchEventCreate({ path }),
                  onFailure: (_) => FileSystem.WatchEventRemove({ path }),
                }))
                return
              }
              case "change": {
                emit.single(FileSystem.WatchEventUpdate({ path }))
                return
              }
            }
          })
          watcher.on("error", (error) => {
            emit.fail(Error.SystemError({
              module: "FileSystem",
              reason: "Unknown",
              method: "watch",
              pathOrDescriptor: path,
              message: error.message,
            }))
          })
          watcher.on("close", () => {
            emit.end()
          })
          return watcher
        }),
        (watcher) => Effect.sync(() => watcher.close()),
      )
    )
