import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as KeyValueStore from "effect-start/experimental/KeyValueStore"

test.describe("layerMemory", () => {
  test.afterEach(() =>
    Effect.gen(function* () {
      const kv = yield* KeyValueStore.KeyValueStore
      yield* kv.clear
    }).pipe(Effect.provide(KeyValueStore.layerMemory), Effect.runPromise))

  test.it("set", () =>
    Effect.gen(function* () {
      const kv = yield* KeyValueStore.KeyValueStore
      yield* kv.set("/foo/bar", "bar")

      test.expect(yield* kv.get("/foo/bar")).toBe("bar")
      test.expect(yield* kv.size).toBe(1)
    }).pipe(Effect.provide(KeyValueStore.layerMemory), Effect.runPromise))

  test.it("get / missing", () =>
    Effect.gen(function* () {
      const kv = yield* KeyValueStore.KeyValueStore
      yield* kv.clear
      test.expect(yield* kv.get("foo")).toBeUndefined()
    }).pipe(Effect.provide(KeyValueStore.layerMemory), Effect.runPromise))

  test.it("remove", () =>
    Effect.gen(function* () {
      const kv = yield* KeyValueStore.KeyValueStore
      yield* kv.set("foo", "bar")
      yield* kv.remove("foo")

      test.expect(yield* kv.get("foo")).toBeUndefined()
      test.expect(yield* kv.size).toBe(0)
    }).pipe(Effect.provide(KeyValueStore.layerMemory), Effect.runPromise))

  test.it("clear", () =>
    Effect.gen(function* () {
      const kv = yield* KeyValueStore.KeyValueStore
      yield* kv.set("foo", "bar")
      yield* kv.clear

      test.expect(yield* kv.get("foo")).toBeUndefined()
      test.expect(yield* kv.size).toBe(0)
    }).pipe(Effect.provide(KeyValueStore.layerMemory), Effect.runPromise))

  test.it("modify", () =>
    Effect.gen(function* () {
      const kv = yield* KeyValueStore.KeyValueStore
      yield* kv.set("foo", "bar")

      test.expect(yield* kv.modify("foo", (v) => v + "bar")).toBe("barbar")
      test.expect(yield* kv.size).toBe(1)
    }).pipe(Effect.provide(KeyValueStore.layerMemory), Effect.runPromise))

  test.it("modify - none", () =>
    Effect.gen(function* () {
      const kv = yield* KeyValueStore.KeyValueStore

      test.expect(yield* kv.modify("foo", (v) => v + "bar")).toBeUndefined()
      test.expect(yield* kv.size).toBe(0)
    }).pipe(Effect.provide(KeyValueStore.layerMemory), Effect.runPromise))
})

test.describe("prefix", () => {
  test.it("prefixes the keys", () =>
    Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore
      const prefixed = KeyValueStore.prefix(store, "prefix/")

      yield* prefixed.set("foo", "bar")
      yield* prefixed.modify("foo", (v) => v + "bar")

      test.expect(yield* prefixed.get("foo")).toBe("barbar")
      test.expect(yield* prefixed.has("foo")).toBe(true)

      test.expect(yield* store.get("prefix/foo")).toBe("barbar")
      test.expect(yield* store.has("prefix/foo")).toBe(true)
    }).pipe(Effect.provide(KeyValueStore.layerMemory), Effect.runPromise))
})
