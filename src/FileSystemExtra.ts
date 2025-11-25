import * as Error from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Stream from "effect/Stream"
import * as NPath from "node:path"

const SOURCE_FILENAME = /\.(tsx?|jsx?|html?|css|json)$/

export type WatchEvent = {
  eventType: "rename" | "change"
  filename: string
  path: string
}

export const filterSourceFiles = (event: WatchEvent): boolean => {
  return SOURCE_FILENAME.test(event.path)
}

export const filterDirectory = (event: WatchEvent): boolean => {
  return event.path.endsWith("/")
}

export const watchSource = (
  opts?: {
    path?: string
    recursive?: boolean
    filter?: (event: WatchEvent) => boolean
  },
): Stream.Stream<WatchEvent, Error.PlatformError, FileSystem.FileSystem> => {
  const baseDir = opts?.path ?? process.cwd()
  const customFilter = opts?.filter

  return Function.pipe(
    Stream.unwrap(
      Effect.map(FileSystem.FileSystem, fs =>
        fs.watch(baseDir, { recursive: opts?.recursive ?? true })
      )
    ),
    Stream.mapEffect(e =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const relativePath = NPath.relative(baseDir, e.path)
        const eventType: "change" | "rename" = e._tag === "Update"
          ? "change"
          : "rename"
        const info = yield* Effect.either(fs.stat(e.path))
        const isDir = info._tag === "Right" && info.right.type === "Directory"
        return {
          eventType,
          filename: relativePath,
          path: isDir ? `${e.path}/` : e.path,
        }
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
}
