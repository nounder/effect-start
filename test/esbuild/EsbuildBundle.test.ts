import * as test from "bun:test"
import { BunBundle } from "effect-start/bun"
import { EsbuildBundle } from "effect-start/esbuild"
import * as FileSystem from "effect-start/FileSystem"
import { NodeFileSystem } from "effect-start/node"
import * as Effect from "effect/Effect"
import * as NPath from "node:path"

const makeEntrypoint = () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "effect-start-esbuild-" })
    const entrypoint = NPath.join(tmpDir, "client.ts")
    yield* fs.writeFileString(entrypoint, `export const ESBUILD_MARKER = "ok";`)
    return entrypoint
  })

test.it("exports same runtime members as BunBundle", () => {
  test
    .expect(Object.keys(EsbuildBundle).sort())
    .toEqual(Object.keys(BunBundle).sort())
})

test.it("builds and resolves client artifact", () =>
  Effect
    .gen(function*() {
      const entrypoint = yield* makeEntrypoint()
      const bundle = yield* EsbuildBundle.buildClient({ entrypoints: [entrypoint] })
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
        .toContain("ESBUILD_MARKER")

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

test.it("maps nested outputs with duplicate basenames", () =>
  Effect
    .gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "effect-start-esbuild-" })
      const homeDir = NPath.join(tmpDir, "home")
      const speakDir = NPath.join(tmpDir, "speak")
      yield* fs.makeDirectory(homeDir, { recursive: true })
      yield* fs.makeDirectory(speakDir, { recursive: true })

      const homeClient = NPath.join(homeDir, "client.ts")
      const speakClient = NPath.join(speakDir, "client.ts")
      yield* fs.writeFileString(homeClient, `export const HOME_MARKER = "home";`)
      yield* fs.writeFileString(speakClient, `export const SPEAK_MARKER = "speak";`)

      const bundle = yield* EsbuildBundle.buildServer({
        entrypoints: [homeClient, speakClient],
        entryNames: "[dir]/[name]",
      })

      const homeSource = yield* Effect.promise(() => bundle.getArtifact("home/client.ts")!.text())
      const speakSource = yield* Effect.promise(() => bundle.getArtifact("speak/client.ts")!.text())

      test
        .expect(bundle.resolve("home/client.ts"))
        .toBe("home/client.js")
      test
        .expect(bundle.resolve("speak/client.ts"))
        .toBe("speak/client.js")
      test
        .expect(homeSource)
        .toContain("HOME_MARKER")
      test
        .expect(homeSource)
        .not
        .toContain("SPEAK_MARKER")
      test
        .expect(speakSource)
        .toContain("SPEAK_MARKER")
      test
        .expect(speakSource)
        .not
        .toContain("HOME_MARKER")
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    ))
