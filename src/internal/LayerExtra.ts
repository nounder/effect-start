import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as ExecutionStrategy from "effect/ExecutionStrategy"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as SynchronizedRef from "effect/SynchronizedRef"

type Unsatisfied<Unmet, Success> = Unmet extends Success ? Unmet : never

export type LayersSuccess<Layers extends ReadonlyArray<Layer.Layer.Any>> = {
  [K in keyof Layers]: Layer.Layer.Success<Layers[K]>
}[number]

export type LayersError<Layers extends ReadonlyArray<Layer.Layer.Any>> = {
  [K in keyof Layers]: Layer.Layer.Error<Layers[K]>
}[number]

export type LayersContext<Layers extends ReadonlyArray<Layer.Layer.Any>> = Exclude<
  { [K in keyof Layers]: Layer.Layer.Context<Layers[K]> }[number],
  { [K in keyof Layers]: Layer.Layer.Success<Layers[K]> }[number]
>

export type Ordered<
  Layers extends ReadonlyArray<Layer.Layer.Any>,
  All extends ReadonlyArray<Layer.Layer.Any>,
> = Layers extends readonly [
  infer Head extends Layer.Layer.Any,
  ...infer Tail extends Array<Layer.Layer.Any>,
] ? [
    [
      Unsatisfied<
        Exclude<
          Layer.Layer.Context<Head>,
          { [K in keyof Tail]: Layer.Layer.Success<Tail[K]> }[number]
        >,
        { [K in keyof All]: Layer.Layer.Success<All[K]> }[number]
      >,
    ] extends [never] ? Head
      : never,
    ...Ordered<Tail, All>,
  ]
  : []

export type Unordered<Layers extends ReadonlyArray<Layer.Layer.Any>> = {
  [K in keyof Layers]: [
    Exclude<
      Layer.Layer.Context<Layers[K]>,
      { [I in keyof Layers]: Layer.Layer.Success<Layers[I]> }[number]
    >,
  ] extends [never] ? Layers[K]
    : Layer.Layer<
      Layer.Layer.Success<Layers[K]>,
      Layer.Layer.Error<Layers[K]>,
      Extract<
        Layer.Layer.Context<Layers[K]>,
        { [I in keyof Layers]: Layer.Layer.Success<Layers[I]> }[number]
      >
    >
}

/**
 * Composes layers via repeated `Layer.provideMerge`, dependents-first.
 *
 * The type signature enforces ordering at compile time: each layer's
 * dependencies must be either provided by a layer later in the list, or
 * required externally on the resulting layer's `R`.
 */
export function provideMergeAll<
  const Layers extends readonly [Layer.Layer.Any, ...Array<Layer.Layer.Any>],
>(
  ...layers: Layers & Ordered<NoInfer<Layers>, NoInfer<Layers>>
): Layer.Layer<
  LayersSuccess<Layers>,
  LayersError<Layers>,
  LayersContext<Layers>
> {
  type AnyLayer = Layer.Layer<any, any, any>
  const layerArray = layers as unknown as ReadonlyArray<AnyLayer>
  const result: AnyLayer = layerArray.reduce(
    (acc: AnyLayer, layer: AnyLayer) => Layer.provideMerge(acc, layer),
    Layer.succeedContext(Context.empty()) as unknown as AnyLayer,
  )
  return result as any
}

/**
 * Build a set of layers without requiring a particular order: layers whose
 * dependencies aren't yet satisfied are deferred and retried after each pass
 * that makes progress. If a pass completes with no progress, every remaining
 * failure is surfaced together so the caller sees the actual root causes
 * instead of an arbitrary single error.
 *
 * Returns the merged `Context` of all built layers; the caller is responsible
 * for the surrounding scope (typically via `Layer.scopedContext`).
 *
 * Side effects on a layer's acquire path may run more than once if the layer
 * fails (because its deps weren't ready) and is later retried — use
 * `provideMergeAll` with explicit ordering for layers that can't tolerate that.
 */
export function buildUnordered<
  const Layers extends ReadonlyArray<Layer.Layer.Any>,
>(
  layers: Layers,
): Effect.Effect<
  Context.Context<LayersSuccess<Layers>>,
  LayersError<Layers>,
  LayersContext<Layers> | Scope.Scope
> {
  type AnyLayer = Layer.Layer<any, any, any>

  return Effect.gen(function*() {
    const scope = yield* Effect.scope
    const memoMap = yield* Layer.makeMemoMap
    let ctx = yield* Effect.context<any>()
    const pending = new Set<AnyLayer>(
      layers as unknown as ReadonlyArray<AnyLayer>,
    )

    while (pending.size > 0) {
      let progressed = false
      const failures: Array<Cause.Cause<unknown>> = []

      for (const layer of pending) {
        const childScope = yield* Scope.fork(
          scope,
          ExecutionStrategy.sequential,
        )
        const exit = yield* layer.pipe(
          Layer.buildWithMemoMap(memoMap, childScope),
          Effect.provide(ctx),
          Effect.exit,
        )
        if (Exit.isSuccess(exit)) {
          ctx = Context.merge(ctx, exit.value)
          pending.delete(layer)
          progressed = true
        } else {
          yield* Scope.close(childScope, exit)
          // Drop the poisoned memo entry so the layer can be retried once its
          // dependencies become available; otherwise the failed deferred
          // would replay the same cause forever.
          const ref = (memoMap as unknown as {
            ref?: SynchronizedRef.SynchronizedRef<Map<AnyLayer, unknown>>
          })
            .ref
          if (ref) {
            yield* SynchronizedRef.update(ref, (map) => {
              map.delete(layer)
              return map
            })
          }
          failures.push(exit.cause)
          if (Cause.isInterruptedOnly(exit.cause)) {
            return yield* exit
          }
        }
      }

      if (!progressed) {
        const combined = failures.reduce<Cause.Cause<unknown>>(
          (acc, cause) => Cause.parallel(acc, cause),
          Cause.empty,
        )
        return yield* Effect.failCause(combined)
      }
    }

    return ctx
  })
}
