import * as test from "bun:test"
import * as BunBundle from "effect-start/bun/BunBundle"
import * as BunImportTrackerPlugin from "effect-start/bun/BunImportTrackerPlugin"
import { effectFn } from "effect-start/testing"

const effect = effectFn()

test.it("imports", () =>
  effect(function*() {
    const importTracker = BunImportTrackerPlugin.make()
    yield* BunBundle.build({
      target: "bun",
      plugins: [importTracker],
      entrypoints: [
        Bun.fileURLToPath(import.meta.resolve("./BunBundle_imports.test.ts")),
      ],
    })

    const [e0] = importTracker.state.entries()

    test
      .expect(e0)
      .toEqual([
        "test/bun/BunBundle_imports.test.ts",
        [
          {
            kind: "import-statement",
            path: "bun:test",
          },
          {
            kind: "import-statement",
            path: "test/bun/effect-start/bun/BunBundle",
          },
          {
            kind: "import-statement",
            path: "test/bun/effect-start/bun/BunImportTrackerPlugin",
          },
          {
            kind: "import-statement",
            path: "test/bun/effect-start/testing",
          },
        ],
      ])
  }))
