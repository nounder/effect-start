import * as FileSystem from "@effect/platform/FileSystem"
import * as test from "bun:test"
import { MemoryFileSystem } from "effect-memfs"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Function from "effect/Function"
import * as Stream from "effect/Stream"
import * as FileSystemExtra from "./FileSystemExtra.ts"

test.describe(`${FileSystemExtra.watchSource.name}`, () => {
  test.it("emits events for file creation", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const watchDir = "/watch-test"

        const fiber = yield* Function.pipe(
          FileSystemExtra.watchSource({ path: watchDir }),
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* Effect.sleep(1)

        yield* fs.writeFileString(`${watchDir}/test.ts`, "const x = 1")

        const events = yield* Fiber.join(fiber)

        test
          .expect(Chunk.size(events))
          .toBeGreaterThan(0)
        const first = Chunk.unsafeGet(events, 0)
        test
          .expect(first.path)
          .toContain("test.ts")
        test
          .expect(["rename", "change"])
          .toContain(first.eventType)
        test
          .expect(first.filename)
          .toBe("test.ts")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(
          MemoryFileSystem.layerWith({ "/watch-test/.gitkeep": "" }),
        ),
        Effect.runPromise,
      ))

  test.it(
    "emits change event for file modification",
    () =>
      Effect
        .gen(function*() {
          const fs = yield* FileSystem.FileSystem
          const watchDir = "/watch-mod"
          const filePath = `${watchDir}/file.ts`

          const fiber = yield* Function.pipe(
            FileSystemExtra.watchSource({ path: watchDir }),
            Stream.take(1),
            Stream.runCollect,
            Effect.fork,
          )

          yield* Effect.sleep(1)
          yield* fs.writeFileString(filePath, "modified")

          const events = yield* Fiber.join(fiber)

          test
            .expect(Chunk.size(events))
            .toBeGreaterThan(0)
          test
            .expect(Chunk.unsafeGet(events, 0).eventType)
            .toBe("change")
        })
        .pipe(
          Effect.scoped,
          Effect.provide(
            MemoryFileSystem.layerWith({ "/watch-mod/file.ts": "initial" }),
          ),
          Effect.runPromise,
        ),
  )

  test.it("applies custom filter", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const watchDir = "/watch-filter"

        const fiber = yield* Function.pipe(
          FileSystemExtra.watchSource({
            path: watchDir,
            filter: FileSystemExtra.filterSourceFiles,
          }),
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* Effect.sleep(1)
        yield* fs.writeFileString(`${watchDir}/ignored.txt`, "ignored")
        yield* Effect.sleep(1)
        yield* fs.writeFileString(`${watchDir}/included.ts`, "included")

        const events = yield* Fiber.join(fiber)

        test
          .expect(Chunk.size(events))
          .toBe(1)
        test
          .expect(Chunk.unsafeGet(events, 0).path)
          .toContain("included.ts")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(
          MemoryFileSystem.layerWith({ "/watch-filter/.gitkeep": "" }),
        ),
        Effect.runPromise,
      ))
})

test.describe(`${FileSystemExtra.filterSourceFiles.name}`, () => {
  test.it("matches source file extensions", () => {
    test
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.ts",
        }),
      )
      .toBe(true)
    test
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.tsx",
        }),
      )
      .toBe(true)
    test
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.js",
        }),
      )
      .toBe(true)
    test
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.jsx",
        }),
      )
      .toBe(true)
    test
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.json",
        }),
      )
      .toBe(true)
    test
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.css",
        }),
      )
      .toBe(true)
    test
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.html",
        }),
      )
      .toBe(true)
  })

  test.it("rejects non-source files", () => {
    test
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.txt",
        }),
      )
      .toBe(false)
    test
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.md",
        }),
      )
      .toBe(false)
  })
})

test.describe(`${FileSystemExtra.filterDirectory.name}`, () => {
  test.it("matches directories", () => {
    test
      .expect(
        FileSystemExtra.filterDirectory({
          eventType: "change",
          filename: "x",
          path: "/a/b/",
        }),
      )
      .toBe(true)
  })

  test.it("rejects files", () => {
    test
      .expect(
        FileSystemExtra.filterDirectory({
          eventType: "change",
          filename: "x",
          path: "/a/b",
        }),
      )
      .toBe(false)
  })
})
