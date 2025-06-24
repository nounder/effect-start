import { Error } from "@effect/platform"
import {
  Effect,
  pipe,
  Stream,
} from "effect"
import type {
  FSWatcher,
  WatchOptions,
} from "node:fs"
import * as NFS from "node:fs"

type FileChangeInfo = {
  eventType: string
  filename: string
}
import * as NPath from "node:path"
import type { BundleEvent } from "./Bundle.ts"

const SOURCE_FILENAME = /(?:\.(?:tsx?|jsx?|html?|css|json)|[^.\/]+)$/

/**
 * `@effect/platform` doesn't support recursive file watching.
 * This function implements that [2025-05-19]
 */
export const watchFileChanges = (
  path?: string,
  opts?: WatchOptions,
  fsImpl: Pick<typeof NFS, "watch"> = NFS,
): Stream.Stream<BundleEvent, Error.SystemError> => {
  const baseDir = path ?? process.cwd()

  const stream = Stream.asyncScoped<FileChangeInfo, Error.SystemError>((emit) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const watcher = fsImpl.watch(
          baseDir,
          {
            persistent: false,
            recursive: true,
            ...(opts || {}),
          },
          (eventType, filename) => {
            if (filename) {
              emit.single({ eventType, filename })
            }
          },
        )

        watcher.on("error", (err) => emit.fail(handleWatchError(err, baseDir)))
        watcher.on("close", () => emit.end())

        return watcher
      }),
      (watcher) => Effect.sync(() => watcher.close()),
    )
  )

  const changes = pipe(
    stream,
    Stream.filter((event) => SOURCE_FILENAME.test(event.filename)),
    Stream.filter((event) => !(/node_modules/.test(event.filename))),
    Stream.rechunk(1),
    Stream.throttle({
      units: 1,
      cost: () => 1,
      duration: "400 millis",
      strategy: "enforce",
    }),
    Stream.map((event) => ({
      type: "Change" as const,
      path: NPath.resolve(baseDir, event.filename),
    })),
  )

  return changes
}

const handleWatchError = (error: any, path: string) =>
  new Error.SystemError({
    module: "FileSystem",
    reason: "Unknown",
    method: "watch",
    pathOrDescriptor: path,
  })
