import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as NPath from "node:path"
import * as BunPlugin from "../../src/bun/BunPlugin.ts"
import * as FileSystem from "../../src/FileSystem.ts"
import { NodeFileSystem } from "../../src/node/index.ts"
import * as TailwindPlugin from "../../src/tailwind/TailwindPlugin.ts"

const makeFixture = () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const tmpDir = yield* fs.makeTempDirectoryScoped({
      prefix: "effect-start-bun-plugin-",
      // Nested under the project's own directory so tailwindcss's module
      // resolution walks up to the repo's node_modules.
      directory: process.cwd(),
    })
    yield* fs.writeFileString(
      NPath.join(tmpDir, "component.tsx"),
      `export const Component = () => <div className="bg-red-500">Hi</div>`,
    )
    const cssPath = NPath.join(tmpDir, "app.css")
    yield* fs.writeFileString(
      cssPath,
      `@import "tailwindcss";\n@source "./component.tsx";`,
    )
    return { tmpDir, cssPath }
  })

test.it("toBunPlugin adapts the generic Tailwind plugin for Bun.build", () =>
  Effect
    .gen(function*() {
      const { cssPath } = yield* makeFixture()
      const bunPlugin = BunPlugin.toBunPlugin(TailwindPlugin.make())

      const output = yield* Effect.tryPromise(() =>
        Bun.build({
          entrypoints: [cssPath],
          target: "browser",
          plugins: [bunPlugin],
        })
      )

      test
        .expect(output.success)
        .toBe(true)

      const css = yield* Effect.promise(() => output.outputs[0]!.text())

      test
        .expect(css)
        .toContain("bg-red-500")
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    ))
