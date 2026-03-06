import * as test from "bun:test"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"

import * as GlobalLayer from "effect-start/GlobalLayer"

class TestService extends Context.Tag("TestService")<TestService, { readonly value: number }>() {}

let keyId = 0
const freshKey = () => `test/GlobalLayer/${keyId++}`

test.describe("GlobalLayer", () => {
  test.it("caches layer build across multiple calls", () =>
    Effect.gen(function* () {
      let buildCount = 0
      const key = freshKey()
      const layer = Layer.effect(
        TestService,
        Effect.sync(() => {
          buildCount++
          return { value: 42 }
        }),
      ).pipe(GlobalLayer.globalLayer(key))

      const ctx1 = yield* Layer.build(layer).pipe(Effect.scoped)
      const ctx2 = yield* Layer.build(layer).pipe(Effect.scoped)
      test.expect(buildCount).toBe(1)
      test.expect(Context.get(ctx1, TestService).value).toBe(42)
      test.expect(Context.get(ctx2, TestService).value).toBe(42)
    }).pipe(Effect.runPromise),
  )

  test.it("different keys produce separate cache entries", () =>
    Effect.gen(function* () {
      let buildCountA = 0
      let buildCountB = 0
      const keyA = freshKey()
      const keyB = freshKey()

      const layerA = Layer.effect(
        TestService,
        Effect.sync(() => {
          buildCountA++
          return { value: 1 }
        }),
      ).pipe(GlobalLayer.globalLayer(keyA))

      const layerB = Layer.effect(
        TestService,
        Effect.sync(() => {
          buildCountB++
          return { value: 2 }
        }),
      ).pipe(GlobalLayer.globalLayer(keyB))

      yield* Layer.build(layerA).pipe(Effect.scoped)
      yield* Layer.build(layerB).pipe(Effect.scoped)
      test.expect(buildCountA).toBe(1)
      test.expect(buildCountB).toBe(1)
    }).pipe(Effect.runPromise),
  )

  test.it("propagates layer build errors", () =>
    Effect.gen(function* () {
      const key = freshKey()
      const layer = Layer.effect(TestService, Effect.fail("build failed" as const)).pipe(
        GlobalLayer.globalLayer(key),
      )

      const exit = yield* Layer.build(layer).pipe(Effect.scoped, Effect.exit)
      test.expect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.timeout("2 seconds"), Effect.runPromise),
  )

  test.it("propagates layer build defects", () =>
    Effect.gen(function* () {
      const key = freshKey()
      const layer = Layer.effect(TestService, Effect.die(new Error("fatal"))).pipe(
        GlobalLayer.globalLayer(key),
      )

      const exit = yield* Layer.build(layer).pipe(Effect.scoped, Effect.exit)
      test.expect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.timeout("2 seconds"), Effect.runPromise),
  )

  test.it("propagates timeout from layer build", () =>
    Effect.gen(function* () {
      const key = freshKey()
      const layer = Layer.effect(TestService, Effect.never.pipe(Effect.timeout("100 millis"))).pipe(
        GlobalLayer.globalLayer(key),
      )

      const exit = yield* Layer.build(layer).pipe(Effect.scoped, Effect.exit)
      test.expect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.timeout("2 seconds"), Effect.runPromise),
  )
})
