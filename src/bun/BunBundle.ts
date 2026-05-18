import type { BuildConfig, BuildOutput } from "bun"
import { type Context, Effect, Layer } from "effect"
import * as NPath from "node:path"
import * as NUrl from "node:url"
import * as Bundle from "../bundler/Bundle.ts"

export type BuildOptions = Omit<BuildConfig, "outdir">

const toPath = (
  ep: string,
) => (ep.startsWith("file://") ? NUrl.fileURLToPath(ep) : ep)

const toOutputPath = (path: string) => path.startsWith("./") ? path.slice(2) : path

const normalizeEntrypointPath = (path: string): string => NPath.resolve(toPath(path))

type EntrypointPair = {
  original: string
  resolved: string
  id: string
}

/**
 * Resolves bare specifiers and file:// URLs to absolute paths.
 *
 * Bun v1.3.10 segfaults when CSS entrypoints are interleaved with JS
 * entrypoints, so CSS is grouped after non-CSS entrypoints.
 * @see https://github.com/oven-sh/bun/issues/28947
 */
function resolveEntrypointsPaired(
  entrypoints: Array<string>,
): Array<EntrypointPair> {
  const paired = entrypoints.map((original) => {
    let resolved: string
    try {
      resolved = Bun.resolveSync(toPath(original), process.cwd())
    } catch {
      resolved = toPath(original)
    }
    return { original, resolved, id: normalizeEntrypointPath(resolved) }
  })
  paired.sort((a, b) => {
    const aCss = NPath.extname(a.resolved) === ".css" ? 1 : 0
    const bCss = NPath.extname(b.resolved) === ".css" ? 1 : 0
    return aCss - bCss
  })
  return paired
}

export const buildClient = (config: BuildOptions | string) => {
  if (typeof config === "string") {
    config = { entrypoints: [config] }
  }

  return build({
    sourcemap: "linked",
    naming: {
      entry: "[name]-[hash].[ext]",
      chunk: "[name]-[hash].[ext]",
      asset: "[name]-[hash].[ext]",
    },
    packages: "bundle",
    publicPath: "/_bundle/",
    target: "browser" as const,
    ...config,
  })
}

export const buildServer = (config: BuildOptions | string) => {
  if (typeof config === "string") {
    config = { entrypoints: [config] }
  }

  return build({
    sourcemap: "linked",
    naming: {
      entry: "[dir]/[name]-[hash].[ext]",
      chunk: "[name]-[hash].[ext]",
      asset: "[name]-[hash].[ext]",
    },
    packages: "bundle",
    target: "bun" as const,
    ...config,
  })
}

/**
 * Builds a bundle and returns a fresh BundleContext each time the effect runs.
 */
export function build(
  config: BuildOptions,
): Effect.Effect<Bundle.BundleContext, Bundle.BundleError> {
  return Effect.gen(function*() {
    const paired = resolveEntrypointsPaired(config.entrypoints)
    const resolvedConfig = {
      ...config,
      entrypoints: paired.map((p) => p.resolved),
      metafile: true as const,
    }
    const output = yield* buildBun(resolvedConfig)
    const entrypoints = yield* makeEntrypoints(paired, output)
    const artifactsMap = Object.fromEntries(
      output.outputs.map((artifact) => [
        toOutputPath(artifact.path),
        artifact,
      ]),
    )
    const publicPath = typeof config.publicPath === "string"
      ? config.publicPath
      : ""

    const resolveRaw = Bundle.makeResolver(entrypoints)

    return {
      resolve: (path: string, parent?: string) => {
        const resolved = resolveRaw(path, parent)
        return resolved ? publicPath + resolved : undefined
      },
      getArtifact: (path: string) => {
        const resolved = resolveRaw(path)
        return (resolved ? artifactsMap[resolved] : undefined) ??
          artifactsMap[path]
      },
    }
  })
}

/**
 * Wraps a build effect in a mutable BundleContext.
 * The initial build runs immediately. Subsequent calls to `rebuild()`
 * re-execute the build and swap the inner state so that `resolve` and
 * `getArtifact` always reflect the latest build.
 */
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
    return Layer.effect(
      Bundle.Bundle,
      mutableContext(buildClient(tagOrConfig)),
    )
  }
  return Layer.effect(tagOrConfig, mutableContext(build(maybeConfig)))
}

