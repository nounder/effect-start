import type * as FileSystem from "./FileSystem.ts"
import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as FiberId from "effect/FiberId"
import * as ExecutionStrategy from "effect/ExecutionStrategy"
import * as Exit from "effect/Exit"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as SynchronizedRef from "effect/SynchronizedRef"
import type * as ChildProcess from "./ChildProcess.ts"
import * as MutableRef from "effect/MutableRef"
import * as BunRuntime from "./bun/BunRuntime.ts"
import * as BundleRoute from "./bundler/BundleRoute.ts"
import * as BunServer from "./bun/BunServer.ts"
import * as NodeFileSystem from "./node/NodeFileSystem.ts"
import * as BunChildProcessSpawner from "./bun/BunChildProcessSpawner.ts"
import * as PlatformRuntime from "./PlatformRuntime.ts"
import * as StartApp from "./internal/StartApp.ts"

/**
 * Builds layers in the given order, wiring their dependencies automatically.
 *
 * Equivalent to chaining `Layer.provide` calls, but more concise.
 *
 * **Ordering: dependents first, dependencies last.**
 *
 * @example
 * ```ts
 * // UserRepo needs Database, Database needs Logger
 * const AppLayer = Start.build(
 *   UserRepoLive,   // needs Database, Logger
 *   DatabaseLive,   // needs Logger
 *   LoggerLive,     // no deps
 * )
 * // Result: Layer<UserRepo | Database | Logger, never, never>
 * ```
 *
 * @since 1.0.0
 * @category constructors
 */
export function build<const Layers extends readonly [Layer.Layer.Any, ...Array<Layer.Layer.Any>]>(
  ...layers: Layers & OrderedBuild<NoInfer<Layers>, NoInfer<Layers>>
): Layer.Layer<
  { [K in keyof Layers]: Layer.Layer.Success<Layers[K]> }[number],
  { [K in keyof Layers]: Layer.Layer.Error<Layers[K]> }[number],
  Exclude<
    { [K in keyof Layers]: Layer.Layer.Context<Layers[K]> }[number],
    { [K in keyof Layers]: Layer.Layer.Success<Layers[K]> }[number]
  >
> {
  type AnyLayer = Layer.Layer<any, any, any>
  const layerArray = layers as unknown as ReadonlyArray<AnyLayer>
  const result: AnyLayer = layerArray.reduce(
    (acc: AnyLayer, layer: AnyLayer) => Layer.provideMerge(acc, layer),
    Layer.succeedContext(Context.empty()) as unknown as AnyLayer,
  )

  return result as AnyLayer
}

type Unsatisfied<Unmet, Success> = Unmet extends Success ? Unmet : never

type OrderedBuild<
  Layers extends readonly Layer.Layer.Any[],
  All extends readonly Layer.Layer.Any[],
> = Layers extends readonly [
  infer Head extends Layer.Layer.Any,
  ...infer Tail extends Layer.Layer.Any[],
]
  ? [
      [
        Unsatisfied<
          Exclude<
            Layer.Layer.Context<Head>,
            { [K in keyof Tail]: Layer.Layer.Success<Tail[K]> }[number]
          >,
          { [K in keyof All]: Layer.Layer.Success<All[K]> }[number]
        >,
      ] extends [never]
        ? Head
        : never,
      ...OrderedBuild<Tail, All>,
    ]
  : []

type PackSuccess<Layers extends readonly Layer.Layer.Any[]> = {
  [K in keyof Layers]: Layer.Layer.Success<Layers[K]>
}[number]

type PackError<Layers extends readonly Layer.Layer.Any[]> = {
  [K in keyof Layers]: Layer.Layer.Error<Layers[K]>
}[number]

type PackContext<Layers extends readonly Layer.Layer.Any[]> = Exclude<
  { [K in keyof Layers]: Layer.Layer.Context<Layers[K]> }[number],
  { [K in keyof Layers]: Layer.Layer.Success<Layers[K]> }[number]
>

/**
 * Like `build`, but accepts layers in any order.
 *
 * ```ts
 * // These all produce the same result:
 * Start.pack(LoggerLive, DatabaseLive, UserRepoLive)
 * Start.pack(UserRepoLive, DatabaseLive, LoggerLive)
 * ```
 *
 * @since 1.0.0
 * @category constructors
 */
export function pack<const Layers extends readonly [Layer.Layer.Any, ...Array<Layer.Layer.Any>]>(
  ...layers: Layers
): Layer.Layer<PackSuccess<Layers>, PackError<Layers>, PackContext<Layers>> {
  type AnyLayer = Layer.Layer<any, any, any>
  const layerArray = layers as unknown as ReadonlyArray<AnyLayer>

  return Layer.scopedContext(
    Effect.gen(function* () {
      const scope = yield* Effect.scope
      const memoMap = yield* Layer.makeMemoMap
      let ctx = yield* Effect.context<any>()
      const pending = new Set<AnyLayer>(layerArray)

      while (pending.size > 0) {
        let progressed = false
        const failures: Array<Cause.Cause<unknown>> = []

        for (const layer of [...pending]) {
          const childScope = yield* Scope.fork(scope, ExecutionStrategy.sequential)
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
            }).ref
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
          // No layer made progress this pass — remaining failures are real,
          // not "dependency not built yet". Surface them all so the caller sees
          // the actual root cause(s) rather than an arbitrary single error.
          const combined = failures.reduce<Cause.Cause<unknown>>(
            (acc, cause) => Cause.parallel(acc, cause),
            Cause.empty,
          )
          return yield* Effect.failCause(combined)
        }
      }

      return ctx
    }),
  )
}

export function layerDev() {
  return Layer.mergeAll(NodeFileSystem.layer, BunChildProcessSpawner.layer)
}

type AppRequirements =
  | BunServer.BunServer
  | FileSystem.FileSystem
  | ChildProcess.ChildProcessSpawner
  | StartApp.StartApp

export function serve<ROut, E, RIn extends AppRequirements>(
  app: Layer.Layer<ROut, E, RIn> | (() => Promise<{ default: Layer.Layer<ROut, E, RIn> }>),
) {
  const appLayer =
    typeof app === "function"
      ? Function.pipe(
          Effect.tryPromise(app),
          Effect.map((v) => v.default),
          Effect.orDie,
          Layer.unwrapEffect,
        )
      : app

  const appLayerResolved = Function.pipe(
    appLayer,
    Layer.provideMerge(
      Layer.mergeAll(
        layerDev(),
        Layer.effect(
          StartApp.StartApp,
          Deferred.make<BunServer.BunServer>().pipe(Effect.map((server) => ({ server }))),
        ),
      ),
    ),
  )

  const composed = Function.pipe(
    BunServer.layerStart(),
    BunServer.withLogAddress,
    Layer.provide(Function.pipe(BundleRoute.layer(), Layer.provideMerge(appLayerResolved))),
  ) as Layer.Layer<BunServer.BunServer, never, never>

  return Function.pipe(composed, Layer.launch, BunRuntime.runMain)
}

export const mainFiberId: Effect.Effect<FiberId.FiberId> = Effect.sync(() => {
  const fiber = MutableRef.get(PlatformRuntime.mainFiber)
  return fiber ? fiber.id() : FiberId.none
})
