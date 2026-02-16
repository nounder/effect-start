import * as test from "bun:test"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

import * as GlobalLayer from "./GlobalLayer.ts"

class TestService extends Context.Tag("TestService")<TestService, { readonly value: number }>() {}

let keyId = 0
const freshKey = () => `test/GlobalLayer/${keyId++}`

test.describe("GlobalLayer", () => {
  test.it("caches layer build across multiple calls", async () => {
    let buildCount = 0
    const key = freshKey()
    const layer = Layer.effect(
      TestService,
      Effect.sync(() => {
        buildCount++
        return { value: 42 }
      }),
    ).pipe(GlobalLayer.globalLayer(key))

    await Effect.gen(function* () {
      const ctx1 = yield* Layer.build(layer).pipe(Effect.scoped)
      const ctx2 = yield* Layer.build(layer).pipe(Effect.scoped)
      test.expect(buildCount).toBe(1)
      test.expect(Context.get(ctx1, TestService).value).toBe(42)
      test.expect(Context.get(ctx2, TestService).value).toBe(42)
    }).pipe(Effect.runPromise)
  })

  test.it("different keys produce separate cache entries", async () => {
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

    await Effect.gen(function* () {
      yield* Layer.build(layerA).pipe(Effect.scoped)
      yield* Layer.build(layerB).pipe(Effect.scoped)
      test.expect(buildCountA).toBe(1)
      test.expect(buildCountB).toBe(1)
    }).pipe(Effect.runPromise)
  })
})
