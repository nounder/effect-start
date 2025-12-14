import * as t from "bun:test"
import { effectFn } from "../testing"
import * as BunBundle from "./BunBundle.ts"
import * as BunImportTrackerPlugin from "./BunImportTrackerPlugin.ts"

const effect = effectFn()

t.it("imports", () =>
  effect(function*() {
    const importTracker = BunImportTrackerPlugin.make()
    yield* BunBundle.build({
      target: "bun",
      plugins: [
        importTracker,
      ],
      entrypoints: [
        Bun.fileURLToPath(import.meta.resolve("./BunBundle_imports.test.ts")),
      ],
    })

    const [
      e0,
    ] = importTracker.state.entries()

    t
      .expect(
        e0,
      )
      .toEqual([
        "src/bun/BunBundle_imports.test.ts",
        [
          {
            kind: "import-statement",
            path: "bun:test",
          },
          {
            kind: "import-statement",
            path: "src/testing",
          },
          {
            kind: "import-statement",
            path: "src/bun/BunBundle.ts",
          },
          {
            kind: "import-statement",
            path: "src/bun/BunImportTrackerPlugin.ts",
          },
        ],
      ])
  }))
