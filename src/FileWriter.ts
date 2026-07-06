import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"
import * as FileSystem from "./FileSystem.ts"
import type * as System from "./System.ts"

export interface FileWriter {
  readonly append: (content: string) => Effect.Effect<void>
  readonly flush: Effect.Effect<void>
}

export interface Options {
  readonly path: string
  readonly mode?: number | undefined
  readonly batchWindow?: Duration.DurationInput | undefined
  readonly truncateSize?: FileSystem.SizeInput | undefined
  readonly truncateAlignLines?: boolean | undefined
}

const newline = 10

const keepTail = (contents: Uint8Array, keep: number, alignLines: boolean): Uint8Array => {
  if (keep <= 0) return contents.subarray(0, 0)
  if (contents.length <= keep) return contents
  const start = contents.length - keep
  if (!alignLines || contents[start - 1] === newline) return contents.subarray(start)
  const boundary = contents.indexOf(newline, start)
  return boundary === -1 ? contents.subarray(start) : contents.subarray(boundary + 1)
}

export const build = (
  options: Options,
): Effect.Effect<FileWriter, System.SystemError, Scope.Scope | FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const path = options.path
    const fs = yield* FileSystem.FileSystem
    const encoder = new TextEncoder()
    const truncateSize = options.truncateSize !== undefined ? Number(FileSystem.Size(options.truncateSize)) : undefined
    const alignLines = options.truncateAlignLines ?? true
    const file = yield* fs.open(path, { flag: "a+", mode: options.mode })
    let written = Number((yield* file.stat).size)

    const semaphore = Effect.unsafeMakeSemaphore(1)
    const write = (bytes: Uint8Array) =>
      semaphore.withPermits(1)(Effect.gen(function*() {
        if (truncateSize !== undefined && written > 0 && written + bytes.length > truncateSize) {
          const tail = keepTail(yield* fs.readFile(path), truncateSize - bytes.length, alignLines)
          yield* file.truncate()
          yield* file.seek(0, "start")
          if (tail.length > 0) yield* file.writeAll(tail)
          written = tail.length
        }
        yield* file.writeAll(bytes)
        written += bytes.length
      }))

    let buffer: Array<string> = []
    const flush = Effect.suspend(() => {
      if (buffer.length === 0) return Effect.void
      const pending = buffer
      buffer = []
      return Effect.ignore(write(encoder.encode(pending.join("\n") + "\n")))
    })

    if (options.batchWindow === undefined) {
      return {
        append: (content) => Effect.ignore(write(encoder.encode(content + "\n"))),
        flush: Effect.void,
      }
    }

    yield* Effect.forkScoped(Effect.forever(Effect.zipRight(Effect.sleep(options.batchWindow), flush)))
    yield* Effect.addFinalizer(() => flush)

    return {
      append: (content) =>
        Effect.sync(() => {
          buffer.push(content)
        }),
      flush,
    }
  })
