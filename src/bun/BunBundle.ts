import type { HttpRouter } from "@effect/platform"
import type { BuildConfig, BuildOutput } from "bun"
import {
  Array,
  Context,
  Effect,
  Iterable,
  Layer,
  Option,
  pipe,
  PubSub,
  Record,
  Stream,
  SynchronizedRef,
} from "effect"
import * as NPath from "node:path"
import { fileURLToPath } from "node:url"
import type { BundleContext, BundleManifest } from "../Bundle.ts"
import * as Bundle from "../Bundle.ts"
import { importJsBlob } from "../esm.ts"
import { watchFileChanges } from "../files.ts"
import * as BunImportTrackerPlugin from "./BunImportTrackerPlugin.ts"

type BunBundleConfig = BuildConfig

type BuildOptions = Omit<BunBundleConfig, "outdir">

const BunBundleContextLoadRef = Symbol.for(
  "effect-bundler/BunBundleContextLoadRef",
)

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

          const loadRef = bundle[BunBundleContextLoadRef] as
            | SynchronizedRef.SynchronizedRef<M | null>
            | undefined

          if (!loadRef) {
            return yield* load<M>(config)
          }

          const loadedBundle = yield* SynchronizedRef.updateAndGetEffect(
            loadRef,
            (current) =>
              current ? Effect.succeed(current) : Bundle.load<M>(bundle),
          )

          // we need to cast it manually because updateAndGetEffect
          // doesn't properly infer return type.
          return loadedBundle as M
        }),
      layer: Layer.effect(
        Bundle.tagged(key),
        effect(config),
      ),
      devLayer: Layer.scoped(
        Bundle.tagged(key),
        Effect.gen(function*() {
          const sharedBundle = yield* effect(config)

          const loadRef = sharedBundle[BunBundleContextLoadRef] =
            yield* SynchronizedRef.make(null)

          sharedBundle.events = yield* PubSub.unbounded<Bundle.BundleEvent>()

          yield* Effect.fork(
            pipe(
              watchFileChanges(),
              Stream.runForEach((v) =>
                Effect.gen(function*() {
                  yield* Effect.logDebug("Updating bundle: " + key)

                  const newBundle = yield* effect(config)

                  Object.assign(sharedBundle, newBundle)

                  // Clean old loaded bundle
                  yield* SynchronizedRef.update(loadRef, () => null)

                  // publish event after the built
                  if (sharedBundle.events) {
                    yield* PubSub.publish(sharedBundle.events, v)
                  }
                })
              ),
              // Log error otherwise stream would close and we would not
              // know about it because we're processing it in a fork.
              Effect.tapError(err =>
                Effect.logError("Error while updating bundle", err)
              ),
            ),
          )

          return sharedBundle
        }),
      ),
    },
  )

export const bundleBrowser = (
  config: BuildOptions,
) => {
  const isDevelopment = process.env.NODE_ENV !== "production"
  const baseConfig: Partial<BuildOptions> = isDevelopment
    ? {
      naming: "[dir]/[name].[ext]",
      sourcemap: "linked",
      packages: "bundle",
    } as const
    : {
      naming: "[name]-[hash].[ext]",
      sourcemap: "none",
      packages: "bundle",
    } as const
  const resolvedConfig = {
    ...baseConfig,
    target: "browser" as const,
    ...config,
  }

  return bundle("BrowserBundle", resolvedConfig)
}

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
) => Layer.effect(tag, effect(config))

export const build = (
  config: BunBundleConfig,
): Effect.Effect<BuildOutput, Bundle.BundleError, never> & {
  config: BunBundleConfig
} =>
  Object.assign(
    Effect.gen(function*() {
      const buildOutput: BuildOutput = yield* Effect.tryPromise({
        try: () => Bun.build(config),
        catch: (err: AggregateError | unknown) => {
          return new Bundle.BundleError({
            message: "Failed to BunBundle.build",
            cause: err instanceof AggregateError
              ? err.errors?.[0] || err.cause || err
              : err,
          })
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
): Effect.Effect<M, Bundle.BundleError, never> & { config: BunBundleConfig } =>
  Object.assign(
    pipe(
      build(config),
      Effect.andThen((buildOutput) =>
        Effect.tryPromise({
          try: () => importJsBlob<M>(buildOutput.outputs[0]),
          catch: (err) =>
            new Bundle.BundleError({
              message: "Failed to load BunBundle.load",
              cause: err,
            }),
        })
      ),
    ),
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

// iterate over routes
// find all entrypoints
// find all httpBundles
export const configFromHttpRouter = (
  router: HttpRouter.HttpRouter<any, Bundle.BundleKey>,
) => {
  const entrypoints = pipe(
    router.routes,
    Iterable.filterMap((route) =>
      Option.fromNullable(
        route.handler[
          Bundle.BundleEntrypointMetaKey
        ] as Bundle.BundleEntrypointMetaValue,
      )
    ),
    Iterable.map((v) =>
      v.uri.startsWith("file://") ? fileURLToPath(v.uri) : v.uri
    ),
    Array.fromIterable,
  )
  const publicPath = pipe(
    router.mounts,
    Iterable.filterMap(([path, httpApp]) =>
      httpApp[Bundle.BundleOutputMetaKey]
        ? Option.some(path)
        : Option.none()
    ),
    Iterable.head,
    Option.getOrThrowWith(() =>
      new Error("HttpRouter must have a bundler route")
    ),
  )

  const config: BuildConfig = {
    entrypoints,
    publicPath: publicPath + "/",
  }

  return config
}
