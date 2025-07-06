import type {
  BuildConfig,
  BuildOutput,
} from "bun"
import {
  Context,
  Effect,
  Iterable,
  Layer,
  pipe,
  PubSub,
  Record,
  Stream,
  SynchronizedRef,
} from "effect"
import * as NPath from "node:path"
import type {
  BundleContext,
  BundleManifest,
} from "../Bundle.ts"
import * as Bundle from "../Bundle.ts"
import * as FileSystemExtra from "../FileSystemExtra.ts"
import { BunImportTrackerPlugin } from "./index.ts"

export type BuildOptions = Omit<
  BuildConfig,
  "outdir"
>

export const buildClient = (
  config: BuildOptions | string,
) => {
  if (typeof config === "string") {
    config = {
      entrypoints: [config],
    }
  }

  const baseConfig: Partial<BuildOptions> = {
    sourcemap: "linked",
    naming: {
      entry: "[name]-[hash].[ext]",
      chunk: "[name]-[hash].[ext]",
      asset: "[name]-[hash].[ext]",
    },
    packages: "bundle",
  } as const
  const resolvedConfig = {
    ...baseConfig,
    target: "browser" as const,
    ...config,
  }

  return build(resolvedConfig)
}

export const buildServer = (
  config: BuildOptions | string,
) => {
  if (typeof config === "string") {
    config = {
      entrypoints: [config],
    }
  }

  const baseConfig: Partial<BuildOptions> = {
    sourcemap: "linked",
    naming: {
      entry: "[dir]/[name]-[hash].[ext]",
      chunk: "[name]-[hash].[ext]",
      asset: "[name]-[hash].[ext]",
    },
    packages: "bundle",
  } as const
  const resolvedConfig = {
    ...baseConfig,
    target: "bun" as const,
    ...config,
  }

  return build(resolvedConfig)
}

/**
 * Given a config, build a bundle and returns every time when effect is executed.
 */
export function build(
  config: BuildOptions,
): Effect.Effect<BundleContext, Bundle.BundleError> {
  return Effect.gen(function*() {
    const output = yield* buildBun(config)
    const manifest = generateManifestfromBunBundle(
      config,
      output,
    )
    const artifactsMap = Record.fromIterableBy(
      output.outputs,
      (v) => v.path.replace(/^\.\//, ""),
    )

    const resolve = (path: string) => {
      return manifest.entrypoints[path] ?? null
    }

    const getArtifact = (path: string): Blob | null => {
      return artifactsMap[resolve(path)]
        ?? artifactsMap[path]
        ?? null
    }

    return {
      ...manifest,
      resolve,
      getArtifact,
    }
  })
}

export function layer<T>(
  tag: Context.Tag<T, BundleContext>,
  config: BuildOptions,
) {
  return Layer.effect(tag, build(config))
}

export function layerDev<T>(
  tag: Context.Tag<T, BundleContext>,
  config: BuildOptions,
) {
  return Layer.scoped(
    tag,
    Effect.gen(function*() {
      const loadRefKey = "_loadRef"
      const sharedBundle = yield* build(config)

      const loadRef = yield* SynchronizedRef.make(null)
      sharedBundle[loadRefKey] = loadRef
      sharedBundle.events = yield* PubSub.unbounded<Bundle.BundleEvent>()

      yield* Effect.fork(
        pipe(
          FileSystemExtra.watchSource(),
          Stream.map(v =>
            ({
              type: "Change",
              path: v.filename,
            }) as Bundle.BundleEvent
          ),
          Stream.onError(err =>
            Effect.logError("Error while watching files", err)
          ),
          Stream.runForEach((v) =>
            pipe(
              Effect.gen(function*() {
                yield* Effect.logDebug("Updating bundle: " + key)

                const newBundle = yield* build(config)

                Object.assign(sharedBundle, newBundle)

                // Clean old loaded bundle
                yield* SynchronizedRef.update(loadRef, () => null)

                // publish event after the built
                if (sharedBundle.events) {
                  yield* PubSub.publish(sharedBundle.events, v)
                }
              }),
              Effect.catchAll(err =>
                Effect.gen(function*() {
                  yield* Effect.logError(
                    "Error while updating bundle",
                    err,
                  )
                  if (sharedBundle.events) {
                    yield* PubSub.publish(sharedBundle.events, {
                      type: "BuildError",
                      error: String(err),
                    })
                  }
                })
              ),
            )
          ),
        ),
      )

      return sharedBundle
    }),
  )
}

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
function joinBuildEntrypoints(
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
        Iterable.filter((v) =>
          v.kind !== "sourcemap"
          && !(v.loader === "html" && v.path.endsWith(".js"))
        ),
      ),
    ),
    Iterable.map(([entrypoint, artifact]) => {
      return {
        shortPath: entrypoint.replace(commonPathPrefix, ""),
        fullPath: entrypoint,
        artifact,
      } as const
    }),
  )
}

/**
 * Generate manifest from a build.
 * Useful for SSR and providing source->artifact path mapping.
 */
function generateManifestfromBunBundle(
  options: BuildOptions,
  output: BuildOutput,
  imports?: BunImportTrackerPlugin.ImportMap,
): BundleManifest {
  const entrypointArtifacts = joinBuildEntrypoints(options, output)

  return {
    entrypoints: pipe(
      entrypointArtifacts,
      Iterable.map((v) =>
        [
          v.shortPath,
          v.artifact.path.replace(/^\.\//, ""),
        ] as const
      ),
      Record.fromEntries,
    ),

    artifacts: pipe(
      output.outputs,
      // This will mess up direct entrypoint-artifact record.
      // Will have to filter out sourcemap when mapping.
      // Iterable.flatMap((v) => v.sourcemap ? [v, v.sourcemap] : [v]),
      Iterable.map((v) => {
        // strip './' prefix
        const shortPath = v.path.replace(/^\.\//, "")

        return [
          shortPath,
          {
            hash: v.hash ?? undefined,
            size: v.size,
            type: v.type,
            imports: imports?.get(v.path),
          },
        ] as const
      }),
      Record.fromEntries,
    ),
  }
}

function buildBun(
  config: BuildOptions,
): Effect.Effect<BuildOutput, Bundle.BundleError, never> {
  return Object.assign(
    Effect.gen(function*() {
      const buildOutput: BuildOutput = yield* Effect.tryPromise({
        try: () => Bun.build(config),
        catch: (err: AggregateError | unknown) => {
          const cause = err instanceof AggregateError
            ? err.errors?.[0] ?? err
            : err

          return new Bundle.BundleError({
            message: "Failed to Bun.build: " + cause,
            cause: cause,
          })
        },
      })

      return buildOutput
    }),
  )
}
