import { expect, test } from "bun:test"
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

test("virtual import", async () => {
  const trackerPlugin = BunImportTrackerPlugin.make()

  await Bun.build({
    target: "bun",
    entrypoints: [
      import.meta.path,
    ],
    plugins: [
      trackerPlugin,
    ],
  })

  expect([...trackerPlugin.state.entries()])
    .toEqual([
      [
        "/Users/rg/Projects/effect-bundler/src/bun/BunImportTrackerPlugin.test.ts",
        [
          {
            kind: "import-statement",
            path: "bun:test",
          },
          {
            kind: "import-statement",
            path: "./BunImportTrackerPlugin.ts",
          },
          {
            kind: "import-statement",
            path: "./BunVirtualFilesPlugin.ts",
          },
        ],
      ],
      [
        "/Users/rg/Projects/effect-bundler/src/bun/BunImportTrackerPlugin.ts",
        [],
      ],
    ])
})
