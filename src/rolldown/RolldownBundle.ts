import type * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as rolldown from "rolldown"
import * as Bundle from "../bundler/Bundle.ts"
import * as BundleHelpers from "../bundler/internal/BundleHelpers.ts"

type OutputItem = rolldown.OutputChunk | rolldown.OutputAsset

export type BuildOptions = Omit<rolldown.BuildOptions, "input" | "output" | "write"> & {
  entrypoints: Array<string>
  output?: Omit<NonNullable<rolldown.BuildOptions["output"]>, "dir">
  publicPath?: string
}

export const buildClient = (config: BuildOptions | string) => {
  if (typeof config === "string") {
    config = { entrypoints: [config] }
  }

  return build({
    platform: "browser",
    output: {
      format: "esm",
      sourcemap: true,
      entryFileNames: "[name]-[hash].js",
      chunkFileNames: "[name]-[hash].js",
      assetFileNames: "[name]-[hash][extname]",
    },
    publicPath: "/_bundle/",
    ...config,
  })
}

export const buildServer = (config: BuildOptions | string) => {
  if (typeof config === "string") {
    config = { entrypoints: [config] }
  }

  return build({
    platform: "node",
    output: {
      format: "esm",
      sourcemap: true,
      entryFileNames: "[name]-[hash].js",
      chunkFileNames: "[name]-[hash].js",
      assetFileNames: "[name]-[hash][extname]",
    },
    ...config,
  })
}

export function build(
  config: BuildOptions,
): Effect.Effect<Bundle.BundleContext, Bundle.BundleError> {
  return Effect.gen(function*() {
    const {
      entrypoints: entrypointConfig,
      output: outputConfig,
      publicPath: publicPathConfig,
      ...buildConfig
    } = config
    const paired = BundleHelpers.resolveEntrypointsPaired(entrypointConfig)
    const output = yield* buildRolldown({
      ...buildConfig,
      input: paired.map((p) => p.resolved),
      output: {
        ...outputConfig,
        dir: "/",
      },
      write: false,
    })
    const entrypoints = yield* makeEntrypoints(paired, output)
    const artifactsMap = Object.fromEntries(
      output.output.map((item) => [
        BundleHelpers.toOutputPath(item.fileName),
        new Blob([blobPart(item)], { type: BundleHelpers.artifactContentType(item.fileName) }),
      ]),
    )
    const publicPath = typeof publicPathConfig === "string" ? publicPathConfig : ""
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

function makeEntrypointSource(item: OutputItem): string | undefined {
  return item.type === "chunk" && item.isEntry ? item.facadeModuleId ?? undefined : undefined
}

function makeEntrypoints(
  paired: Array<BundleHelpers.EntrypointPair>,
  output: rolldown.RolldownOutput,
): Effect.Effect<Record<string, string>, Bundle.BundleError> {
  return Effect.gen(function*() {
    const entrypointIds = new Set(paired.map((p) => p.id))
    const artifactPathByEntrypoint = new Map<string, string>()
    for (const item of output.output) {
      const source = makeEntrypointSource(item)
      if (!source) continue
      yield* BundleHelpers.recordEntrypointArtifact(
        artifactPathByEntrypoint,
        entrypointIds,
        source,
        BundleHelpers.toOutputPath(item.fileName),
      )
    }
    return yield* BundleHelpers.finishEntrypointMap(paired, artifactPathByEntrypoint)
  })
}

function blobPart(item: OutputItem): BlobPart {
  const source = item.type === "chunk" ? item.code : item.source
  return typeof source === "string" ? source : Uint8Array.from(source).buffer
}

function buildRolldown(
  config: rolldown.BuildOptions & { write: false },
): Effect.Effect<rolldown.RolldownOutput, Bundle.BundleError> {
  return Effect.tryPromise({
    try: () => rolldown.build(config),
    catch: (cause) =>
      new Bundle.BundleError({
        message: "Failed to rolldown: " + cause,
        cause,
      }),
  })
}
