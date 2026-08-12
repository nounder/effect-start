import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as esbuild from "esbuild"
import * as NPath from "node:path"
import * as EsbuildPlugin from "../../src/esbuild/EsbuildPlugin.ts"
import * as FileSystem from "../../src/FileSystem.ts"
import { NodeFileSystem } from "../../src/node/index.ts"
import * as TailwindPlugin from "../../src/tailwind/TailwindPlugin.ts"

const makeFixture = () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const tmpDir = yield* fs.makeTempDirectoryScoped({
      prefix: "effect-start-esbuild-plugin-",
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

test.it("toEsbuildPlugin adapts the generic Tailwind plugin for esbuild.build", () =>
  Effect
    .gen(function*() {
      const { cssPath } = yield* makeFixture()
      const plugin = EsbuildPlugin.toEsbuildPlugin(TailwindPlugin.make())

      const output = yield* Effect.tryPromise(() =>
        esbuild.build({
          entryPoints: [cssPath],
          bundle: true,
          write: false,
          plugins: [plugin],
        })
      )

      test
        .expect(output.outputFiles.length)
        .toBeGreaterThan(0)

      const css = output.outputFiles[0]!.text

      test
        .expect(css)
        .toContain("bg-red-500")
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    ))
