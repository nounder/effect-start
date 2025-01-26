import { Error, FileSystem, HttpServerResponse } from "@effect/platform"
import {
  Console,
  Context,
  Effect,
  Fiber,
  Option,
  pipe,
  Schedule,
  Stream,
} from "effect"
import * as NFS from "node:fs"

export default Effect.gen(function*() {
  // keeps the connection open
  const heartbeat = Stream.repeat(
    Stream.succeed(undefined),
    Schedule.spaced("5 seconds"),
  )

  const rootDir = process.cwd()

  const fileChanges = pipe(
    watchNodeWithOptions(yield* FileSystem.FileSystem)(rootDir, {
      recursive: true,
    }),
    Stream.filter(event => event._tag === "Update"),
  )

  const encoder = new TextEncoder()

  const events = pipe(
    Stream.merge(heartbeat, fileChanges),
    Stream.map(event =>
      event !== undefined ? `data: ${JSON.stringify(event)}\n\n` : ":\n\n"
    ),
    Stream.map(str => encoder.encode(str)),
    Stream.throttle({
      units: 1,
      cost: () => 1,
      duration: "100 millis",
      strategy: "enforce",
    }),
  )

  return HttpServerResponse.stream(events, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
})

/**
 * Watch function with node.js options.
 *
 * Borrowed from:
 * @effect/platform-node-shared/src/internal/fileSystem.ts
 */
const watchNodeWithOptions =
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
