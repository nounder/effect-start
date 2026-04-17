import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import type * as Fiber from "effect/Fiber"
import * as GlobalValue from "effect/GlobalValue"
import * as HashMap from "effect/HashMap"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as Runtime from "effect/Runtime"

interface CacheEntry {
  readonly context: Context.Context<any>
  readonly fiber: Fiber.RuntimeFiber<void>
}

const cache = GlobalValue.globalValue(Symbol.for("effect-start/GlobalLayer/cache"), () =>
  MutableRef.make(HashMap.empty<string, CacheEntry>()),
)

export const globalLayer =
  (key: string) =>
  <A, E, R>(layer: Layer.Layer<A, E, R>): Layer.Layer<A, E, R> => {
    const existing = HashMap.get(MutableRef.get(cache), key)
    if (existing._tag === "Some") {
      return Layer.succeedContext(existing.value.context) as Layer.Layer<A, E, R>
    }

    return Layer.scopedContext(
      Effect.gen(function* () {
        const cached = HashMap.get(MutableRef.get(cache), key)
        if (cached._tag === "Some") {
          return cached.value.context as Context.Context<A>
        }

        const parentContext = yield* Effect.context<R>()
        const deferred = yield* Deferred.make<Context.Context<A>, E>()

        const parentRuntime = yield* Effect.runtime<never>()

        const defaultRuntime = Runtime.make({
          // Empty service context — no custom services leak into the forked fiber
          context: Context.empty(),

          // Bit flags for runtime behavior (interruption, cooperative yielding, etc.)
          runtimeFlags: parentRuntime.runtimeFlags,

          // Per-fiber state like logger config, tracer settings, span annotations.
          // Default services are wired through FiberRefs, not the service context.
          fiberRefs: parentRuntime.fiberRefs,
        })

        const fiber = Runtime.runFork(defaultRuntime)(
          Effect.scoped(
            Effect.gen(function* () {
              const scope = yield* Effect.scope
              const memoMap = yield* Layer.makeMemoMap
              const ctx = yield* layer.pipe(
                Layer.buildWithMemoMap(memoMap, scope),
                Effect.provide(parentContext),
              )
              yield* Deferred.succeed(deferred, ctx)
              yield* Effect.never
            }).pipe(Effect.catchAllCause((cause) => Deferred.failCause(deferred, cause))),
          ),
        ) as Fiber.RuntimeFiber<void>

        const ctx = yield* Deferred.await(deferred)

        MutableRef.update(cache, HashMap.set(key, { context: ctx, fiber } as CacheEntry))

        fiber.addObserver(() => {
          MutableRef.update(cache, HashMap.remove(key))
        })

        return ctx
      }),
    )
  }
