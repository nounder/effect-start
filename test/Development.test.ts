import * as test from "bun:test"
import { MemoryFileSystem } from "effect-memfs"
import * as Development from "effect-start/Development"
import * as FileSystem from "effect-start/FileSystem"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"

test.beforeEach(() => {
  Development._testResetState()
})

test.describe("layer", () => {
  test.it("provides Development service", () =>
    Effect
      .gen(function*() {
        const dev = yield* Development.Development

        test
          .expect(dev.events)
          .toBeDefined()
      })
      .pipe(
        Effect.scoped,
        Effect.provide(Development.layer({ path: "/layer-test" })),
        Effect.provide(memfsLayer({ "/layer-test/.gitkeep": "" })),
        Effect.runPromise,
      ))
})

test.describe("stream", () => {
  test.it("returns stream from pubsub when Development is available", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const watchDir = "/events-test"

        const collectFiber = yield* Effect.fork(
          Stream.runCollect(Stream.take(Development.events, 1)),
        )

        yield* Effect.sleep(1)
        yield* fs.writeFileString(`${watchDir}/file.ts`, "content")

        const collected = yield* Fiber.join(collectFiber)

        test
          .expect(Chunk.size(collected))
          .toBe(1)

        const first = Chunk.unsafeGet(collected, 0)

        test
          .expect("path" in first && first.path)
          .toContain("file.ts")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(Development.layer({ path: "/events-test" })),
        Effect.provide(memfsLayer({ "/events-test/.gitkeep": "" })),
        Effect.runPromise,
      ))

  test.it("returns empty stream when Development is not available", () =>
    Effect
      .gen(function*() {
        const collected = yield* Stream.runCollect(Development.events)

        test
          .expect(Chunk.size(collected))
          .toBe(0)
      })
      .pipe(
        Effect.scoped,
        Effect.provide(Layer.empty),
        Effect.runPromise,
      ))

  // Regression: when a route directory is dropped (e.g. `rm -rf routes/chat`)
  // or moved into the watched tree, the underlying NFS watcher emits a single
  // `rename` event for the directory path itself (no file extension). The
  // default `filterSourceFiles` filter only matches paths ending in
  // .tsx?/.jsx?/.html?/.css/.json, so the event is dropped and downstream
  // consumers (FileRouter codegen) never re-run.
  test.it.failing("propagates events for removed directories", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem

        yield* fs.makeDirectory("/routes/chat", { recursive: true })
        yield* fs.writeFileString("/routes/chat/route.ts", "")

        const collectFiber = yield* Effect.fork(
          Stream.runCollect(Stream.take(Development.events, 1)),
        )

        yield* Effect.sleep(1)
        yield* fs.remove("/routes/chat", { recursive: true })

        const collected = yield* Fiber.join(collectFiber)

        test
          .expect(Chunk.size(collected))
          .toBe(1)

        const first = Chunk.unsafeGet(collected, 0)

        test
          .expect("path" in first && first.path)
          .toContain("chat")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(Development.layer({ path: "/routes" })),
        Effect.provide(memfsLayer({ "/routes/.gitkeep": "" })),
        Effect.runPromise,
      ))

  test.it.failing("propagates events for directories moved in", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem

        yield* fs.makeDirectory("/staging/chat", { recursive: true })
        yield* fs.writeFileString("/staging/chat/route.ts", "")

        const collectFiber = yield* Effect.fork(
          Stream.runCollect(Stream.take(Development.events, 1)),
        )

        yield* Effect.sleep(1)
        yield* fs.rename("/staging/chat", "/routes/chat")

        const collected = yield* Fiber.join(collectFiber)

        test
          .expect(Chunk.size(collected))
          .toBe(1)

        const first = Chunk.unsafeGet(collected, 0)

        test
          .expect("path" in first && first.path)
          .toContain("chat")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(Development.layer({ path: "/routes" })),
        Effect.provide(
          memfsLayer({
            "/routes/.gitkeep": "",
            "/staging/.gitkeep": "",
          }),
        ),
        Effect.runPromise,
      ))
})

const memfsLayer = (contents: MemoryFileSystem.Contents) =>
  MemoryFileSystem.layerWith(contents) as unknown as Layer.Layer<
    FileSystem.FileSystem
  >
