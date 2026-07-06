import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Logger from "effect/Logger"
import * as NPath from "node:path"
import * as FileLogger from "../src/FileLogger.ts"
import * as FileSystem from "../src/FileSystem.ts"
import * as NodeFileSystem from "../src/node/NodeFileSystem.ts"

const withTempDir = <A, E>(
  f: (dir: string) => Effect.Effect<A, E, FileSystem.FileSystem>,
) =>
  Effect
    .gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const dir = yield* fs.makeTempDirectoryScoped()
      return yield* f(dir)
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    )

test.it("writes log lines to the file", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "app.log")

      const loggerLayer = Logger.replaceScoped(
        Logger.defaultLogger,
        FileLogger.toFile(Logger.logfmtLogger, { path }),
      )

      yield* Effect
        .gen(function*() {
          yield* Effect.log("hello")
          yield* Effect.log("world")
        })
        .pipe(Effect.provide(loggerLayer))

      const contents = yield* fs.readFileString(path)

      test
        .expect(contents)
        .toContain("message=hello")
      test
        .expect(contents)
        .toContain("message=world")
    })
  ))

test.it("writes multiple entries as separate lines", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "app.log")

      const loggerLayer = Logger.replaceScoped(
        Logger.defaultLogger,
        FileLogger.toFile(Logger.logfmtLogger, { path }),
      )

      yield* Effect
        .gen(function*() {
          yield* Effect.log("one")
          yield* Effect.log("two")
          yield* Effect.log("three")
        })
        .pipe(Effect.provide(loggerLayer))

      const lines = (yield* fs.readFileString(path)).trimEnd().split("\n")

      test
        .expect(lines.length)
        .toBe(3)
      test
        .expect(lines.every((line) => line.startsWith("timestamp=")))
        .toBe(true)
    })
  ))

test.it("respects a custom batch window and flushes on close", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "app.log")

      const loggerLayer = Logger.replaceScoped(
        Logger.defaultLogger,
        FileLogger.toFile(Logger.logfmtLogger, { path, batchWindow: "1 hour" }),
      )

      yield* Effect.log("buffered").pipe(Effect.provide(loggerLayer))

      test
        .expect(yield* fs.readFileString(path))
        .toContain("message=buffered")
    })
  ))

test.it("data-last form pipes onto a logger", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "app.log")

      const fileLogger = Logger.logfmtLogger.pipe(FileLogger.toFile({ path }))
      const loggerLayer = Logger.replaceScoped(Logger.defaultLogger, fileLogger)

      yield* Effect.log("piped").pipe(Effect.provide(loggerLayer))

      test
        .expect(yield* fs.readFileString(path))
        .toContain("message=piped")
    })
  ))

test.it("composes with another logger via zip", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "app.log")

      const captured: Array<string> = []
      const spy = Logger.make((options) => captured.push(String(options.message)))
      const both = Effect.map(
        Logger.logfmtLogger.pipe(FileLogger.toFile({ path })),
        (fileLogger) => Logger.zip(spy, fileLogger),
      )
      const loggerLayer = Logger.replaceScoped(Logger.defaultLogger, both)

      yield* Effect.log("both").pipe(Effect.provide(loggerLayer))

      test
        .expect(captured)
        .toEqual(["both"])
      test
        .expect(yield* fs.readFileString(path))
        .toContain("message=both")
    })
  ))
