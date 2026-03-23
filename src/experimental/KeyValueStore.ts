import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import * as Encoding from "effect/Encoding"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Predicate from "effect/Predicate"

const TypeId = "effect-start/KeyValueStore" as const

export interface KeyValueStore {
  readonly [TypeId]: typeof TypeId
  readonly get: (key: string) => Effect.Effect<string | undefined, KeyValueStoreError>
  readonly getUint8Array: (key: string) => Effect.Effect<Uint8Array | undefined, KeyValueStoreError>
  readonly set: (key: string, value: string | Uint8Array) => Effect.Effect<void, KeyValueStoreError>
  readonly remove: (key: string) => Effect.Effect<void, KeyValueStoreError>
  readonly clear: Effect.Effect<void, KeyValueStoreError>
  readonly size: Effect.Effect<number, KeyValueStoreError>
  readonly modify: (
    key: string,
    f: (value: string) => string,
  ) => Effect.Effect<string | undefined, KeyValueStoreError>
  readonly modifyUint8Array: (
    key: string,
    f: (value: Uint8Array) => Uint8Array,
  ) => Effect.Effect<Uint8Array | undefined, KeyValueStoreError>
  readonly has: (key: string) => Effect.Effect<boolean, KeyValueStoreError>
  readonly isEmpty: Effect.Effect<boolean, KeyValueStoreError>
}

type MakeOptions = Partial<KeyValueStore> & {
  readonly get: (key: string) => Effect.Effect<string | undefined, KeyValueStoreError>
  readonly getUint8Array: (key: string) => Effect.Effect<Uint8Array | undefined, KeyValueStoreError>
  readonly set: (key: string, value: string | Uint8Array) => Effect.Effect<void, KeyValueStoreError>
  readonly remove: (key: string) => Effect.Effect<void, KeyValueStoreError>
  readonly clear: Effect.Effect<void, KeyValueStoreError>
  readonly size: Effect.Effect<number, KeyValueStoreError>
}

type MakeStringOptions = Partial<Omit<KeyValueStore, "set">> & {
  readonly get: (key: string) => Effect.Effect<string | undefined, KeyValueStoreError>
  readonly set: (key: string, value: string) => Effect.Effect<void, KeyValueStoreError>
  readonly remove: (key: string) => Effect.Effect<void, KeyValueStoreError>
  readonly clear: Effect.Effect<void, KeyValueStoreError>
  readonly size: Effect.Effect<number, KeyValueStoreError>
}

export class KeyValueStoreError extends Data.TaggedError("KeyValueStoreError")<{
  message: string
  method: string
  key?: string
  cause?: unknown
}> {}

export const KeyValueStore: Context.Tag<KeyValueStore, KeyValueStore> = Context.GenericTag<KeyValueStore>(
  "effect-start/KeyValueStore",
)

const make = (options: MakeOptions): KeyValueStore => ({
  [TypeId]: TypeId,
  has: (key) => Effect.map(options.get(key), Predicate.isNotUndefined),
  isEmpty: Effect.map(options.size, (size) => size === 0),
  modify: (key, f) =>
    Effect.flatMap(options.get(key), (o) => {
      if (o === undefined) return Effect.succeed(undefined)
      const newValue = f(o)
      return Effect.as(options.set(key, newValue), newValue)
    }),
  modifyUint8Array: (key, f) =>
    Effect.flatMap(options.getUint8Array(key), (o) => {
      if (o === undefined) return Effect.succeed(undefined)
      const newValue = f(o)
      return Effect.as(options.set(key, newValue), newValue)
    }),
  ...options,
})

const makeStringOnly = (options: MakeStringOptions): KeyValueStore => {
  const encoder = new TextEncoder()
  return make({
    ...options,
    getUint8Array: (key) =>
      Effect.map(options.get(key), (value) => {
        if (value === undefined) return undefined
        const decoded = Encoding.decodeBase64(value)
        return Either.isRight(decoded) ? decoded.right : encoder.encode(value)
      }),
    set: (key, value) =>
      typeof value === "string"
        ? options.set(key, value)
        : Effect.suspend(() => options.set(key, Encoding.encodeBase64(value))),
  })
}

export const prefix: {
  (prefix: string): (self: KeyValueStore) => KeyValueStore
  (self: KeyValueStore, prefix: string): KeyValueStore
} = Function.dual(2, (self: KeyValueStore, prefix: string): KeyValueStore => ({
  ...self,
  get: (key) => self.get(`${prefix}${key}`),
  getUint8Array: (key) => self.getUint8Array(`${prefix}${key}`),
  set: (key, value) => self.set(`${prefix}${key}`, value),
  remove: (key) => self.remove(`${prefix}${key}`),
  has: (key) => self.has(`${prefix}${key}`),
  modify: (key, f) => self.modify(`${prefix}${key}`, f),
  modifyUint8Array: (key, f) => self.modifyUint8Array(`${prefix}${key}`, f),
}))

export const layerMemory: Layer.Layer<KeyValueStore> = Layer.sync(KeyValueStore, () => {
  const store = new Map<string, string | Uint8Array>()
  const encoder = new TextEncoder()

  return make({
    get: (key: string) =>
      Effect.sync(() => {
        const value = store.get(key)
        return value === undefined ? undefined : typeof value === "string" ? value : Encoding.encodeBase64(value)
      }),
    getUint8Array: (key: string) =>
      Effect.sync(() => {
        const value = store.get(key)
        return value === undefined ? undefined : typeof value === "string" ? encoder.encode(value) : value
      }),
    set: (key: string, value: string | Uint8Array) => Effect.sync(() => store.set(key, value)),
    remove: (key: string) => Effect.sync(() => store.delete(key)),
    clear: Effect.sync(() => store.clear()),
    size: Effect.sync(() => store.size),
  })
})

export const layerStorage = (evaluate: Function.LazyArg<Storage>): Layer.Layer<KeyValueStore> =>
  Layer.sync(KeyValueStore, () => {
    const storage = evaluate()
    return makeStringOnly({
      get: (key: string) =>
        Effect.try({
          try: () => storage.getItem(key) ?? undefined,
          catch: () => new KeyValueStoreError({ key, method: "get", message: `Unable to get item with key ${key}` }),
        }),
      set: (key: string, value: string) =>
        Effect.try({
          try: () => storage.setItem(key, value),
          catch: () => new KeyValueStoreError({ key, method: "set", message: `Unable to set item with key ${key}` }),
        }),
      remove: (key: string) =>
        Effect.try({
          try: () => storage.removeItem(key),
          catch: () =>
            new KeyValueStoreError({ key, method: "remove", message: `Unable to remove item with key ${key}` }),
        }),
      clear: Effect.try({
        try: () => storage.clear(),
        catch: () => new KeyValueStoreError({ method: "clear", message: `Unable to clear storage` }),
      }),
      size: Effect.try({
        try: () => storage.length,
        catch: () => new KeyValueStoreError({ method: "size", message: `Unable to get size` }),
      }),
    })
  })
