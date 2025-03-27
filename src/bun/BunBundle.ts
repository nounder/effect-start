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
  Array,
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
import * as NFS from "node:fs"
import * as NFSP from "node:fs/promises"
import * as NPath from "node:path"
import * as process from "node:process"
import type { BundleContext } from "../Bundle.ts"

type BunBundleManifest = {
  artifacts: Record<string, {
    path: string
    hash: string | null
    size: number
    type: string
    imports?: any[]
  }>
}

class BundleError extends Error {
  readonly _tag = "BundleError"

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

type LoadOptions =
  & BuildOptions
  & {
    // only one entrypoint is allowed for loading
    entrypoints: [string]
  }

export const effect = (
  config: BuildConfig,
): Effect.Effect<BundleContext, any> =>
  Effect.gen(function*() {
    const output = yield* build(config)
    const mapping = mapBuildEntrypoints(config, output)

    return {
      entrypoints: Record.mapEntries(mapping, (v, k) => [
        k,
        // strip ./ prefix
        v.path.slice(2),
      ]),
      artifacts: Array.map(output.outputs, (v) => ({
        // strip './' prefix
        path: v.path.slice(2),
        hash: v.hash,
        kind: v.kind,
        size: v.size,
        type: v.type,
      })),
      resolve: (url: string) => {
        return url
      },
      blob: (path): Blob | null => {
        return mapping[path] ?? null
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
): Effect.Effect<BuildOutput, BundleError, never> & {
  config: BuildOptions
} =>
  Object.assign(
    Effect.gen(function*() {
      const buildOutput: BuildOutput = yield* Effect.tryPromise({
        try: () => Bun.build(config),
        catch: (err) => {
          return new BundleError(err)
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
): Effect.Effect<M, BundleError, never> & { config: BuildConfig } =>
  Object.assign(
    pipe(
      build(config),
      Effect.andThen((buildOutput) =>
        Effect.tryPromise({
          try: () => importJsBlob<M>(buildOutput.outputs[0]),
          catch: (err) => new BundleError(err),
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
): Effect.Effect<M, BundleError, never> & { config: BuildConfig } =>
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
  opts: BuildConfig,
): Effect.Effect<HttpRouter.HttpRouter, BundleError, never> =>
  Effect.gen(function*() {
    const buildOutput = yield* build(opts)
    const mapping = mapBuildEntrypoints(opts, buildOutput)
    const manifest = generateManifest(opts, buildOutput)

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

function findNodeModules(startDir = process.cwd()) {
  let currentDir = NPath.resolve(startDir)

  while (currentDir !== NPath.parse(currentDir).root) {
    const nodeModulesPath = NPath.join(currentDir, "node_modules")
    if (
      NFS.statSync(nodeModulesPath).isDirectory()
    ) {
      return nodeModulesPath
    }

    currentDir = NPath.dirname(currentDir)
  }

  return null
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
function generateManifest(
  options: BuildOptions,
  output: BuildOutput,
): BunBundleManifest {
  const mapping = mapBuildEntrypoints(options, output)

  return {
    artifacts: Record.mapEntries(mapping, (v, k) => [
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

/**
 * Imports a blob as a module.
 * Useful for loading code from build artifacts.
 */
async function importJsBlob<M = unknown>(blob: Blob): Promise<M> {
  const contents = await blob.arrayBuffer()
  const hash = Bun.hash(contents)
  const basePath = findNodeModules() + "/.tmp"
  const path = basePath + "/effect-bundler-"
    + hash.toString(16) + ".js"

  const file = Bun.file(path)
  await file.write(contents)

  const bundleModule = await import(path)

  await file.delete()
    // if called concurrently, file sometimes may be deleted
    // safe ignore when this happens
    .catch(() => {})

  return bundleModule
}
