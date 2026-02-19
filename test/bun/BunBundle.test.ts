import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as NPath from "node:path"
import * as FileSystem from "effect-start/FileSystem"
import * as NodeFileSystem from "../../src/node/NodeFileSystem.ts"
import { BunBundle } from "effect-start/bun"

const layer = NodeFileSystem.layer

test.describe("BunBundle manifest structure", () => {
  test.it("should generate manifest with inputs and outputs arrays", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const tmpDir = yield* fs.makeTempDirectoryScoped()

      const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <div id="app"></div>
  <script src="./index.ts" type="module"></script>
</body>
</html>`

      const jsContent = `console.log("Hello from test bundle");
export const greeting = "Hello World";`

      const htmlPath = NPath.join(tmpDir, "index.html")
      const jsPath = NPath.join(tmpDir, "index.ts")

      yield* fs.writeFileString(htmlPath, htmlContent)
      yield* fs.writeFileString(jsPath, jsContent)

      const bundle = yield* BunBundle.buildClient({
        entrypoints: [htmlPath],
      })

      test.expect(bundle.entrypoints).toBeObject()
      test.expect(bundle.artifacts).toBeArray()
      test.expect(Object.keys(bundle.entrypoints).length).toBe(1)
      test.expect(bundle.artifacts.length).toBe(3)

      const entrypointKeys = Object.keys(bundle.entrypoints)
      const firstEntrypoint = entrypointKeys[0]

      test.expect(firstEntrypoint).toBeString()
      test.expect(bundle.entrypoints[firstEntrypoint]).toBeString()

      const firstArtifact = bundle.artifacts[0]

      test.expect(firstArtifact).toHaveProperty("path")
      test.expect(firstArtifact).toHaveProperty("type")
      test.expect(firstArtifact).toHaveProperty("size")
      test.expect(firstArtifact.size).toBeGreaterThan(0)
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise),
  )

  test.it("should resolve entrypoints to artifacts correctly", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const tmpDir = yield* fs.makeTempDirectoryScoped()

      const htmlContent = `<!DOCTYPE html>
<html><body>Test</body></html>`

      const htmlPath = NPath.join(tmpDir, "test.html")

      yield* fs.writeFileString(htmlPath, htmlContent)

      const bundle = yield* BunBundle.buildClient({
        entrypoints: [htmlPath],
      })

      const entrypointKeys = Object.keys(bundle.entrypoints)
      const firstEntrypoint = entrypointKeys[0]
      const expectedOutput = bundle.entrypoints[firstEntrypoint]
      const resolvedOutput = bundle.resolve(firstEntrypoint)

      test.expect(resolvedOutput).toBe(expectedOutput)

      const artifact = bundle.getArtifact(resolvedOutput!)

      test.expect(artifact).not.toBeNull()
      test.expect(artifact).toBeTruthy()
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise),
  )

  test.it("should include all artifact metadata", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const tmpDir = yield* fs.makeTempDirectoryScoped()

      const jsContent = `export const value = 42;`
      const jsPath = NPath.join(tmpDir, "module.ts")

      yield* fs.writeFileString(jsPath, jsContent)

      const bundle = yield* BunBundle.buildClient({
        entrypoints: [jsPath],
      })

      const artifact = bundle.artifacts[0]

      test.expect(artifact.path).toBeString()
      test.expect(artifact.type).toBeString()
      test.expect(artifact.size).toBeNumber()
      test.expect(artifact.type).toContain("javascript")
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise),
  )
})
