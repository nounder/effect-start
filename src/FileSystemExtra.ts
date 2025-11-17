import { Error } from "@effect/platform"
import {
  Console,
  pipe,
  Stream,
} from "effect"
import type { WatchOptions } from "node:fs"
import * as NFSP from "node:fs/promises"
import * as NPath from "node:path"

const SOURCE_FILENAME = /\.(tsx?|jsx?|html?|css|json)$/

/**
 * `@effect/platform` doesn't support recursive file watching.
 * This function implements that [2025-05-19]
 * Additionally, the filename is resolved to an absolute path.
 */
export const watchSource = (
  path?: string,
  opts?: WatchOptions & { filterSourceFiles?: boolean },
): Stream.Stream<NFSP.FileChangeInfo<string>, Error.SystemError> => {
  const baseDir = path ?? process.cwd()
  const filterSourceFiles = opts?.filterSourceFiles ?? true

  let stream: Stream.Stream<NFSP.FileChangeInfo<string>, Error.SystemError>
  try {
    stream = Stream.fromAsyncIterable(
      NFSP.watch(baseDir, {
        persistent: false,
        recursive: true,
        ...(opts || {}),
      }),
      error => handleWatchError(error, baseDir),
    )
  } catch (e) {
    const err = handleWatchError(e, baseDir)

    stream = Stream.fail(err)
  }

  const changes = pipe(
    stream,
    Stream.map(e => ({
      eventType: e.eventType,
      filename: NPath.resolve(baseDir, e.filename!),
    })),
    // Optionally filter by source file extensions
    filterSourceFiles
      ? Stream.filter((event) => SOURCE_FILENAME.test(event.filename!))
      : Stream.identity,
    Stream.filter((event) => !(/node_modules/.test(event.filename!))),
    Stream.rechunk(1),
    Stream.throttle({
      units: 1,
      cost: () => 1,
      duration: "400 millis",
      strategy: "enforce",
    }),
  )

  return changes
}

const handleWatchError = (error: any, path: string) =>
  new Error.SystemError({
    module: "FileSystem",
    reason: "Unknown",
    method: "watch",
    pathOrDescriptor: path,
    cause: error,
  })
