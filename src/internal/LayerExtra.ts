import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"

type Unsatisfied<Unmet, Success> = Unmet extends Success ? Unmet : never

export type LayersSuccess<Layers extends ReadonlyArray<Layer.Any>> = {
  [K in keyof Layers]: Layer.Success<Layers[K]>
}[number]

export type LayersError<Layers extends ReadonlyArray<Layer.Any>> = {
  [K in keyof Layers]: Layer.Error<Layers[K]>
}[number]

export type LayersContext<Layers extends ReadonlyArray<Layer.Any>> = Exclude<
  { [K in keyof Layers]: Layer.Services<Layers[K]> }[number],
  { [K in keyof Layers]: Layer.Success<Layers[K]> }[number]
>

export type Ordered<
  Layers extends ReadonlyArray<Layer.Any>,
  All extends ReadonlyArray<Layer.Any>,
> = Layers extends readonly [
  infer Head extends Layer.Any,
  ...infer Tail extends Array<Layer.Any>,
] ? [
    [
      Unsatisfied<
        Exclude<
          Layer.Services<Head>,
          { [K in keyof Tail]: Layer.Success<Tail[K]> }[number]
        >,
        { [K in keyof All]: Layer.Success<All[K]> }[number]
      >,
    ] extends [never] ? Head
      : never,
    ...Ordered<Tail, All>,
  ]
  : []

export type Unordered<Layers extends ReadonlyArray<Layer.Any>> = {
  [K in keyof Layers]: [
    Exclude<
      Layer.Services<Layers[K]>,
      { [I in keyof Layers]: Layer.Success<Layers[I]> }[number]
    >,
  ] extends [never] ? Layers[K]
    : Layer.Layer<
      Layer.Success<Layers[K]>,
      Layer.Error<Layers[K]>,
      Extract<
        Layer.Services<Layers[K]>,
        { [I in keyof Layers]: Layer.Success<Layers[I]> }[number]
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
  const Layers extends readonly [Layer.Any, ...Array<Layer.Any>],
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
 * for the surrounding scope (typically via `Layer.effectContext`).
 *
 * Side effects on a layer's acquire path may run more than once if the layer
 * fails (because its deps weren't ready) and is later retried — use
 * `provideMergeAll` with explicit ordering for layers that can't tolerate that.
 * Effect 4 RC.112 represents a missing service as an unbranded `Error`, so a
 * user defect with the same message is indistinguishable; use explicit ordering
 * if a layer can die with `Service not found`.
 */
export function buildUnordered<
  const Layers extends ReadonlyArray<Layer.Any>,
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
    let ctx = yield* Effect.context<any>()
    const provided = new Map<string, unknown>()
    const pending = new Set<AnyLayer>(
      layers as unknown as ReadonlyArray<AnyLayer>,
    )

    while (pending.size > 0) {
      let progressed = false
      const failures: Array<Cause.Cause<unknown>> = []

      for (const layer of pending) {
        const memoMap = Layer.CurrentMemoMap.forkOrCreate(ctx)
        const childScope = yield* Scope.fork(
          scope,
          "sequential",
        )
        const exit = yield* layer.pipe(
          Layer.buildWithMemoMap(memoMap, childScope),
          Effect.provide(ctx),
          Effect.exit,
        )
        if (Exit.isSuccess(exit)) {
          const outputs = [...exit.value.mapUnsafe].filter(([key]) => key !== Layer.CurrentMemoMap.key)
          const duplicateKey = outputs
            .find(([key, value]) => provided.has(key) && !Object.is(provided.get(key), value))
            ?.[0]
          if (duplicateKey !== undefined) {
            const defect = new Error(`Start.pack received multiple layers providing service: ${duplicateKey}`)
            yield* Scope.close(childScope, Exit.die(defect))
            return yield* Effect.die(defect)
          }
          for (const [key, value] of outputs) provided.set(key, value)
          ctx = Context.merge(ctx, exit.value)
          pending.delete(layer)
          progressed = true
        } else {
          yield* Scope.close(childScope, exit)
          const isMissingService = exit.cause.reasons.length > 0 &&
            exit.cause.reasons.every((reason) =>
              Cause.isDieReason(reason) &&
              reason.defect instanceof Error &&
              (reason.defect.message === "Service not found" ||
                reason.defect.message.startsWith("Service not found: "))
            )
          if (!isMissingService) {
            return yield* exit
          }
          failures.push(exit.cause)
        }
      }

      if (!progressed) {
        const combined = failures.reduce<Cause.Cause<unknown>>(
          (acc, cause) => Cause.combine(acc, cause),
          Cause.empty,
        )
        return yield* Effect.failCause(combined)
      }
    }

    return ctx
  })
}
