import * as test from "bun:test"
import * as NFs from "node:fs"
import * as NOs from "node:os"
import * as NPath from "node:path"
import * as BunFileRouterPlugin from "../../src/bun/BunFileRouterPlugin.ts"

const writeTree = (root: string, files: Record<string, string>) => {
  for (const [path, content] of Object.entries(files)) {
    const full = NPath.join(root, path)
    NFs.mkdirSync(NPath.dirname(full), { recursive: true })
    NFs.writeFileSync(full, content)
  }
}

const makeRoutesDir = (files: Record<string, string>) => {
  const root = NFs.mkdtempSync(NPath.join(NOs.tmpdir(), "effect-start-plugin-"))
  writeTree(root, files)
  return root
}

test.it("bundles the manifest as a virtual module without touching disk", async () => {
  const routesDir = makeRoutesDir({
    "route.tsx": `export default "ROOT_MARKER"\n`,
    "about/route.tsx": `export default "ABOUT_MARKER"\n`,
  })
  const entryDir = NFs.mkdtempSync(NPath.join(NOs.tmpdir(), "effect-start-entry-"))
  const entryPath = NPath.join(entryDir, "entry.ts")
  NFs.writeFileSync(
    entryPath,
    `export { default } from ${JSON.stringify(BunFileRouterPlugin.DEFAULT_MODULE_ID)}\n`,
  )

  try {
    const filesBefore = NFs.readdirSync(routesDir, { recursive: true })

    const output = await Bun.build({
      entrypoints: [entryPath],
      target: "bun",
      plugins: [BunFileRouterPlugin.make({ path: routesDir })],
    })

    test.expect(output.success).toBe(true)

    const bundled = (
      await Promise.all(output.outputs.map((o) => o.text()))
    )
      .join("\n")

    // route contents were inlined, not left as a runtime directory scan
    test.expect(bundled).toContain("ROOT_MARKER")
    test.expect(bundled).toContain("ABOUT_MARKER")
    test.expect(bundled).not.toContain("readdirSync")

    // never wrote a manifest file next to the routes
    test.expect(NFs.readdirSync(routesDir, { recursive: true })).toEqual(filesBefore)
  } finally {
    NFs.rmSync(routesDir, { recursive: true, force: true })
    NFs.rmSync(entryDir, { recursive: true, force: true })
  }
})

test.it("supports a custom module id", async () => {
  const routesDir = makeRoutesDir({
    "route.tsx": `export default "ROOT_MARKER"\n`,
  })
  const entryDir = NFs.mkdtempSync(NPath.join(NOs.tmpdir(), "effect-start-entry-"))
  const entryPath = NPath.join(entryDir, "entry.ts")
  const moduleId = "virtual:my-app/routes"
  NFs.writeFileSync(
    entryPath,
    `export { default } from ${JSON.stringify(moduleId)}\n`,
  )

  try {
    const output = await Bun.build({
      entrypoints: [entryPath],
      target: "bun",
      plugins: [BunFileRouterPlugin.make({ path: routesDir, moduleId })],
    })

    test.expect(output.success).toBe(true)
    const bundled = (
      await Promise.all(output.outputs.map((o) => o.text()))
    )
      .join("\n")
    test.expect(bundled).toContain("ROOT_MARKER")
  } finally {
    NFs.rmSync(routesDir, { recursive: true, force: true })
    NFs.rmSync(entryDir, { recursive: true, force: true })
  }
})

test.it("fails to resolve the manifest specifier when the plugin isn't registered", async () => {
  const entryDir = NFs.mkdtempSync(NPath.join(NOs.tmpdir(), "effect-start-entry-"))
  const entryPath = NPath.join(entryDir, "entry.ts")
  NFs.writeFileSync(
    entryPath,
    `export { default } from ${JSON.stringify(BunFileRouterPlugin.DEFAULT_MODULE_ID)}\n`,
  )

  try {
    await test
      .expect(
        Bun.build({
          entrypoints: [entryPath],
          target: "bun",
        }),
      )
      .rejects
      .toBeDefined()
  } finally {
    NFs.rmSync(entryDir, { recursive: true, force: true })
  }
})
