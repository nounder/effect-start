import * as test from "bun:test"
import * as BunImportTrackerPlugin from "./BunImportTrackerPlugin.ts"
import * as BunVirtualFilesPlugin from "./BunVirtualFilesPlugin.ts"

const Files = {
  "index.html": `
<!DOCTYPE html>
<html>
  <head>
    <title>Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="client.tsx" />
  </body>
</html>
`,

  "client.ts": `
import { message } from "./config.ts"

alert(message)
`,

  ".config.ts": `
export const message = "Hello, World!"
`,
}

test.it("virtual import", async () => {
  const trackerPlugin = BunImportTrackerPlugin.make({
    baseDir: Bun.fileURLToPath(import.meta.resolve("../..")),
  })

  await Bun.build({
    target: "bun",
    entrypoints: [import.meta.path],
    plugins: [trackerPlugin],
  })

  test.expect([...trackerPlugin.state.entries()]).toEqual([
    [
      "src/bun/BunImportTrackerPlugin.test.ts",
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
