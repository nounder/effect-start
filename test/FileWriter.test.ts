import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as NPath from "node:path"
import * as FileSystem from "../src/FileSystem.ts"
import * as FileWriter from "../src/FileWriter.ts"
import * as NodeFileSystem from "../src/node/NodeFileSystem.ts"

const withTempDir = <A, E>(
  f: (dir: string) => Effect.Effect<A, E, FileSystem.FileSystem>,
) =>
  Effect
    .gen(function*() {
      const fs = yield* FileSystem.FileSystem
      return yield* fs.makeTempDirectoryScoped()
    })
    .pipe(
      Effect.flatMap(f),
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    )

test.it("appends content immediately when not batched", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "out.txt")

      yield* Effect.scoped(Effect.gen(function*() {
        const writer = yield* FileWriter.build({ path })
        yield* writer.append("first")
        yield* writer.append("second")

        test
          .expect(yield* fs.readFileString(path))
          .toBe("first\nsecond\n")
      }))
    })
  ))

test.it("appends to an existing file rather than truncating", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "out.txt")
      yield* fs.writeFileString(path, "existing\n")

      yield* Effect.scoped(Effect.gen(function*() {
        const writer = yield* FileWriter.build({ path })
        yield* writer.append("new")
      }))

      test
        .expect(yield* fs.readFileString(path))
        .toBe("existing\nnew\n")
    })
  ))

test.it("does not write until flushed when batched", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "out.txt")

      yield* Effect.scoped(Effect.gen(function*() {
        const writer = yield* FileWriter.build({ path, batchWindow: "1 hour" })
        yield* writer.append("a")
        yield* writer.append("b")

        test
          .expect(yield* fs.readFileString(path))
          .toBe("")

        yield* writer.flush

        test
          .expect(yield* fs.readFileString(path))
          .toBe("a\nb\n")
      }))
    })
  ))

test.it("flushes the batch buffer on scope close", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "out.txt")

      yield* Effect.scoped(Effect.gen(function*() {
        const writer = yield* FileWriter.build({ path, batchWindow: "1 hour" })
        yield* writer.append("only")
      }))

      test
        .expect(yield* fs.readFileString(path))
        .toBe("only\n")
    })
  ))

test.it("flush is a no-op when the buffer is empty", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "out.txt")

      yield* Effect.scoped(Effect.gen(function*() {
        const writer = yield* FileWriter.build({ path, batchWindow: "1 hour" })
        yield* writer.flush
        yield* writer.flush
      }))

      test
        .expect(yield* fs.readFileString(path))
        .toBe("")
    })
  ))

test.it("drops oldest lines and keeps recent ones when over truncateSize", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "log.txt")

      yield* Effect.scoped(Effect.gen(function*() {
        const writer = yield* FileWriter.build({ path, truncateSize: 20 })
        yield* writer.append("line1")
        yield* writer.append("line2")
        yield* writer.append("line3")
        yield* writer.append("line4")
      }))

      test
        .expect(yield* fs.readFileString(path))
        .toBe("line2\nline3\nline4\n")
    })
  ))

test.it("only keeps whole lines when trimming", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "log.txt")

      yield* Effect.scoped(Effect.gen(function*() {
        const writer = yield* FileWriter.build({ path, truncateSize: 13 })
        yield* writer.append("aaaaaaaa")
        yield* writer.append("bb")
        yield* writer.append("cc")
      }))

      const lines = (yield* fs.readFileString(path)).split("\n").filter((line) => line.length > 0)

      test
        .expect(lines)
        .toEqual(["bb", "cc"])
    })
  ))

test.it("cuts at an exact byte boundary when truncateAlignLines is false", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "log.txt")

      yield* Effect.scoped(Effect.gen(function*() {
        const writer = yield* FileWriter.build({ path, truncateSize: 13, truncateAlignLines: false })
        yield* writer.append("aaaaaaaa")
        yield* writer.append("bb")
        yield* writer.append("cc")
      }))

      test
        .expect(yield* fs.readFileString(path))
        .toBe("aaaaaa\nbb\ncc\n")
    })
  ))

test.it("keeps nothing old when a single write exceeds truncateSize", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "log.txt")

      yield* Effect.scoped(Effect.gen(function*() {
        const writer = yield* FileWriter.build({ path, truncateSize: 8 })
        yield* writer.append("first")
        yield* writer.append("a much longer line than the cap")
      }))

      test
        .expect(yield* fs.readFileString(path))
        .toBe("a much longer line than the cap\n")
    })
  ))

test.it("does not trim when writes stay under truncateSize", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "log.txt")

      yield* Effect.scoped(Effect.gen(function*() {
        const writer = yield* FileWriter.build({ path, truncateSize: 1000 })
        yield* writer.append("small")
        yield* writer.append("also small")
      }))

      test
        .expect(yield* fs.readFileString(path))
        .toBe("small\nalso small\n")
    })
  ))

test.it("does not trim by default", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "log.txt")

      yield* Effect.scoped(Effect.gen(function*() {
        const writer = yield* FileWriter.build({ path })
        yield* writer.append("a".repeat(100))
        yield* writer.append("b".repeat(100))
      }))

      test
        .expect((yield* fs.readFileString(path)).length)
        .toBe(202)
    })
  ))

test.it("serializes concurrent appends without interleaving", () =>
  withTempDir((dir) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = NPath.join(dir, "out.txt")

      yield* Effect.scoped(Effect.gen(function*() {
        const writer = yield* FileWriter.build({ path })
        yield* Effect.all(
          Array.from({ length: 20 }, (_, i) => writer.append(`line-${i}`)),
          { concurrency: "unbounded" },
        )
      }))

      const lines = (yield* fs.readFileString(path)).trimEnd().split("\n")

      test
        .expect(lines.length)
        .toBe(20)
      test
        .expect(new Set(lines).size)
        .toBe(20)
    })
  ))
