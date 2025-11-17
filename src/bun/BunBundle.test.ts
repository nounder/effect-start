import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServer from "@effect/platform/HttpServer"
import * as BunContext from "@effect/platform-bun/BunContext"
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer"
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

      t.expect(bundle.inputs)
        .toBeArray()
      t.expect(bundle.outputs)
        .toBeArray()

      t.expect(bundle.inputs.length)
        .toBeGreaterThan(0)
      t.expect(bundle.outputs.length)
        .toBeGreaterThan(0)

      const firstInput = bundle.inputs[0]

      t.expect(firstInput)
        .toHaveProperty("input")
      t.expect(firstInput)
        .toHaveProperty("output")

      const firstOutput = bundle.outputs[0]

      t.expect(firstOutput)
        .toHaveProperty("output")
      t.expect(firstOutput)
        .toHaveProperty("type")
      t.expect(firstOutput)
        .toHaveProperty("size")

      t.expect(firstOutput.size)
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

      const App = HttpRouter.empty.pipe(
        HttpRouter.mountApp(
          "/_bundle",
          BundleHttp.httpApp(),
        ),
      )

      const Client = TestHttpClient.make(App)

      const result = await Effect.runPromise(
        Effect.gen(function*() {
          const response = yield* Client.get("/_bundle/manifest.json")

          const manifestText = yield* response.text

          return JSON.parse(manifestText)
        }).pipe(
          Effect.provide(testLayer),
        ),
      )

      t.expect(result)
        .toHaveProperty("inputs")
      t.expect(result)
        .toHaveProperty("outputs")

      t.expect(result.inputs)
        .toBeArray()
      t.expect(result.outputs)
        .toBeArray()

      t.expect(result.inputs.length)
        .toBeGreaterThan(0)
      t.expect(result.outputs.length)
        .toBeGreaterThan(0)

      const input = result.inputs[0]

      t.expect(input)
        .toHaveProperty("input")
      t.expect(input)
        .toHaveProperty("output")

      const output = result.outputs[0]

      t.expect(output)
        .toHaveProperty("output")
      t.expect(output)
        .toHaveProperty("type")
      t.expect(output)
        .toHaveProperty("size")
    } finally {
      await NFS.rm(tmpDir, {
        recursive: true,
        force: true,
      })
    }
  })

  t.it("should resolve inputs to outputs correctly", async () => {
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

      const input = bundle.inputs[0]
      const resolvedOutput = bundle.resolve(input.input)

      t.expect(resolvedOutput)
        .toBe(input.output)

      const artifact = bundle.getArtifact(resolvedOutput!)

      t.expect(artifact)
        .not
        .toBeNull()

      t.expect(artifact)
        .toBeTruthy()
    } finally {
      await NFS.rm(tmpDir, {
        recursive: true,
        force: true,
      })
    }
  })

  t.it("should include all output metadata", async () => {
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

      const output = bundle.outputs[0]

      t.expect(output.output)
        .toBeString()
      t.expect(output.type)
        .toBeString()
      t.expect(output.size)
        .toBeNumber()

      t.expect(output.type)
        .toContain("javascript")
    } finally {
      await NFS.rm(tmpDir, {
        recursive: true,
        force: true,
      })
    }
  })
})
