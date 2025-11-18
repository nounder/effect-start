import * as Error from "@effect/platform/Error"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Stream from "effect/Stream"
import type { WatchOptions } from "node:fs"
import * as NFSP from "node:fs/promises"
import * as NPath from "node:path"

const SOURCE_FILENAME = /\.(tsx?|jsx?|html?|css|json)$/

export type WatchEvent = {
  eventType: "rename" | "change"
  filename: string
  path: string
}

/**
 * Filter for source files based on file extension.
 */
export const filterSourceFiles = (event: WatchEvent): boolean => {
  return SOURCE_FILENAME.test(event.path)
}

/**
 * Filter for directories (paths ending with /).
 */
export const filterDirectory = (event: WatchEvent): boolean => {
  return event.path.endsWith("/")
}

/**
 * `@effect/platform` doesn't support recursive file watching.
 * This function implements that [2025-05-19]
 * Additionally, the filename is resolved to an absolute path.
 * If the path is a directory, it appends / to the path.
 */
export const watchSource = (
  opts?: WatchOptions & {
    path?: string
    filter?: (event: WatchEvent) => boolean
  },
): Stream.Stream<WatchEvent, Error.SystemError> => {
  const baseDir = opts?.path ?? process.cwd()
  const customFilter = opts?.filter

  let stream: Stream.Stream<NFSP.FileChangeInfo<string>, Error.SystemError>
  try {
    stream = Stream.fromAsyncIterable(
      NFSP.watch(baseDir, {
        persistent: opts?.persistent ?? false,
        recursive: opts?.recursive ?? true,
        encoding: opts?.encoding,
        signal: opts?.signal,
      }),
      error => handleWatchError(error, baseDir),
    )
  } catch (e) {
    const err = handleWatchError(e, baseDir)

    stream = Stream.fail(err)
  }

  const changes = Function.pipe(
    stream,
    Stream.mapEffect(e =>
      Effect.promise(() => {
        const resolvedPath = NPath.resolve(baseDir, e.filename!)
        return NFSP
          .stat(resolvedPath)
          .then(stat => ({
            eventType: e.eventType as "rename" | "change",
            filename: e.filename!,
            path: stat.isDirectory() ? `${resolvedPath}/` : resolvedPath,
          }))
          .catch(() => ({
            eventType: e.eventType as "rename" | "change",
            filename: e.filename!,
            path: resolvedPath,
          }))
      })
    ),
    customFilter ? Stream.filter(customFilter) : Function.identity,
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
