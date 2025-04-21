import { HttpRouter, HttpServerResponse } from "@effect/platform"
import { type BuildConfig, type BuildOutput, fileURLToPath } from "bun"
import {
  Console,
  Context,
  Data,
  Effect,
  Iterable,
  Layer,
  pipe,
  Record,
  Ref,
  Stream,
  SubscriptionRef,
  SynchronizedRef,
  Take,
} from "effect"
import * as NFSP from "node:fs/promises"
import * as NPath from "node:path"
import * as process from "node:process"
import type { BundleContext, BundleManifest } from "../Bundle.ts"
import * as Bundle from "../Bundle.ts"
import { importJsBlob } from "../esm.ts"

type BunBundleConfig = BuildConfig

class BunBundleError extends Error {
  readonly _tag = "BunBundleError"

  constructor(readonly cause: any) {
    if (cause instanceof AggregateError) {
      const firstError = cause.errors?.at(0)

      if (firstError) {
        cause = firstError
      }
    }

    const message = cause["message"] ?? String(cause)

    super(message)
  }
}

const SOURCE_FILENAME = /\.(tsx?|jsx?)$/

type BuildOptions = Omit<BunBundleConfig, "outdir">

export const bundle = <I extends `${string}Bundle`>(
  key: I,
  config: BunBundleConfig,
) =>
  Object.assign(
    Bundle.tagged(key),
    {
      config,
      load: <M>(): Effect.Effect<M, Bundle.BundleError, I> =>
        Effect.gen(function*() {
          const bundle = yield* Bundle.tagged(key)
          const ref = bundle["_loadRef"] as SynchronizedRef.SynchronizedRef<M>

          if (!ref) {
            yield* Effect.die(
              new Error("Trying to use load while not providing devLayer"),
            )
          }

          yield* SynchronizedRef.updateEffect(
            ref,
            (current) =>
              current === null
                ? Bundle.load<M>(bundle)
                : Effect.succeed(current),
          )

          return yield* ref
        }),
      layer: Layer.effect(Bundle.tagged(key), effect(config)),
      devLayer: Layer.effect(
        Bundle.tagged(key),
        Effect.gen(function*() {
          const sharedBundle = yield* effect(config)
          const changes = watchChanges()
          // create changesPubSub from changes stream AI!

          sharedBundle.events = changesPubSub

          sharedBundle["_loadRef"] = yield* SynchronizedRef.make(null)

          yield* Effect.fork(
            pipe(
              changes,
              Stream.runForEach(() =>
                Effect.gen(function*() {
                  const newBundle = yield* effect(config)

                  yield* SynchronizedRef.updateEffect(
                    sharedBundle["_loadRef"],
                    () => Bundle.load(newBundle),
                  )

                  Object.assign(sharedBundle, newBundle)
                })
              ),
            ),
          )

          return sharedBundle
        }),
      ),
    },
  )

/**
 * Given a config, build a bundle and returns every time when effect is executed.
 */
export const effect = (
  config: BunBundleConfig,
): Effect.Effect<BundleContext, any> =>
  Effect.gen(function*() {
    const output = yield* build(config)
    const manifest = generateManifestfromBunBundle(config, output)
    const artifactsMap = Record.fromIterableBy(
      output.outputs,
      (v) => v.path.slice(2),
    )

    return {
      ...manifest,
      resolve: (url: string) => {
        return manifest.entrypoints[url] ?? null
      },
      getArtifact: (path): Blob | null => {
        return artifactsMap[path] ?? null
      },
    }
  })

export const layer = <T>(
  tag: Context.Tag<T, BundleContext>,
  config: BunBundleConfig,
) => {
  return Layer.effect(
    tag,
    effect(config),
  )
}

export const build = (
  config: BunBundleConfig,
): Effect.Effect<BuildOutput, BunBundleError, never> & {
  config: BunBundleConfig
} =>
  Object.assign(
    Effect.gen(function*() {
      const buildOutput: BuildOutput = yield* Effect.tryPromise({
        try: () => Bun.build(config),
        catch: (err) => {
          return new BunBundleError(err)
        },
      })

      return buildOutput
    }),
    {
      config,
    },
  )

/**
 * Builds, loads, and return a module as an Effect.
 */
export const load = <M>(
  config: BunBundleConfig,
): Effect.Effect<M, BunBundleError, never> & { config: BunBundleConfig } =>
  Object.assign(
    pipe(
      build(config),
      Effect.andThen((buildOutput) =>
        Effect.tryPromise({
          try: () => importJsBlob<M>(buildOutput.outputs[0]),
          catch: (err) => new BunBundleError(err),
        })
      ),
    ),
    {
      config,
    },
  )

