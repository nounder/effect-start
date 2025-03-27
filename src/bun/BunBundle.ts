import {
  Headers,
  HttpApp,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import { type BuildConfig, type BuildOutput, fileURLToPath } from "bun"
import {
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
} from "effect"
import * as NFSP from "node:fs/promises"
import * as NPath from "node:path"
import * as process from "node:process"
import type { BundleContext, BundleManifest } from "../Bundle.ts"
import { importJsBlob } from "../esm.ts"

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

// TODO: parametrize source filename pattern
const SOURCE_FILENAME = /\.(tsx?|jsx?)$/

type BuildOptions = Omit<BuildConfig, "outdir">

export const effect = (
  config: BuildConfig,
): Effect.Effect<BundleContext, any> =>
  Effect.gen(function*() {
    const output = yield* build(config)
    const manifest = generateManifestfromBunBundle(config, output)
    const entrypointArtifacts = mapBuildEntrypoints(config, output)

    return {
      ...manifest,
      resolve: (url: string) => {
        return url
      },
      getBlob: (path): Blob | null => {
        return entrypointArtifacts[path] ?? null
      },
    }
  })

export const layer = <T>(
  tag: Context.Tag<T, BundleContext>,
  config: BuildConfig,
) => {
  return Layer.effect(
    tag,
    effect(config),
  )
}

type BrandedConfig<T> = BuildConfig

export const config = <M = unknown>(
  config: BrandedConfig<M>,
): BrandedConfig<M> => {
  return config as BrandedConfig<M>
}

export const build = (
  config: BuildOptions,
): Effect.Effect<BuildOutput, BunBundleError, never> & {
  config: BuildOptions
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
  config: BuildConfig,
): Effect.Effect<M, BunBundleError, never> & { config: BuildConfig } =>
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

/**
 * Same as `load` but ensures that most recent module is always returned.
 * Useful for development.
 */
export const loadWatch = <M>(
  config: BuildConfig,
): Effect.Effect<M, BunBundleError, never> & { config: BuildConfig } =>
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
 * Builds a static HttpRouter from a build.
 * Useful for serving artifacts from client bundle.
 */
export const buildRouter = (
  config: BuildConfig,
): Effect.Effect<HttpRouter.HttpRouter, BunBundleError, never> =>
  Effect.gen(function*() {
    const buildOutput = yield* build(config)
    const mapping = mapBuildEntrypoints(config, buildOutput)
    const manifest = generateManifestfromBunBundle(config, buildOutput)

    const router = pipe(
      Record.reduce(
        mapping,
        HttpRouter.empty,
        (a, v, k) =>
          pipe(
            a,
            HttpRouter.get(
              // paths are in relative format, ie. './file.js'
              `/${v.path.slice(2)}`,
              // Cannot use HttpServerResponse.raw because of a bug. [2025-03-24]
              // PR: https://github.com/Effect-TS/effect/pull/4642
              pipe(
                Effect.promise(() => v.arrayBuffer()),
                Effect.andThen(bytes => {
                  return HttpServerResponse.uint8Array(
                    new Uint8Array(bytes),
                    {
                      status: 200,
                      contentType: v.type,
                    },
                  )
                }),
              ),
            ),
          ),
      ),
      HttpRouter.get(
        "/manifest.json",
        HttpServerResponse.unsafeJson(manifest),
      ),
    )

    return router
  })

class SsrError extends Data.TaggedError("SsrError")<{
  message: string
  cause: unknown
}> {}

export const ssr = (options: {
  render: (
    request: Request,
    resolve: (url: string) => string,
  ) => Promise<Response>
  config: BuildConfig
  publicBase?: string
}): HttpApp.Default<SsrError | RouteNotFound> => {
  const { render, config, publicBase } = options

  const resolve = (url: string): string => {
    const path = url.startsWith("file://")
      ? fileURLToPath(url)
      : url
    const sourceBase = process.cwd()
    const publicBase = "/.bundle"
    // TODO: use real artifacts
    const artifacts = {
      "client.tsx": "client.js",
    }
    const sourcePath = NPath.relative(sourceBase, path)
    const publicPath = artifacts[sourcePath]

    return NPath.join(publicBase, publicPath || path)
  }

  return Effect.gen(function*() {
    const req = yield* HttpServerRequest.HttpServerRequest
    const fetchReq = req.source as Request
    const output = yield* Effect.tryPromise({
      try: () =>
        render(
          fetchReq,
          resolve,
        ),
      catch: (e) =>
        new SsrError({
          message: "Failed to render server-side",
          cause: e,
        }),
    })

    return yield* HttpServerResponse.raw(output.body, {
      status: output.status,
      statusText: output.statusText,
      headers: Headers.fromInput(output.headers as any),
    })
  })
}

/**
 * Finds common path prefix across provided paths.
 */
function getBaseDir(paths: string[]) {
  const segmentsList = paths.map(path => path.split("/").filter(Boolean))

  return segmentsList[0]
    .filter((segment, i) => segmentsList.every(segs => segs[i] === segment))
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
    options.entrypoints.map(v => NPath.dirname(v)),
  ) + "/"

  return pipe(
    Iterable.zip(options.entrypoints, output.outputs),
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

    artifacts: Record.mapEntries(entrypointArtifacts, (v, k) => [
      k,
      {
        // strip './' prefix
        path: v.path.slice(2),
        hash: v.hash,
        kind: v.kind,
        size: v.size,
        type: v.type,
      },
    ]),
  }
}
