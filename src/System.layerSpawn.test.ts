import * as test from "bun:test"
import * as Cause from "effect/Cause"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as Ref from "effect/Ref"

import * as BunChildProcessSpawner from "./bun/BunChildProcessSpawner.ts"
import * as ChildProcess from "./ChildProcess.ts"
import * as PlatformRuntime from "./PlatformRuntime.ts"
import * as System from "./System.ts"

const provide = BunChildProcessSpawner.layer

let testId = 0
const nonce = () => String(testId++)

const countingSpawner = (ref: Ref.Ref<number>) =>
  Layer.effect(
    ChildProcess.ChildProcessSpawner,
    Effect.gen(function* () {
      const real = yield* ChildProcess.ChildProcessSpawner
      return ChildProcess.ChildProcessSpawner.of({
        spawn: (command) =>
          Effect.gen(function* () {
            yield* Ref.update(ref, (n) => n + 1)
            return yield* real.spawn(command)
          }),
      })
    }),
  ).pipe(Layer.provide(provide))

test.describe("System.layerSpawn", () => {
  test.it("spawns a process", async () => {
    await Effect.gen(function* () {
      const layer = System.layerSpawn(["echo", nonce()]).pipe(Layer.provide(provide))
      yield* Layer.build(layer).pipe(Effect.scoped)
    }).pipe(Effect.runPromise)
  })

  test.it("skips spawn when process is still running", async () => {
    const id = nonce()
    await Effect.gen(function* () {
      const spawnCount = yield* Ref.make(0)
      const spawner = countingSpawner(spawnCount)
      const layer = System.layerSpawn(["sleep", id]).pipe(Layer.provide(spawner))

      yield* Layer.build(layer).pipe(Effect.scoped)
      yield* Layer.build(layer).pipe(Effect.scoped)

      test.expect(yield* Ref.get(spawnCount)).toBe(1)
    }).pipe(Effect.scoped, Effect.runPromise)
  })

  test.it("respawns after process exits", async () => {
    const id = nonce()
    await Effect.gen(function* () {
      const spawnCount = yield* Ref.make(0)
      const spawner = countingSpawner(spawnCount)
      const layer = System.layerSpawn(["echo", id]).pipe(Layer.provide(spawner))

      yield* Layer.build(layer).pipe(Effect.scoped)
      yield* Effect.sleep("50 millis")
      yield* Layer.build(layer).pipe(Effect.scoped)

      test.expect(yield* Ref.get(spawnCount)).toBe(2)
    }).pipe(Effect.scoped, Effect.runPromise)
  })

  test.it("interrupts main fiber on non-zero exit", async () => {
    const exit = await Effect.gen(function* () {
      const fiber = yield* Effect.fork(
        Effect.gen(function* () {
          const layer = System.layerSpawn(["sh", "-c", `exit 1; #${nonce()}`]).pipe(
            Layer.provide(provide),
          )
          yield* Layer.build(layer).pipe(Effect.scoped)
          yield* Effect.never
        }),
      )
      MutableRef.set(PlatformRuntime.mainFiber, fiber)
      return yield* Fiber.await(fiber)
    }).pipe(Effect.runPromise)

    test.expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      test.expect(Cause.isInterruptedOnly(exit.cause)).toBe(true)
    }
  })

  test.it("does not interrupt on zero exit", async () => {
    const exit = await Effect.gen(function* () {
      const done = yield* Deferred.make<void>()
      const fiber = yield* Effect.fork(
        Effect.gen(function* () {
          const layer = System.layerSpawn(["echo", nonce()]).pipe(Layer.provide(provide))
          yield* Layer.build(layer).pipe(Effect.scoped)
          yield* Effect.yieldNow()
          yield* Deferred.succeed(done, undefined)
          return yield* Deferred.await(done)
        }),
      )
      MutableRef.set(PlatformRuntime.mainFiber, fiber)
      return yield* Fiber.await(fiber)
    }).pipe(Effect.runPromise)

    test.expect(Exit.isSuccess(exit)).toBe(true)
  })

  test.it("interrupts current main fiber when process crashes after hot reload", async () => {
    const id = nonce()
    const exit = await Effect.gen(function* () {
      const fiberA = yield* Effect.fork(
        Effect.gen(function* () {
          const layer = System.layerSpawn(["sh", "-c", `sleep 0.1; exit 1 #${id}`]).pipe(
            Layer.provide(provide),
          )
          yield* Layer.build(layer).pipe(Effect.scoped)
          yield* Effect.never
        }),
      )
      MutableRef.set(PlatformRuntime.mainFiber, fiberA)

      yield* Effect.sleep("10 millis")

      const fiberB = yield* Effect.fork(Effect.never)
      MutableRef.set(PlatformRuntime.mainFiber, fiberB)

      return yield* Fiber.await(fiberB)
    }).pipe(Effect.runPromise)

    test.expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      test.expect(Cause.isInterruptedOnly(exit.cause)).toBe(true)
    }
  })

  test.it("different args spawn separate processes", async () => {
    const id = nonce()
    await Effect.gen(function* () {
      const spawnCount = yield* Ref.make(0)
      const spawner = countingSpawner(spawnCount)
      const layer = Layer.mergeAll(
        System.layerSpawn(["sleep", id]),
        System.layerSpawn(["sleep", id, "999"]),
      ).pipe(Layer.provide(spawner))

      yield* Layer.build(layer).pipe(Effect.scoped)

      test.expect(yield* Ref.get(spawnCount)).toBe(2)
    }).pipe(Effect.scoped, Effect.runPromise)
  })
})
