import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import type * as HttpServer from "effect/unstable/http/HttpServer"
import type * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner"
import * as BunRuntime from "./bun/BunRuntime.ts"
import * as BunServer from "./bun/BunServer.ts"
import * as BundleRoute from "./bundler/BundleRoute.ts"
import * as Development from "./Development.ts"
import * as LayerExtra from "./internal/LayerExtra.ts"

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
export function build<
  const Layers extends readonly [Layer.Any, ...Array<Layer.Any>],
>(
  ...layers: Layers & LayerExtra.Ordered<NoInfer<Layers>, NoInfer<Layers>>
): Layer.Layer<
  LayerExtra.LayersSuccess<Layers>,
  LayerExtra.LayersError<Layers>,
  LayerExtra.LayersContext<Layers>
> {
  return (LayerExtra.provideMergeAll as (...l: Array<Layer.Any>) => any)(
    ...layers,
  )
}

/**
 * Like `build`, but accepts layers in any order. Every layer's dependencies
 * must be satisfied by another layer.
 *
 * @example
 * ```ts
 * // These all produce the same result:
 * Start.pack(LoggerLive, DatabaseLive, UserRepoLive)
 * Start.pack(UserRepoLive, DatabaseLive, LoggerLive)
 * ```
 */
export function pack<
  const Layers extends readonly [
    Layer.Any,
    ...Array<Layer.Any>,
  ],
>(
  ...layers: LayerExtra.Unordered<Layers>
): Layer.Layer<
  LayerExtra.LayersSuccess<Layers>,
  LayerExtra.LayersError<Layers>,
  never
> {
  return Layer.effectContext(
    LayerExtra.buildUnordered(layers as unknown as Layers),
  ) as any
}

export function layerDev() {
  return Development.layerBase()
}

// TODO: do we even need to define requirements upfront?
type AppRequirements =
  | HttpServer.HttpServer
  | FileSystem.FileSystem
  | ChildProcessSpawner.ChildProcessSpawner

class StartError extends Data.TaggedError("StartError")<{
  readonly cause: unknown
}> {}

export function serve<ROut, E, RIn extends AppRequirements>(
  app:
    | Layer.Layer<ROut, E, RIn>
    | (() => Promise<{ default: Layer.Layer<ROut, E, RIn> }>),
) {
  const appLayer = typeof app === "function"
    ? Function.pipe(
      Effect.tryPromise({
        try: app,
        catch: (cause) => new StartError({ cause }),
      }),
      Effect.map((v) => v.default),
      Effect.orDie,
      Layer.unwrap,
    )
    : app

  const appLayerResolved = Function.pipe(
    appLayer,
    Layer.provideMerge(layerDev()),
  )

  const composed = Function.pipe(
    BunServer.layerStart(),
    BunServer.withLogAddress,
    Layer.provide(
      Function.pipe(
        BundleRoute.layer(),
        Layer.provideMerge(appLayerResolved),
      ),
    ),
  ) as Layer.Layer<HttpServer.HttpServer, never, never>

  return Function.pipe(
    composed,
    Layer.launch,
    BunRuntime.runMain,
  )
}

/**
 * Given module meta of an entrypoint that exports Start app, run it.
 *
 * @example
 * ```ts
 * // server.ts or other entrypoint
 * import { Start } from "effect-start"
 *
 * export default Start.pack(...)
 *
 * Start.runMain(import.meta)
 * ```
 */
export function runMain(meta: ImportMeta): void {
  if (meta.main) {
    serve(() => import(meta.url))
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      `Start.runMain: ${meta.url} is not an entrypoint, skipping.`,
    )
  }
}
