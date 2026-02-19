import * as test from "bun:test"
import { effectFn } from "../../src/testing"
import * as BunBundle from "../../src/bun/BunBundle.ts"
import * as BunImportTrackerPlugin from "../../src/bun/BunImportTrackerPlugin.ts"

const effect = effectFn()

test.it("imports", () =>
  effect(function* () {
    const importTracker = BunImportTrackerPlugin.make()
    yield* BunBundle.build({
      target: "bun",
      plugins: [importTracker],
      entrypoints: [Bun.fileURLToPath(import.meta.resolve("./BunBundle_imports.test.ts"))],
    })

    const [e0] = importTracker.state.entries()

    test.expect(e0).toEqual([
      "test/bun/BunBundle_imports.test.ts",
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
  }),
)
