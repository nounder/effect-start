import type * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as esbuild from "esbuild"
import * as NPath from "node:path"
import * as Bundle from "../bundler/Bundle.ts"
import * as BundleHelpers from "../bundler/internal/BundleHelpers.ts"

export type BuildOptions = Omit<esbuild.BuildOptions, "entryPoints" | "metafile" | "outfile" | "outdir" | "write"> & {
  entrypoints: Array<string>
  publicPath?: string
}

export const buildClient = (config: BuildOptions | string) => {
  if (typeof config === "string") {
    config = { entrypoints: [config] }
  }

  return build({
    bundle: true,
    format: "esm",
    platform: "browser",
    sourcemap: "linked",
    entryNames: "[name]-[hash]",
    chunkNames: "[name]-[hash]",
    assetNames: "[name]-[hash]",
    publicPath: "/_bundle/",
    ...config,
  })
}

export const buildServer = (config: BuildOptions | string) => {
  if (typeof config === "string") {
    config = { entrypoints: [config] }
  }

  return build({
    bundle: true,
    format: "esm",
    platform: "node",
    sourcemap: "linked",
    entryNames: "[dir]/[name]-[hash]",
    chunkNames: "[name]-[hash]",
    assetNames: "[name]-[hash]",
    ...config,
  })
}

export function build(
  config: BuildOptions,
): Effect.Effect<Bundle.BundleContext, Bundle.BundleError> {
  return Effect.gen(function*() {
    const { entrypoints: entrypointConfig, ...buildConfig } = config
    const paired = BundleHelpers.resolveEntrypointsPaired(entrypointConfig)
    const output = yield* buildEsbuild({
      ...buildConfig,
      entryPoints: paired.map((p) => p.resolved),
      metafile: true,
      outdir: "/",
      write: false,
    })
    if (!output.metafile || !output.outputFiles) {
      return yield* Effect.fail(
        new Bundle.BundleError({
          message: "esbuild did not return output files and metafile",
        }),
      )
    }

    const entrypoints = yield* makeEntrypoints(paired, output.metafile, output.outputFiles)
    const artifactsMap = Object.fromEntries(
      output.outputFiles.map((file) => [
        BundleHelpers.toOutputPath(file.path),
        new Blob([Uint8Array.from(file.contents).buffer], { type: BundleHelpers.artifactContentType(file.path) }),
      ]),
    )
    const publicPath = typeof config.publicPath === "string" ? config.publicPath : ""
    const resolveRaw = Bundle.makeResolver(entrypoints)

    return {
      resolve: (path: string, parent?: string) => {
        const resolved = resolveRaw(path, parent)
        return resolved ? publicPath + resolved : undefined
      },
      getArtifact: (path: string) => {
        const resolved = resolveRaw(path)
        return (resolved ? artifactsMap[resolved] : undefined) ?? artifactsMap[path]
      },
    }
  })
}

function mutableContext(
  buildEffect: Effect.Effect<Bundle.BundleContext, Bundle.BundleError>,
): Effect.Effect<Bundle.BundleContext, Bundle.BundleError> {
  return Effect.gen(function*() {
    let current = yield* buildEffect
    const rebuild = () =>
      Effect.gen(function*() {
        current = yield* buildEffect
        return current
      })

    return {
      resolve: (url: string, parent?: string) => current.resolve(url, parent),
      getArtifact: (path: string) => current.getArtifact(path),
      rebuild,
    } satisfies Bundle.BundleContext
  })
}

export function layer(
  config: BuildOptions,
): Layer.Layer<Bundle.Bundle, Bundle.BundleError>
export function layer<T>(
  tag: Context.Tag<T, Bundle.BundleContext>,
  config: BuildOptions,
): Layer.Layer<T, Bundle.BundleError>
export function layer(tagOrConfig: any, maybeConfig?: BuildOptions) {
  if (maybeConfig === undefined) {
    return Layer.effect(Bundle.Bundle, mutableContext(buildClient(tagOrConfig)))
  }
  return Layer.effect(tagOrConfig, mutableContext(build(maybeConfig)))
}

function makeEntrypoints(
  paired: Array<BundleHelpers.EntrypointPair>,
  metafile: esbuild.Metafile,
  outputFiles: Array<esbuild.OutputFile>,
): Effect.Effect<Record<string, string>, Bundle.BundleError> {
  return Effect.gen(function*() {
    const entrypointIds = new Set(paired.map((p) => p.id))
    const artifactPaths = new Set(outputFiles.map((file) => BundleHelpers.toOutputPath(file.path)))
    const artifactPathByBasename = new Map<string, string | undefined>()
    for (const artifactPath of artifactPaths) {
      const basename = NPath.basename(artifactPath)
      artifactPathByBasename.set(
        basename,
        artifactPathByBasename.has(basename) ? undefined : artifactPath,
      )
    }
    const artifactPathByEntrypoint = new Map<string, string>()
    for (const [outputPath, metadata] of Object.entries(metafile.outputs)) {
      if (!metadata.entryPoint) continue
      const artifactPath = resolveMetafileOutputPath(
        outputPath,
        artifactPaths,
        artifactPathByBasename,
      )
      yield* BundleHelpers.recordEntrypointArtifact(
        artifactPathByEntrypoint,
        entrypointIds,
        metadata.entryPoint,
        artifactPath,
      )
    }
    return yield* BundleHelpers.finishEntrypointMap(paired, artifactPathByEntrypoint)
  })
}

function resolveMetafileOutputPath(
  outputPath: string,
  artifactPaths: Set<string>,
  artifactPathByBasename: Map<string, string | undefined>,
) {
  const direct = BundleHelpers.toOutputPath(outputPath)
  if (artifactPaths.has(direct)) return direct

  const absolute = BundleHelpers.toOutputPath(NPath.resolve(outputPath))
  if (artifactPaths.has(absolute)) return absolute

  return artifactPathByBasename.get(NPath.basename(outputPath)) ?? absolute
}

function buildEsbuild(
  config: esbuild.BuildOptions,
): Effect.Effect<esbuild.BuildResult, Bundle.BundleError> {
  return Effect.tryPromise({
    try: () => esbuild.build(config),
    catch: (cause) =>
      new Bundle.BundleError({
        message: "Failed to esbuild: " + cause,
        cause,
      }),
  })
}
