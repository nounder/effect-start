import * as test from "bun:test"
import * as Development from "effect-start/Development"
import * as FileSystem from "effect-start/FileSystem"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import * as NFs from "node:fs"
import * as NPath from "node:path"
import * as NodeFileSystem from "../src/node/NodeFileSystem.ts"

test.beforeEach(() => {
  Development._testResetState()
})

test.describe("layer", () => {
  test.it("provides Development service", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-start-" })

        return yield* Effect
          .gen(function*() {
            const dev = yield* Development.Development

            test
              .expect(dev.events)
              .toBeDefined()
          })
          .pipe(
            Effect.provide(Development.layer({ path: root })),
          )
      })
      .pipe(
        Effect.scoped,
        Effect.provide(NodeFileSystem.layer),
        Effect.runPromise,
      ))
})

test.describe("stream", () => {
  test.it("returns stream from pubsub when Development is available", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-start-" })

        return yield* Effect
          .gen(function*() {
            const fs = yield* FileSystem.FileSystem

            const collectFiber = yield* Effect.fork(
              Stream.runCollect(Stream.take(Development.events, 1)),
            )

            yield* Effect.sleep(1)
            yield* fs.writeFileString(`${root}/file.ts`, "content")

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
            Effect.provide(Development.layer({ path: root })),
          )
      })
      .pipe(
        Effect.scoped,
        Effect.provide(NodeFileSystem.layer),
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
  test.it(
    "propagates events for removed directories",
    () =>
      Effect
        .gen(function*() {
          const fs = yield* FileSystem.FileSystem
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-start-" })
          const routes = NPath.join(root, "routes")
          NFs.mkdirSync(routes, { recursive: true })

          return yield* Effect
            .gen(function*() {
              const fs = yield* FileSystem.FileSystem

              yield* fs.makeDirectory(`${routes}/chat`, { recursive: true })
              yield* fs.writeFileString(`${routes}/chat/route.ts`, "")

              const collectFiber = yield* Effect.fork(
                Stream.runCollect(Stream.take(Development.events, 1)),
              )

              yield* Effect.sleep(1)
              yield* fs.remove(`${routes}/chat`, { recursive: true })

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
              Effect.provide(Development.layer({ path: routes })),
            )
        })
        .pipe(
          Effect.scoped,
          Effect.provide(NodeFileSystem.layer),
          Effect.runPromise,
        ),
    500,
  )

  test.it(
    "propagates events for directories moved in",
    () =>
      Effect
        .gen(function*() {
          const fs = yield* FileSystem.FileSystem
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-start-" })
          const routes = NPath.join(root, "routes")
          const staging = NPath.join(root, "staging")
          NFs.mkdirSync(routes, { recursive: true })
          NFs.mkdirSync(staging, { recursive: true })

          return yield* Effect
            .gen(function*() {
              const fs = yield* FileSystem.FileSystem

              yield* fs.makeDirectory(`${staging}/chat`, { recursive: true })
              yield* fs.writeFileString(`${staging}/chat/route.ts`, "")

              const collectFiber = yield* Effect.fork(
                Stream.runCollect(Stream.take(Development.events, 1)),
              )

              yield* Effect.sleep(1)
              yield* fs.rename(`${staging}/chat`, `${routes}/chat`)

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
              Effect.provide(Development.layer({ path: routes })),
            )
        })
        .pipe(
          Effect.scoped,
          Effect.provide(NodeFileSystem.layer),
          Effect.runPromise,
        ),
    500,
  )
})
