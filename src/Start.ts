import type * as FileSystem from "./FileSystem.ts"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as ExecutionStrategy from "effect/ExecutionStrategy"
import * as Exit from "effect/Exit"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as SynchronizedRef from "effect/SynchronizedRef"
import type * as ChildProcess from "./ChildProcess.ts"
import * as BunRuntime from "./bun/BunRuntime.ts"
import * as BunServer from "./bun/BunServer.ts"
import * as NodeFileSystem from "./node/NodeFileSystem.ts"
import * as BunChildProcessSpawner from "./bun/BunChildProcessSpawner.ts"
import * as StartApp from "./StartApp.ts"

export function layer<
  Layers extends [Layer.Layer<never, any, any>, ...Array<Layer.Layer<never, any, any>>],
>(
  ...layers: Layers
): Layer.Layer<
  { [k in keyof Layers]: Layer.Layer.Success<Layers[k]> }[number],
  { [k in keyof Layers]: Layer.Layer.Error<Layers[k]> }[number],
  { [k in keyof Layers]: Layer.Layer.Context<Layers[k]> }[number]
> {
  return Layer.mergeAll(...layers)
}

/**
 * Bundles layers together, wiring their dependencies automatically.
 *
 * Equivalent to chaining `Layer.provide` calls, but more concise.
 *
 * **Ordering: dependents first, dependencies last.**
 *
 * @example
 * ```ts
 * // UserRepo needs Database, Database needs Logger
 * const AppLayer = Start.pack(
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
export function pack<
  const Layers extends readonly [Layer.Layer.Any, ...Array<Layer.Layer.Any>],
>(
  ...layers: Layers & OrderedPack<NoInfer<Layers>, NoInfer<Layers>>
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

type Unsatisfied<Unmet, Success> =
  Unmet extends Success ? Unmet : never

type OrderedPack<
  Layers extends readonly Layer.Layer.Any[],
  All extends readonly Layer.Layer.Any[],
> = Layers extends readonly [
  infer Head extends Layer.Layer.Any,
  ...infer Tail extends Layer.Layer.Any[],
]
  ? [
    [
      Unsatisfied<
        Exclude<Layer.Layer.Context<Head>, { [K in keyof Tail]: Layer.Layer.Success<Tail[K]> }[number]>,
        { [K in keyof All]: Layer.Layer.Success<All[K]> }[number]
      >,
    ] extends [never]
    ? Head
    : never,
    ...OrderedPack<Tail, All>,
  ]
  : []

/**
 * Like `pack`, but accepts layers in any order.
 *
 * ```ts
 * // These all produce the same result:
 * Start.build(LoggerLive, DatabaseLive, UserRepoLive)
 * Start.build(UserRepoLive, DatabaseLive, LoggerLive)
 * ```
 *
 * @since 1.0.0
 * @category constructors
 */
export function build<
  const Layers extends readonly [Layer.Layer.Any, ...Array<Layer.Layer.Any>],
>(
  ...layers: Layers
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

  return Layer.scopedContext(
    Effect.gen(function* () {
      const scope = yield* Effect.scope
      const memoMap = yield* Layer.makeMemoMap
      const memoMapRef = (memoMap as any).ref as SynchronizedRef.SynchronizedRef<Map<AnyLayer, any>>
      let ctx = yield* Effect.context<any>()
      const pending = new Set<AnyLayer>(layerArray)

      for (let pass = 0; pass < layerArray.length && pending.size > 0; pass++) {
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
          } else {
            yield* Scope.close(childScope, exit)
            yield* SynchronizedRef.update(memoMapRef, (map) => {
              map.delete(layer)
              return map
            })
          }
        }
      }

      for (const layer of pending) {
        const childScope = yield* Scope.fork(scope, ExecutionStrategy.sequential)
        const built = yield* layer.pipe(
          Layer.buildWithMemoMap(memoMap, childScope),
          Effect.provide(ctx),
        )
        ctx = Context.merge(ctx, built)
      }

      return ctx
    }),
    // TODO: not sure how to properly type it yet
  ) as any
}

export type PlatformServices =
  | BunServer.BunServer
  | FileSystem.FileSystem
  | ChildProcess.ChildProcessSpawner
  | StartApp.StartApp

export const Live: Layer.Layer<
  Exclude<PlatformServices, BunServer.BunServer>,
  never,
  never
> = Layer.mergeAll(
  NodeFileSystem.layer,
  BunChildProcessSpawner.layer,
  Layer.effect(
    StartApp.StartApp,
    Deferred.make<BunServer.BunServer>().pipe(Effect.map((server) => ({ server }))),
  ),
)

export function serve<ROut, E, RIn extends PlatformServices>(
  load: () => Promise<{
    default: Layer.Layer<ROut, E, RIn>
  }>,
) {
  const appLayer = Function.pipe(
    Effect.tryPromise(load),
    Effect.map((v) => v.default),
    Effect.orDie,
    Layer.unwrapEffect,
  )

  const appLayerResolved = Function.pipe(appLayer, Layer.provideMerge(Live))

  const composed = Function.pipe(
    BunServer.layerStart(),
    BunServer.withLogAddress,
    Layer.provide(appLayerResolved),
  ) as Layer.Layer<BunServer.BunServer, never, never>

  return Function.pipe(composed, Layer.launch, BunRuntime.runMain)
}
