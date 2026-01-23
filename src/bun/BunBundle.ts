import type {
  BuildConfig,
  BuildOutput,
} from "bun"
import {
  Array,
  Context,
  Effect,
  Iterable,
  Layer,
  pipe,
  Record,
} from "effect"
import * as NPath from "node:path"
import type {
  BundleContext,
  BundleManifest,
} from "../bundler/Bundle.ts"
import * as Bundle from "../bundler/Bundle.ts"
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
    publicPath: "/_bundle/",
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

/**
 * Finds common path prefix across provided paths.
 */
function getBaseDir(paths: string[]) {
  if (paths.length === 0) return ""
  if (paths.length === 1) return NPath.dirname(paths[0])

  const segmentsList = paths.map((path) =>
    NPath.dirname(path).split("/").filter(Boolean)
  )

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
  const commonPathPrefix = getBaseDir(options.entrypoints) + "/"

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
      Iterable.map((v) => {
        // strip './' prefix
        const shortPath = v.path.replace(/^\.\//, "")

        return {
          path: shortPath,
          type: v.type,
          size: v.size,
          hash: v.hash ?? undefined,
          imports: imports?.get(v.path),
        }
      }),
      Array.fromIterable,
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
