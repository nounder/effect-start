import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as NFS from "node:fs/promises"
import * as NOS from "node:os"
import * as NPath from "node:path"
import * as BunBundle from "./BunBundle.ts"

test.describe("BunBundle manifest structure", () => {
  test.it("should generate manifest with inputs and outputs arrays", async () => {
    const tmpDir = await NFS.mkdtemp(NPath.join(NOS.tmpdir(), "effect-start-test-"))

    try {
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

      await NFS.writeFile(htmlPath, htmlContent)
      await NFS.writeFile(jsPath, jsContent)

      const bundle = await Effect.runPromise(
        BunBundle.buildClient({
          entrypoints: [htmlPath],
        }),
      )

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
    } finally {
      await NFS.rm(tmpDir, {
        recursive: true,
        force: true,
      })
    }
  })

  test.it("should resolve entrypoints to artifacts correctly", async () => {
    const tmpDir = await NFS.mkdtemp(NPath.join(NOS.tmpdir(), "effect-start-test-"))

    try {
      const htmlContent = `<!DOCTYPE html>
<html><body>Test</body></html>`

      const htmlPath = NPath.join(tmpDir, "test.html")

      await NFS.writeFile(htmlPath, htmlContent)

      const bundle = await Effect.runPromise(
        BunBundle.buildClient({
          entrypoints: [htmlPath],
        }),
      )

      const entrypointKeys = Object.keys(bundle.entrypoints)
      const firstEntrypoint = entrypointKeys[0]
      const expectedOutput = bundle.entrypoints[firstEntrypoint]
      const resolvedOutput = bundle.resolve(firstEntrypoint)

      test.expect(resolvedOutput).toBe(expectedOutput)

      const artifact = bundle.getArtifact(resolvedOutput!)

      test.expect(artifact).not.toBeNull()
      test.expect(artifact).toBeTruthy()
    } finally {
      await NFS.rm(tmpDir, {
        recursive: true,
        force: true,
      })
    }
  })

  test.it("should include all artifact metadata", async () => {
    const tmpDir = await NFS.mkdtemp(NPath.join(NOS.tmpdir(), "effect-start-test-"))

    try {
      const jsContent = `export const value = 42;`
      const jsPath = NPath.join(tmpDir, "module.ts")

      await NFS.writeFile(jsPath, jsContent)

      const bundle = await Effect.runPromise(
        BunBundle.buildClient({
          entrypoints: [jsPath],
        }),
      )

      const artifact = bundle.artifacts[0]

      test.expect(artifact.path).toBeString()
      test.expect(artifact.type).toBeString()
      test.expect(artifact.size).toBeNumber()
      test.expect(artifact.type).toContain("javascript")
    } finally {
      await NFS.rm(tmpDir, {
        recursive: true,
        force: true,
      })
    }
  })
})
