import { Error } from "@effect/platform"
import {
  Effect,
  pipe,
  Stream,
} from "effect"
import type { WatchOptions } from "node:fs"
import * as NFSP from "node:fs/promises"
import type { BundleEvent } from "./Bundle.ts"

const SOURCE_FILENAME = /\.(tsx?|jsx?|html?|css|json)$/

/**
 * `@effect/platform` doesn't support recursive file watching.
 * This function implements that [2025-05-19]
 */
export const watchFileChanges = (
  path?: string,
  opts?: WatchOptions,
): Stream.Stream<BundleEvent, Error.SystemError> => {
  const baseDir = path ?? process.cwd()

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
    Stream.filter((event) => SOURCE_FILENAME.test(event.filename!)),
    Stream.filter((event) => !(/node_modules/.test(event.filename!))),
    Stream.rechunk(1),
    Stream.throttle({
      units: 1,
      cost: () => 1,
      duration: "400 millis",
      strategy: "enforce",
    }),
    Stream.map((event) => ({
      type: "Change" as const,
      // it's relative to the baseDir
      path: event.filename!,
    })),
  )

  return changes
}

const handleWatchError = (error: any, path: string) =>
  Error.SystemError({
    module: "FileSystem",
    reason: "Unknown",
    method: "watch",
    pathOrDescriptor: path,
    message: error.message,
  })
