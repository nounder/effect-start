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

    const [
      e0,
    ] = build.imports!.entries()

    expect(e0)
      .toEqual([
        "src/bun/BunBundle_imports.test.ts",
        [
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
        ],
      ])
  }))