const watchChanges = (): Stream.Stream<
  { type: "Change"; path: string }
> => {
  // get dirname after the build as user may pass URL rather than
  // path which Bun does not resolve.
  const baseDir = NPath.dirname(process.cwd())

  const changes = pipe(
    Stream.fromAsyncIterable(
      NFSP.watch(baseDir, { recursive: true }),
      (e) => e,
    ),
    Stream.filter((event) => SOURCE_FILENAME.test(event.filename!)),
    Stream.filter((event) => !(/node_modules/.test(event.filename!))),
    Stream.tap(Console.log),
    Stream.throttle({
      units: 1,
      cost: () => 1,
      duration: "100 millis",
      strategy: "enforce",
    }),
    Stream.map((event) => ({
      type: "Change" as const,
      path: event.filename!,
    })),
    Stream.catchAll((error) => Stream.empty),
  )

  return changes
}

/**
 * Same as `load` but ensures that most recent module is always returned.
 * Useful for development.
 */
export const loadWatch = <M>(
  config: BunBundleConfig,
): Effect.Effect<M, BunBundleError, never> & { config: BunBundleConfig } =>
  Object.assign(
    Effect.gen(function*() {
      const [entrypoint] = config.entrypoints
      const _load = load<M>(config)
      const ref = yield* SubscriptionRef.make<M>(yield* _load)

      // get dirname after the build as user may pass URL rather than
      // path which Bun does not resolve.
      const baseDir = NPath.dirname(
        NPath.resolve(process.cwd(), entrypoint),
      )

      const changes = pipe(
        Stream.fromAsyncIterable(
          NFSP.watch(baseDir, { recursive: true }),
          (e) => e,
        ),
        Stream.filter((event) => SOURCE_FILENAME.test(event.filename!)),
        Stream.throttle({
          units: 1,
          cost: () => 1,
          duration: "100 millis",
          strategy: "enforce",
        }),
      )

      yield* Effect.fork(
        pipe(
          changes,
          Stream.runForEach((event) =>
            Effect.gen(function*() {
              yield* Effect.logDebug(
                `Reloading bundle due to file change: ${event.filename}`,
              )

              const app = yield* _load

              yield* Ref.update(ref, () => app)
            })
          ),
        ),
      )

      return yield* ref
    }),
    {
      config,
    },
  )

/**
 * Finds common path prefix across provided paths.
 */
function getBaseDir(paths: string[]) {
  const segmentsList = paths.map((path) => path.split("/").filter(Boolean))

  return segmentsList[0]
    .filter((segment, i) => segmentsList.every((segs) => segs[i] === segment))
    .reduce((path, seg) => `${path}/${seg}`, "") ?? ""
}

/**
 * Maps entrypoints to their respective build artifacts.
 * Entrypoint key is trimmed to remove common path prefix.
 */
function mapBuildEntrypoints(
  options: BuildOptions,
  output: BuildOutput,
) {
  const commonPathPrefix = getBaseDir(
    options.entrypoints.map((v) => NPath.dirname(v)),
  ) + "/"

  return pipe(
    Iterable.zip(
      options.entrypoints,
      pipe(
        output.outputs,
        // Filter out source maps to properly map artifacts to entrypoints.
        Iterable.filter((v) => !v.path.endsWith(".js.map")),
      ),
    ),
    Iterable.map(([entrypoint, artifact]) =>
      [
        entrypoint.replace(commonPathPrefix, ""),
        artifact,
      ] as const
    ),
    Record.fromEntries,
  )
}

/**
 * Generate manifest from a build.
 * Useful for SSR and providing source->artifact path mapping.
 */
function generateManifestfromBunBundle(
  options: BuildOptions,
  output: BuildOutput,
): BundleManifest {
  const entrypointArtifacts = mapBuildEntrypoints(options, output)

  return {
    entrypoints: Record.mapEntries(entrypointArtifacts, (v, k) => [
      k,
      // strip ./ prefix
      v.path.slice(2),
    ]),

    artifacts: pipe(
      output.outputs,
      // This will mess up direct entrypoint-artifact record.
      // Will have to filter out sourcemap when mapping.
      Iterable.flatMap((v) => v.sourcemap ? [v, v.sourcemap] : [v]),
      Iterable.map((v) =>
        [
          // strip './' prefix
          v.path.slice(2),
          {
            hash: v.hash,
            size: v.size,
            type: v.type,
          },
        ] as const
      ),
      Record.fromEntries,
    ),
  }
}
