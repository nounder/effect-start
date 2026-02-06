import * as FileSystem from "./FileSystem.ts"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as BunRuntime from "./bun/BunRuntime.ts"
import * as BunServer from "./bun/BunServer.ts"
import * as NodeFileSystem from "./node/NodeFileSystem.ts"

export function layer<
  Layers extends [
    Layer.Layer<never, any, any>,
    ...Array<Layer.Layer<never, any, any>>,
  ],
>(...layers: Layers): Layer.Layer<
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
  const result: AnyLayer = layerArray.reduce(
    (acc: AnyLayer, layer: AnyLayer) => Layer.provideMerge(acc, layer),
    Layer.succeedContext(Context.empty()) as unknown as AnyLayer,
  )

  return result as AnyLayer
}

export function serve<
  ROut,
  E,
  RIn extends BunServer.BunServer | FileSystem.FileSystem,
>(
  load: () => Promise<{
    default: Layer.Layer<ROut, E, RIn>
  }>,
) {
  const appLayer = Function.pipe(
    Effect.tryPromise(load),
    Effect.map(v => v.default),
    Effect.orDie,
    Layer.unwrapEffect,
  )

  const serverLayer = Layer.scoped(
    BunServer.BunServer,
    Effect.gen(function*() {
      const existing = yield* Effect.serviceOption(BunServer.BunServer)
      if (Option.isSome(existing)) return existing.value
      return yield* BunServer.make({})
    }),
  )

  const composed = Function.pipe(
    serverLayer,
    BunServer.withLogAddress,
    Layer.provide(appLayer),
    Layer.provide(NodeFileSystem.layer),
  ) as Layer.Layer<BunServer.BunServer, never, never>

  return Function.pipe(
    composed,
    Layer.launch,
    BunRuntime.runMain,
  )
}
