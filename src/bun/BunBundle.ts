import type { BuildConfig, BuildOutput } from "bun"
import { Effect, pipe, Ref, Stream, SubscriptionRef } from "effect"
import * as NodeFS from "node:fs/promises"
import * as NodePath from "node:path"
import * as process from "node:process"

class BundleError extends Error {
  readonly _tag = "BundleError"

  constructor(readonly cause: any) {
    const message = cause["message"] ?? String(cause)

    super(message)
  }
}

const SOURCE_FILENAME = /.*\.(tsx?|jsx?)$/

async function importBlob<M = unknown>(artifact: Blob): Promise<M> {
  const contents = await artifact.arrayBuffer()
  const hash = Bun.hash(contents)
  const path = process.cwd() + "/effect-bundle-" + hash.toString(16) + ".js"
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

export const build = (conig: BuildOptions) =>
  Effect.gen(function*() {
    const buildOutput: BuildOutput = yield* Effect.tryPromise({
      try: () => Bun.build(conig),
      catch: (err) => {
        return new BundleError(err)
      },
    })

    return buildOutput
  })

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
        NodeFS.watch(baseDir, { recursive: true }),
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
