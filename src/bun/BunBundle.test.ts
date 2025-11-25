import * as HttpRouter from "@effect/platform/HttpRouter"
import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as NFS from "node:fs/promises"
import * as NOS from "node:os"
import * as NPath from "node:path"
import * as Bundle from "../Bundle.ts"
import * as BundleHttp from "../BundleHttp.ts"
import * as TestHttpClient from "../TestHttpClient.ts"
import * as BunBundle from "./BunBundle.ts"

t.describe("BunBundle manifest structure", () => {
  t.it("should generate manifest with inputs and outputs arrays", async () => {
    const tmpDir = await NFS.mkdtemp(
      NPath.join(NOS.tmpdir(), "effect-start-test-"),
    )

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

      t
        .expect(bundle.entrypoints)
        .toBeObject()
      t
        .expect(bundle.artifacts)
        .toBeArray()

      t
        .expect(Object.keys(bundle.entrypoints).length)
        .toBe(1)
      t
        .expect(bundle.artifacts.length)
        .toBe(3)

      const entrypointKeys = Object.keys(bundle.entrypoints)
      const firstEntrypoint = entrypointKeys[0]

      t
        .expect(firstEntrypoint)
        .toBeString()
      t
        .expect(bundle.entrypoints[firstEntrypoint])
        .toBeString()

      const firstArtifact = bundle.artifacts[0]

      t
        .expect(firstArtifact)
        .toHaveProperty("path")
      t
        .expect(firstArtifact)
        .toHaveProperty("type")
      t
        .expect(firstArtifact)
        .toHaveProperty("size")

      t
        .expect(firstArtifact.size)
        .toBeGreaterThan(0)
    } finally {
      await NFS.rm(tmpDir, {
        recursive: true,
        force: true,
      })
    }
  })

  t.it("should serve manifest via HTTP with correct structure", async () => {
    const tmpDir = await NFS.mkdtemp(
      NPath.join(NOS.tmpdir(), "effect-start-test-"),
    )

    try {
      const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Test App</title></head>
<body><h1>Test</h1></body>
</html>`

      const htmlPath = NPath.join(tmpDir, "app.html")

      await NFS.writeFile(htmlPath, htmlContent)

      const testLayer = Layer.effect(
        Bundle.ClientBundle,
        BunBundle.buildClient({
          entrypoints: [htmlPath],
        }),
      )

      const result = await Effect.runPromise(
        Effect
          .scoped(
            Effect.gen(function*() {
              const App = HttpRouter.empty.pipe(
                HttpRouter.mountApp(
                  "/_bundle",
                  BundleHttp.httpApp(),
                ),
              )

              const Client = TestHttpClient.make(App)

              const response = yield* Client.get("/_bundle/manifest.json")

              const manifestText = yield* response.text

              return JSON.parse(manifestText)
            }),
          )
          .pipe(
            Effect.provide(testLayer),
          ),
      )

      t
        .expect(result)
        .toHaveProperty("entrypoints")
      t
        .expect(result)
        .toHaveProperty("artifacts")

      t
        .expect(result.entrypoints)
        .toBeObject()
      t
        .expect(result.artifacts)
        .toBeArray()

      t
        .expect(Object.keys(result.entrypoints).length)
        .toBe(1)
      t
        .expect(result.artifacts.length)
        .toBe(3)

      const entrypointKeys = Object.keys(result.entrypoints)
      const firstKey = entrypointKeys[0]

      t
        .expect(firstKey)
        .toBeString()
      t
        .expect(result.entrypoints[firstKey])
        .toBeString()

      const artifact = result.artifacts[0]

      t
        .expect(artifact)
        .toHaveProperty("path")
      t
        .expect(artifact)
        .toHaveProperty("type")
      t
        .expect(artifact)
        .toHaveProperty("size")
    } finally {
      await NFS.rm(tmpDir, {
        recursive: true,
        force: true,
      })
    }
  })

  t.it("should resolve entrypoints to artifacts correctly", async () => {
    const tmpDir = await NFS.mkdtemp(
      NPath.join(NOS.tmpdir(), "effect-start-test-"),
    )

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

      t
        .expect(resolvedOutput)
        .toBe(expectedOutput)

      const artifact = bundle.getArtifact(resolvedOutput!)

      t
        .expect(artifact)
        .not
        .toBeNull()

      t
        .expect(artifact)
        .toBeTruthy()
    } finally {
      await NFS.rm(tmpDir, {
        recursive: true,
        force: true,
      })
    }
  })

  t.it("should include all artifact metadata", async () => {
    const tmpDir = await NFS.mkdtemp(
      NPath.join(NOS.tmpdir(), "effect-start-test-"),
    )

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

      t
        .expect(artifact.path)
        .toBeString()
      t
        .expect(artifact.type)
        .toBeString()
      t
        .expect(artifact.size)
        .toBeNumber()

      t
        .expect(artifact.type)
        .toContain("javascript")
    } finally {
      await NFS.rm(tmpDir, {
        recursive: true,
        force: true,
      })
    }
  })
})
