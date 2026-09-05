import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as NPath from "node:path"
import * as rolldown from "rolldown"
import * as FileSystem from "../../src/FileSystem.ts"
import { NodeFileSystem } from "../../src/node/index.ts"
import * as RolldownPlugin from "../../src/rolldown/RolldownPlugin.ts"
import * as TailwindPlugin from "../../src/tailwind/TailwindPlugin.ts"

const makeFixture = () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const tmpDir = yield* fs.makeTempDirectoryScoped({
      prefix: "effect-start-rolldown-plugin-",
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

test.it("toRolldownPlugin adapts the generic Tailwind plugin for rolldown.build", () =>
  Effect
    .gen(function*() {
      const { cssPath } = yield* makeFixture()
      const plugin = RolldownPlugin.toRolldownPlugin(TailwindPlugin.make())

      const output = yield* Effect.tryPromise(() =>
        rolldown.build({
          input: cssPath,
          plugins: [plugin],
          write: false,
        })
      )

      const cssAsset = output.output.find((item) => item.fileName.endsWith(".css"))

      test
        .expect(cssAsset)
        .toBeDefined()

      const source = cssAsset!.type === "asset" ? cssAsset!.source : ""

      test
        .expect(String(source))
        .toContain("bg-red-500")
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    ))
