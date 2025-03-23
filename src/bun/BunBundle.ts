import {
  FileSystem,
  HttpApp,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import type { BuildArtifact, BuildConfig, BuildOutput } from "bun"
import {
  Array,
  Effect,
  pipe,
  Record,
  Ref,
  Stream,
  SubscriptionRef,
} from "effect"
import * as NodeFS from "node:fs"
import * as NodeFSP from "node:fs/promises"
import * as NodePath from "node:path"
import * as process from "node:process"

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

const SOURCE_FILENAME = /.*\.(tsx?|jsx?)$/

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

async function importBlob<M = unknown>(artifact: Blob): Promise<M> {
  const contents = await artifact.arrayBuffer()
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

type BuildOptions = Omit<BuildConfig, "outdir">

type LoadOptions = BuildOptions & {
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

export const load = <M>(
  config: LoadOptions,
): Effect.Effect<M, BundleError, never> =>
  pipe(
    build(config),
    Effect.andThen((buildOutput) =>
      Effect.tryPromise({
        try: () => importBlob<M>(buildOutput.outputs[0]),
        catch: (err) => new BundleError(err),
      })
    ),
  )

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

export const buildRouter = (
  opts: BuildConfig,
): Effect.Effect<HttpRouter.HttpRouter, BundleError, never> =>
  Effect.gen(function*() {
    const buildOutput = yield* build(opts)

    // TODO: resolve common directory across all entrypoints
    const rootDir = NodePath.dirname(opts.entrypoints[0])

    const entrypointMap = pipe(
      opts.entrypoints,
      Array.map((v) => v.replace(rootDir + "/", "")),
      Array.zip(buildOutput.outputs),
      Record.fromEntries,
    )

    const router = Record.reduce(
      entrypointMap,
      HttpRouter.empty,
      (a, v, k) =>
        pipe(
          a,
          HttpRouter.get(
            // paths are in relative format, ie. './file.js'
            `/${v.path.slice(2)}`,
            Effect.sync(() => {
              return HttpServerResponse.raw(v.stream(), {
                headers: {
                  "content-type": v.type,
                  "content-length": v.size.toString(),
                },
              })
            }),
          ),
        ),
    )

    return router
  })
