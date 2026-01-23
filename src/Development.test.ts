import * as FileSystem from "@effect/platform/FileSystem"
import * as test from "bun:test"
import { MemoryFileSystem } from "effect-memfs"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import * as Development from "./Development.ts"

test.beforeEach(() => {
  Development._resetForTesting()
})

test.describe("watch", () => {
  test.it("creates pubsub and publishes file events", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const watchDir = "/dev-watch"

        const dev = yield* Development.watch({ path: watchDir })

        const subFiber = yield* Effect.fork(
          Stream.runCollect(
            Stream.take(Stream.fromPubSub(dev.events), 1),
          ),
        )

        yield* Effect.sleep(1)
        yield* fs.writeFileString(`${watchDir}/test.ts`, "const x = 1")

        const events = yield* Fiber.join(subFiber)

        test
          .expect(Chunk.size(events))
          .toBe(1)
        const first = Chunk.unsafeGet(events, 0)
        test
          .expect("path" in first && first.path)
          .toContain("test.ts")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(
          MemoryFileSystem.layerWith({ "/dev-watch/.gitkeep": "" }),
        ),
        Effect.runPromise,
      ))
})

test.describe("layerWatch", () => {
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
        Effect.provide(Development.layerWatch({ path: "/layer-test" })),
        Effect.provide(
          MemoryFileSystem.layerWith({ "/layer-test/.gitkeep": "" }),
        ),
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
          Stream.runCollect(Stream.take(Development.stream(), 1)),
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
        Effect.provide(Development.layerWatch({ path: "/events-test" })),
        Effect.provide(
          MemoryFileSystem.layerWith({ "/events-test/.gitkeep": "" }),
        ),
        Effect.runPromise,
      ))

  test.it("returns empty stream when Development is not available", () =>
    Effect
      .gen(function*() {
        const collected = yield* Stream.runCollect(Development.stream())

        test
          .expect(Chunk.size(collected))
          .toBe(0)
      })
      .pipe(
        Effect.scoped,
        Effect.provide(Layer.empty),
        Effect.runPromise,
      ))
})
