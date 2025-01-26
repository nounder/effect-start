import { HttpServerRequest, HttpServerResponse, Path } from "@effect/platform"
import { BunPath } from "@effect/platform-bun"
import type { BuildArtifact, BuildConfig, BuildOutput } from "bun"
import { Array, Console, Context, Effect, Layer, pipe } from "effect"

export default class BunBuild extends Context.Tag("BunBuild")<BunBuild, {
  getArtifact: (path: string) => BuildArtifact
}>() {}

export const BunBuildHttpRoute = Effect.gen(function*() {
  const bunBuild = yield* BunBuild
  const path = yield* Path.Path
  const req = yield* HttpServerRequest.HttpServerRequest

  const artifact = bunBuild.getArtifact(req.url)

  if (!artifact) {
    return HttpServerResponse.empty({
      status: 404,
    })
  }

  return HttpServerResponse.raw(artifact, {
    headers: {
      "content-type": artifact.type,
      "content-length": artifact.size.toString(),
    },
  })
})

export const make = (opts: BuildConfig) =>
  Layer.scoped(
    BunBuild,
    Effect.gen(function*() {
      const path = yield* Path.Path
      let buildOutput: BuildOutput = yield* Effect.tryPromise(() =>
        Bun.build(opts)
      )

      const rootDir = path.dirname(opts.entrypoints[0])

      const entrypointMap = pipe(
        opts.entrypoints,
        Array.map((v) => v.replace(rootDir, "")),
        Array.zip(buildOutput.outputs),
        Object.fromEntries,
      )

      return {
        getArtifact: (path: string) => {
          return entrypointMap[path]
        },
        get buildOutput() {
          return buildOutput
        },
      }
    }),
  )
    .pipe(Layer.provide(BunPath.layer))
