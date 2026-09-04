import * as test from "bun:test"
import * as BunImportTrackerPlugin from "effect-start/bun/BunImportTrackerPlugin"
// eslint-disable-next-line no-unused-vars
import * as BunVirtualFilesPlugin from "effect-start/bun/BunVirtualFilesPlugin"

test.it("virtual import", async () => {
  const trackerPlugin = BunImportTrackerPlugin.make({
    baseDir: Bun.fileURLToPath(import.meta.resolve("../..")),
  })

  await Bun.build({
    target: "bun",
    entrypoints: [import.meta.path],
    plugins: [trackerPlugin],
  })

  test
    .expect([...trackerPlugin.state.entries()])
    .toEqual([
      [
        "test/bun/BunImportTrackerPlugin.test.ts",
        [
          {
            kind: "import-statement",
            path: "bun:test",
          },
          {
            kind: "import-statement",
            path: "test/bun/effect-start/bun/BunImportTrackerPlugin",
          },
          {
            kind: "import-statement",
            path: "test/bun/effect-start/bun/BunVirtualFilesPlugin",
          },
        ],
      ],
      [
        "src/bun/BunImportTrackerPlugin.ts",
        [
          {
            kind: "import-statement",
            path: "node:path",
          },
        ],
      ],
    ])
})
