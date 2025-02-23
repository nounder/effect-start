import { HttpApp, HttpServerRequest } from "@effect/platform"
import type { BuildArtifact, BuildConfig, BuildOutput } from "bun"
import { Console, Effect, pipe, Ref, Stream, SubscriptionRef } from "effect"
import * as NodeFS from "node:fs/promises"
import * as NodePath from "node:path"
import * as process from "node:process"
import * as NodeUrl from "node:url"

class BundleError extends Error {
  readonly _tag = "BundleError"
}

const SOURCE_FILENAME = /.*\.(tsx?|jsx?)$/

async function importBlob<M = unknown>(
  artifact: Blob,
): Promise<M> {
  const contents = await artifact.arrayBuffer()
  const hash = Bun.hash(contents)
  const path = process.cwd() + "/effect-bundle-" + hash.toString(16) + ".js"
  const file = Bun.file(path)
  await file.write(contents)

  const bundleModule = await import(path)

  await file.delete()

  return bundleModule
}

type BuildOptions = Omit<
  BuildConfig,
  "outdir"
>

type LoadOptions =
  & BuildOptions
  // only one entrypoint is allowed for loading
  & {
    entrypoints: [string]
  }

export const build = (
  conig: BuildOptions,
) =>
  Effect.gen(function*() {
    const buildOutput: BuildOutput = yield* Effect.tryPromise({
      try: () => Bun.build(conig),
      catch: (err) => new BundleError(String(err)),
    })

    return buildOutput
  })

export const load = <M>(
  config: LoadOptions,
): Effect.Effect<M, BundleError, never> =>
  pipe(
    build(config),
    Effect.andThen(buildOutput =>
      Effect.tryPromise({
        try: () => importBlob<M>(buildOutput.outputs[0]),
        catch: (err) => new BundleError(String(err)),
      })
    ),
  )

export const loadWatch = <M>(
  config: LoadOptions,
) =>
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
        e => e,
      ),
      Stream.filter(event => SOURCE_FILENAME.test(event.filename!)),
      Stream.tap(Console.log),
      Stream.throttle({
        units: 1,
        cost: () => 1,
        duration: "100 millis",
        strategy: "enforce",
      }),
    )

    yield* Effect.fork(pipe(
      changes,
      Stream.runForEach(() =>
        _load.pipe(Effect.flatMap(app => Ref.update(ref, () => app)))
      ),
    ))

    return {
      ref,
      changes,
    }
  })
