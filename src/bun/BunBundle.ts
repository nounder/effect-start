import {
  FileSystem,
  HttpApp,
  HttpBody,
  HttpClientResponse,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { HttpBodyError } from "@effect/platform/HttpBody"
import type { BuildArtifact, BuildConfig, BuildOutput } from "bun"
import {
  Array,
  Console,
  Effect,
  Iterable,
  pipe,
  Record,
  Ref,
  Stream,
  SubscriptionRef,
} from "effect"
import { chunksOf } from "effect/Iterable"
import * as NodeFS from "node:fs"
import * as NodeFSP from "node:fs/promises"
import * as NodePath from "node:path"
import * as process from "node:process"

type BunBundleManifest = {
  artifacts: Record<string, {
    path: string
    hash: string | null
    size: number
    type: string
    imports?: any[]
  }>
}

type BunBundleContext =
  & BunBundleManifest
  & {
    resolve: (url: string) => string
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
  config: LoadOptions,
): Effect.Effect<M, BundleError, never> =>
  pipe(
    build(config),
    Effect.andThen((buildOutput) =>
      Effect.tryPromise({
        try: () => importJsBlob<M>(buildOutput.outputs[0]),
        catch: (err) => new BundleError(err),
      })
    ),
  )

/**
 * Same as `load` but ensures that most recent module is always returned.
 * Useful for development.
 */
export const loadWatch = <M>(config: LoadOptions) =>
  Effect.gen(function*() {
    const [entrypoint] = config.entrypoints
    const _load = load<M>(config)
    const ref = yield* SubscriptionRef.make<M>(yield* _load)

    // get dirname after the build as user may pass URL rather than
    // path which Bun does not resolve.
    const baseDir = NodePath.dirname(
      NodePath.resolve(process.cwd(), entrypoint),
    )

    const changes = pipe(
      Stream.fromAsyncIterable(
        NodeFSP.watch(baseDir, { recursive: true }),
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

    return {
      ref,
      changes,
    }
  })

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

function findNodeModules(startDir = process.cwd()) {
  let currentDir = NodePath.resolve(startDir)

  while (currentDir !== NodePath.parse(currentDir).root) {
    const nodeModulesPath = NodePath.join(currentDir, "node_modules")
    if (
      NodeFS.statSync(nodeModulesPath).isDirectory()
    ) {
      return nodeModulesPath
    }

    currentDir = NodePath.dirname(currentDir)
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
    options.entrypoints.map(v => NodePath.dirname(v)),
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

  return bundleModule
}