type BuildArtifact = BuildOutput["outputs"][number]

const isEntrypointArtifact = (v: BuildArtifact): boolean =>
  (v.kind === "entry-point" &&
    !(v.loader === "html" && v.path.endsWith(".js"))) ||
  (v.kind === "asset" && v.loader === "css")

/**
 * Match emitted artifacts to entrypoints using Bun's metafile.
 * `metafile.outputs[artifact].entryPoint` is the only Bun-provided
 * back-reference from output artifact to source entrypoint.
 */
function makeEntrypoints(
  paired: Array<EntrypointPair>,
  output: BuildOutput,
): Effect.Effect<Record<string, string>, Bundle.BundleError> {
  return Effect.gen(function*() {
    if (!output.metafile) {
      return yield* Effect.fail(
        new Bundle.BundleError({
          message: "Bun.build did not return a metafile",
        }),
      )
    }

    const entrypointIds = new Set(paired.map((p) => p.id))
    const artifactsByPath = new Map(
      output.outputs.map((artifact) => [
        toOutputPath(artifact.path),
        artifact,
      ]),
    )
    const artifactPathByEntrypoint = new Map<string, string>()

    for (
      const [outputPath, metadata] of Object.entries(
        output.metafile.outputs,
      )
    ) {
      if (!metadata.entryPoint) continue

      const artifactPath = toOutputPath(outputPath)
      const artifact = artifactsByPath.get(artifactPath)
      if (!artifact || !isEntrypointArtifact(artifact)) continue

      const id = normalizeEntrypointPath(metadata.entryPoint)
      if (!entrypointIds.has(id)) continue

      const existing = artifactPathByEntrypoint.get(id)
      if (existing) {
        return yield* Effect.fail(
          new Bundle.BundleError({
            message: `Entrypoint ${metadata.entryPoint} matched multiple artifacts: ${
              [existing, artifactPath].join(", ")
            }`,
          }),
        )
      }
      artifactPathByEntrypoint.set(id, artifactPath)
    }

    const missing = paired.filter((entrypoint) => !artifactPathByEntrypoint.has(entrypoint.id))
    if (missing.length > 0) {
      return yield* Effect.fail(
        new Bundle.BundleError({
          message: `No artifact emitted for ${missing.length} entrypoint(s): ${
            missing.map((p) => p.original).join(", ")
          }`,
        }),
      )
    }

    const baseDir = getBaseDir(paired.map((p) => p.id))
    return Object.fromEntries(
      paired.map((p) => [
        entrypointKey(p.original, p.id, baseDir),
        artifactPathByEntrypoint.get(p.id)!,
      ]),
    )
  })
}

/**
 * Derive the resolver key for an entrypoint.
 *
 * Non-absolute inputs stay intact so `bundle.resolve(original)` works.
 * Absolute paths and file URLs are stripped against the common base directory.
 */
const entrypointKey = (
  original: string,
  resolved: string,
  baseDir: string,
): string => {
  const originalPath = toPath(original)
  if (!NPath.isAbsolute(originalPath)) return originalPath
  const prefix = baseDir ? baseDir + "/" : ""
  return resolved.startsWith(prefix) ? resolved.slice(prefix.length) : resolved
}

/**
 * Finds common path prefix across provided paths.
 */
function getBaseDir(paths: Array<string>) {
  if (paths.length === 0) return ""
  if (paths.length === 1) return NPath.dirname(paths[0])

  const segmentsList = paths.map((path) => NPath.dirname(path).split("/").filter(Boolean))

  return (
    segmentsList[0]
      .filter((segment, i) => segmentsList.every((segs) => segs[i] === segment))
      .reduce((path, seg) => `${path}/${seg}`, "") ?? ""
  )
}

function buildBun(
  config: BuildOptions,
): Effect.Effect<BuildOutput, Bundle.BundleError> {
  return Effect.tryPromise({
    try: () => Bun.build(config),
    catch: (err: AggregateError | unknown) => {
      const cause = err instanceof AggregateError
        ? (err.errors?.[0] ?? err)
        : err
      return new Bundle.BundleError({
        message: "Failed to Bun.build: " + cause,
        cause,
      })
    },
  })
}
