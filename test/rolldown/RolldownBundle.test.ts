import * as test from "bun:test"
import { BunBundle } from "effect-start/bun"
import * as FileSystem from "effect-start/FileSystem"
import { NodeFileSystem } from "effect-start/node"
import { RolldownBundle } from "effect-start/rolldown"
import * as Effect from "effect/Effect"
import * as NPath from "node:path"

const makeEntrypoint = () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "effect-start-rolldown-" })
    const entrypoint = NPath.join(tmpDir, "client.ts")
    yield* fs.writeFileString(entrypoint, `export const ROLLDOWN_MARKER = "ok";`)
    return entrypoint
  })

test.it("exports same runtime members as BunBundle", () => {
  test
    .expect(Object.keys(RolldownBundle).sort())
    .toEqual(Object.keys(BunBundle).sort())
})

test.it("builds and resolves client artifact", () =>
  Effect
    .gen(function*() {
      const entrypoint = yield* makeEntrypoint()
      const bundle = yield* RolldownBundle.buildClient({ entrypoints: [entrypoint] })
      const url = bundle.resolve("client.ts")

      test
        .expect(url)
        .toStartWith("/_bundle/")
      test
        .expect(url)
        .toEndWith(".js")

      const artifact = bundle.getArtifact("client.ts")!

      test
        .expect(artifact)
        .toBeInstanceOf(Blob)

      const source = yield* Effect.promise(() => artifact.text())

      test
        .expect(artifact.type)
        .toContain("javascript")
      test
        .expect(source)
        .toContain("ROLLDOWN_MARKER")

      const emittedPath = url!.slice("/_bundle/".length)

      test
        .expect(bundle.getArtifact(`${emittedPath}.map`)?.type)
        .toContain("json")
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    ))
