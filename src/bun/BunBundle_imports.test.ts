import { expect, test } from "bun:test"
import { effectFn } from "../testing.ts"
import * as BunBundle from "./BunBundle.ts"

const effect = effectFn()

test("imports", () =>
  effect(function*() {
    const build = yield* BunBundle.build({
      target: "bun",
      entrypoints: [
        Bun.fileURLToPath(import.meta.resolve("./BunBundle_imports.test.ts")),
      ],
    }, {
      scanImports: true,
    })

    expect(build.imports!.get(import.meta.path))
      .toEqual([
        {
          kind: "import-statement",
          path: "bun:test",
        },
        {
          kind: "import-statement",
          path: "../testing.ts",
        },
        {
          kind: "import-statement",
          path: "./BunBundle.ts",
        },
      ])
  }))
