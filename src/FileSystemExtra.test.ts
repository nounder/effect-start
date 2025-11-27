import * as FileSystem from "@effect/platform/FileSystem"
import * as t from "bun:test"
import { MemoryFileSystem } from "effect-memfs"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Function from "effect/Function"
import * as Stream from "effect/Stream"
import * as FileSystemExtra from "./FileSystemExtra.ts"

t.describe(`${FileSystemExtra.watchSource.name}`, () => {
  t.it("emits events for file creation", () =>
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

        t.expect(Chunk.size(events)).toBeGreaterThan(0)
        const first = Chunk.unsafeGet(events, 0)
        t.expect(first.path).toContain("test.ts")
        t.expect(["rename", "change"]).toContain(first.eventType)
        t.expect(first.filename).toBe("test.ts")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(
          MemoryFileSystem.layerWith({ "/watch-test/.gitkeep": "" }),
        ),
        Effect.runPromise,
      ))

  t.it(
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

          t.expect(Chunk.size(events)).toBeGreaterThan(0)
          t.expect(Chunk.unsafeGet(events, 0).eventType).toBe("change")
        })
        .pipe(
          Effect.scoped,
          Effect.provide(
            MemoryFileSystem.layerWith({ "/watch-mod/file.ts": "initial" }),
          ),
          Effect.runPromise,
        ),
  )

  t.it("applies custom filter", () =>
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

        t.expect(Chunk.size(events)).toBe(1)
        t.expect(Chunk.unsafeGet(events, 0).path).toContain("included.ts")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(
          MemoryFileSystem.layerWith({ "/watch-filter/.gitkeep": "" }),
        ),
        Effect.runPromise,
      ))
})

t.describe(`${FileSystemExtra.filterSourceFiles.name}`, () => {
  t.it("matches source file extensions", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.ts",
        }),
      )
      .toBe(true)
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.tsx",
        }),
      )
      .toBe(true)
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.js",
        }),
      )
      .toBe(true)
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.jsx",
        }),
      )
      .toBe(true)
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.json",
        }),
      )
      .toBe(true)
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.css",
        }),
      )
      .toBe(true)
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.html",
        }),
      )
      .toBe(true)
  })

  t.it("rejects non-source files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "x",
          path: "/a/b.txt",
        }),
      )
      .toBe(false)
    t
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

t.describe(`${FileSystemExtra.filterDirectory.name}`, () => {
  t.it("matches directories", () => {
    t
      .expect(
        FileSystemExtra.filterDirectory({
          eventType: "change",
          filename: "x",
          path: "/a/b/",
        }),
      )
      .toBe(true)
  })

  t.it("rejects files", () => {
    t
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
