import { HttpServerRequest, HttpServerResponse, Path } from "@effect/platform"
import { BunPath } from "@effect/platform-bun"
import type { BuildArtifact, BuildConfig, BuildOutput } from "bun"
import { Array, Console, Context, Effect, Layer, pipe, Ref } from "effect"
import * as path from "node:path"

export default class BunBuild extends Context.Tag("BunBuild")<BunBuild, {
  getArtifact: (path: string) => BuildArtifact
  resolve: (id: string) => string | undefined
}>() {}

export const BunBuildHttpRoute = Effect.gen(function*() {
  const bunBuild = yield* BunBuild
  const req = yield* HttpServerRequest.HttpServerRequest

  console.log({ url: req.url })
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
      const buildOutputRef = yield* Ref.make<BuildOutput | null>(null)

      const buildOutput: BuildOutput = yield* Effect.tryPromise(() =>
        Bun.build(opts)
      )

      yield* Ref.set(buildOutputRef, buildOutput)

      const rootDir = path.dirname(opts.entrypoints[0])

      const entrypointMap: Record<string, BuildArtifact> = pipe(
        opts.entrypoints,
        Array.map((v) => v.replace(rootDir, "")),
        Array.zip(buildOutput.outputs),
        Object.fromEntries,
      )

      const artifactByPath = pipe(
        buildOutput.outputs,
        // remove "./"
        Array.map((v) => [v.path.slice(2), v]),
        Object.fromEntries,
      )

      return {
        resolve(moduleId: string) {
          const relativeInput = Bun.fileURLToPath(moduleId).replace(rootDir, "")
          const artifact = entrypointMap[relativeInput]

          return artifact
            ? path.resolve("/.bundle/", artifact.path)
            : undefined
        },
        getArtifact: (moduleId: string) => {
          console.log(artifactByPath)
          return artifactByPath[moduleId.replace(/^\/.bundle\//, "")]
        },
        get buildOutput() {
          return buildOutput
        },
      }
    }),
  )
