import { FileSystem } from "@effect/platform"
import * as BunContext from "@effect/platform-bun/BunContext"
import * as t from "bun:test"
import {
  Effect,
  pipe,
  Stream,
} from "effect"
import * as NPath from "node:path"
import * as FileSystemExtra from "./FileSystemExtra.ts"

t.describe("watchSource", () => {
  t.it("emits events with correct structure", async () => {
    const tempDir = await Bun
      .file(import.meta.dir)
      .text()
      .then(() => NPath.join(import.meta.dir, ".test-watch"))
      .catch(() => NPath.join(process.cwd(), ".test-watch"))

    await Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem

        yield* fs.makeDirectory(tempDir, { recursive: true })

        const testFile = NPath.join(tempDir, "test.ts")

        yield* fs.writeFileString(testFile, "// test")

        const events: FileSystemExtra.WatchEvent[] = []

        const watchEffect = pipe(
          FileSystemExtra.watchSource({ path: tempDir }),
          Stream.take(1),
          Stream.runForEach(event => {
            events.push(event)
            return Effect.void
          }),
        )

        yield* Effect.fork(watchEffect)

        yield* Effect.sleep("100 millis")

        yield* fs.writeFileString(testFile, "// updated")

        yield* Effect.sleep("500 millis")

        t
          .expect(events.length)
          .toBeGreaterThan(0)

        if (events.length > 0) {
          const event = events[0]

          t
            .expect(event.eventType)
            .toMatch(/^(change|rename)$/)

          t
            .expect(event.filename)
            .toBeDefined()

          t
            .expect(event.path)
            .toBeDefined()

          t
            .expect(event.path)
            .toContain(tempDir)
        }

        yield* fs.remove(tempDir, { recursive: true })
      })
      .pipe(
        Effect.provide(BunContext.layer),
        Effect.runPromise,
      )
  })

  t.it("appends / to directory paths", async () => {
    const tempDir = await Bun
      .file(import.meta.dir)
      .text()
      .then(() => NPath.join(import.meta.dir, ".test-watch-dir"))
      .catch(() => NPath.join(process.cwd(), ".test-watch-dir"))

    await Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem

        yield* fs.makeDirectory(tempDir, { recursive: true })

        const events: FileSystemExtra.WatchEvent[] = []

        const watchEffect = pipe(
          FileSystemExtra.watchSource({ path: tempDir }),
          Stream.take(1),
          Stream.runForEach(event => {
            events.push(event)
            return Effect.void
          }),
        )

        yield* Effect.fork(watchEffect)

        yield* Effect.sleep("100 millis")

        const subDir = NPath.join(tempDir, "subdir")

        yield* fs.makeDirectory(subDir)

        yield* Effect.sleep("500 millis")

        const dirEvents = events.filter(e => e.path.endsWith("/"))

        t
          .expect(dirEvents.length)
          .toBeGreaterThan(0)

        yield* fs.remove(tempDir, { recursive: true })
      })
      .pipe(
        Effect.provide(BunContext.layer),
        Effect.runPromise,
      )
  })

  t.it("filters events with custom filter", async () => {
    const tempDir = await Bun
      .file(import.meta.dir)
      .text()
      .then(() => NPath.join(import.meta.dir, ".test-watch-filter"))
      .catch(() => NPath.join(process.cwd(), ".test-watch-filter"))

    await Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem

        yield* fs.makeDirectory(tempDir, { recursive: true })

        const events: FileSystemExtra.WatchEvent[] = []

        const watchEffect = pipe(
          FileSystemExtra.watchSource({
            path: tempDir,
            filter: FileSystemExtra.filterSourceFiles,
          }),
          Stream.take(2),
          Stream.runForEach(event => {
            events.push(event)
            return Effect.void
          }),
        )

        yield* Effect.fork(watchEffect)

        yield* Effect.sleep("200 millis")

        yield* fs.writeFileString(NPath.join(tempDir, "test.md"), "# test")

        yield* Effect.sleep("200 millis")

        yield* fs.writeFileString(NPath.join(tempDir, "test.ts"), "// test")

        yield* Effect.sleep("800 millis")

        t
          .expect(events.length)
          .toBeGreaterThan(0)

        const allSourceFiles = events.every(e =>
          /\.(tsx?|jsx?|html?|css|json)$/.test(e.path)
        )

        t
          .expect(allSourceFiles)
          .toBe(true)

        const hasNoMarkdown = events.every(e => !e.path.endsWith(".md"))

        t
          .expect(hasNoMarkdown)
          .toBe(true)

        yield* fs.remove(tempDir, { recursive: true })
      })
      .pipe(
        Effect.provide(BunContext.layer),
        Effect.runPromise,
      )
  })
})

t.describe("filterSourceFiles", () => {
  t.it("filters TypeScript and JavaScript files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "test.ts",
          path: "/path/to/test.ts",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "test.js",
          path: "/path/to/test.js",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "test.md",
          path: "/path/to/test.md",
        }),
      )
      .toBe(false)
  })

  t.it("filters directories", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "rename",
          filename: "dir",
          path: "/path/to/dir/",
        }),
      )
      .toBe(false)
  })
})

t.describe("filterDirectory", () => {
  t.it("identifies directories by trailing slash", () => {
    t
      .expect(
        FileSystemExtra.filterDirectory({
          eventType: "rename",
          filename: "dir",
          path: "/path/to/dir/",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterDirectory({
          eventType: "change",
          filename: "file.ts",
          path: "/path/to/file.ts",
        }),
      )
      .toBe(false)
  })
})
