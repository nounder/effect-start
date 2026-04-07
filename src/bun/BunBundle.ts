import type { BuildConfig, BuildOutput } from "bun"
import { Array, type Context, Effect, Iterable, Layer, pipe, Record } from "effect"
import * as NPath from "node:path"
import * as NUrl from "node:url"
import * as Bundle from "../bundler/Bundle.ts"
import type { BunImportTrackerPlugin } from "./index.ts"

export type BuildOptions = Omit<BuildConfig, "outdir">

const toPath = (ep: string) => (ep.startsWith("file://") ? NUrl.fileURLToPath(ep) : ep)

/**
 * Resolves bare specifiers and file:// URLs to absolute paths,
 * then sorts non-CSS before CSS to work around a Bun bundler bug.
 *
 * Bun v1.3.10: CSS entrypoints before JS produce empty JS stubs.
 * CSS interleaved between JS causes a segfault.
 * @see https://github.com/oven-sh/bun/issues/28947
 */
function resolveEntrypoints(entrypoints: Array<string>): Array<string> {
  const resolved = entrypoints.map((ep) => {
    try {
      return Bun.resolveSync(toPath(ep), process.cwd())
    } catch {
      return toPath(ep)
    }
  })
  resolved.sort((a, b) => {
    const aCss = NPath.extname(a) === ".css" ? 1 : 0
    const bCss = NPath.extname(b) === ".css" ? 1 : 0
    return aCss - bCss
  })
  return resolved
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
  return Effect.gen(function* () {
    const resolvedConfig = {
      ...config,
      entrypoints: resolveEntrypoints(config.entrypoints),
    }
    const output = yield* buildBun(resolvedConfig)
    const manifest = generateManifest(config, output)
    const artifactsMap = Record.fromIterableBy(output.outputs, (v) => v.path.replace(/^\.\//, ""))
    const publicPath = typeof config.publicPath === "string" ? config.publicPath : ""

    const resolveRaw = Bundle.makeResolver(manifest.entrypoints)

    return {
      ...manifest,
      resolve: (path: string) => {
        const resolved = resolveRaw(path)
        return resolved ? publicPath + resolved : undefined
      },
      getArtifact: (path: string) => {
        const resolved = resolveRaw(path)
        return (resolved ? artifactsMap[resolved] : undefined) ?? artifactsMap[path]
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
  return Effect.gen(function* () {
    let current = yield* buildEffect

    const rebuild = () =>
      Effect.gen(function* () {
        current = yield* buildEffect
        return current
      })

    return {
      get entrypoints() {
        return current.entrypoints
      },
      get artifacts() {
        return current.artifacts
      },
      resolve: (url: string) => current.resolve(url),
      getArtifact: (path: string) => current.getArtifact(path),
      rebuild,
    } satisfies Bundle.BundleContext
  })
}

export function layer(config: BuildOptions): Layer.Layer<Bundle.ClientBundle, Bundle.BundleError>
export function layer<T>(
  tag: Context.Tag<T, Bundle.BundleContext>,
  config: BuildOptions,
): Layer.Layer<T, Bundle.BundleError>
export function layer(tagOrConfig: any, maybeConfig?: BuildOptions) {
  if (maybeConfig === undefined) {
    return Layer.effect(Bundle.ClientBundle, mutableContext(buildClient(tagOrConfig)))
  }
  return Layer.effect(tagOrConfig, mutableContext(build(maybeConfig)))
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

/**
 * Maps entrypoints to their respective build artifacts.
 * Entrypoint key is trimmed to remove common path prefix.
 *
 * Bun groups outputs by kind: JS entry-points first, then CSS assets.
 * We partition entrypoints the same way and zip each group separately.
 */
function joinBuildEntrypoints(options: BuildOptions, output: BuildOutput) {
  const baseDir = getBaseDir(options.entrypoints)
  const commonPathPrefix = baseDir ? baseDir + "/" : ""

  const isCss = (ep: string) => ep.endsWith(".css")

  const jsEntrypoints = options.entrypoints.filter((ep) => !isCss(ep))
  const cssEntrypoints = options.entrypoints.filter(isCss)

  const jsOutputs = output.outputs.filter(
    (v) => v.kind === "entry-point" && !(v.loader === "html" && v.path.endsWith(".js")),
  )
  const cssOutputs = output.outputs.filter((v) => v.kind === "asset" && v.loader === "css")

  return pipe(
    [...Iterable.zip(jsEntrypoints, jsOutputs), ...Iterable.zip(cssEntrypoints, cssOutputs)],
    Iterable.map(([entrypoint, artifact]) => ({
      shortPath: entrypoint.replace(commonPathPrefix, ""),
      fullPath: entrypoint,
      artifact,
    })),
  )
}

/**
 * Generate manifest from a build.
 * Useful for SSR and providing source->artifact path mapping.
 */
function generateManifest(
  options: BuildOptions,
  output: BuildOutput,
  imports?: BunImportTrackerPlugin.ImportMap,
): Bundle.BundleManifest {
  const entrypointArtifacts = joinBuildEntrypoints(options, output)

  return {
    entrypoints: pipe(
      entrypointArtifacts,
      Iterable.map((v) => [v.shortPath, v.artifact.path.replace(/^\.\//, "")] as const),
      Record.fromEntries,
    ),

    artifacts: pipe(
      output.outputs,
      Iterable.map((v) => ({
        path: v.path.replace(/^\.\//, ""),
        type: v.type,
        size: v.size,
        hash: v.hash ?? undefined,
        imports: imports?.get(v.path),
      })),
      Array.fromIterable,
    ),
  }
}

function buildBun(config: BuildOptions): Effect.Effect<BuildOutput, Bundle.BundleError> {
  return Effect.tryPromise({
    try: () => Bun.build(config),
    catch: (err: AggregateError | unknown) => {
      const cause = err instanceof AggregateError ? (err.errors?.[0] ?? err) : err
      return new Bundle.BundleError({
        message: "Failed to Bun.build: " + cause,
        cause,
      })
    },
  })
}
