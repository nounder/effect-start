import * as test from "bun:test"
import * as BunImportTrackerPlugin from "../../src/bun/BunImportTrackerPlugin.ts"
// eslint-disable-next-line no-unused-vars
import * as BunVirtualFilesPlugin from "../../src/bun/BunVirtualFilesPlugin.ts"

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
            path: "src/bun/BunImportTrackerPlugin.ts",
          },
          {
            kind: "import-statement",
            path: "src/bun/BunVirtualFilesPlugin.ts",
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
