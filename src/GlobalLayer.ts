import type * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import type * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"

interface CacheEntry<A, E> {
  readonly context: Deferred.Deferred<Context.Context<A>, E>
  fiber?: Fiber.Fiber<unknown, unknown>
}

const cacheKey = Symbol.for("effect-start/GlobalLayer/cache")
const globalRegistry = globalThis as typeof globalThis & {
  [cacheKey]?: Map<string, CacheEntry<any, any>>
}
const cache = globalRegistry[cacheKey] ??= new Map()

export const globalLayer = (key: string) => <A, E, R>(layer: Layer.Layer<A, E, R>): Layer.Layer<A, E, R> =>
  Layer.fromBuild(() => {
    const typedCache: Map<string, CacheEntry<A, E>> = cache
    return (
      Effect.gen(function*() {
        const existing = typedCache.get(key)
        if (existing !== undefined) {
          return yield* Deferred.await(existing.context)
        }

        const context = yield* Effect.context<R>()
        const deferred = Deferred.makeUnsafe<Context.Context<A>, E>()
        const entry: CacheEntry<A, E> = { context: deferred }
        typedCache.set(key, entry)

        const fiber = Effect.runForkWith(context)(
          Effect.scoped(
            Effect
              .gen(function*() {
                const built = yield* Layer.build(layer)
                yield* Deferred.succeed(deferred, built)
                return yield* Effect.never
              })
              .pipe(Effect.catchCause((cause) => Deferred.failCause(deferred, cause))),
          ),
        )
        entry.fiber = fiber
        fiber.addObserver(() => {
          if (typedCache.get(key) === entry) typedCache.delete(key)
        })

        return yield* Deferred.await(deferred)
      })
    )
  })
