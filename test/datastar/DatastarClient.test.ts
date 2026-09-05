import * as test from "bun:test"
import * as NPath from "node:path"
import DatastarClient from "../../src/studio/internal/DatastarClient.ts"

// src/studio/internal/DatastarClient.ts ships the browser build of
// src/datastar/ so Studio can serve it without depending on the generic
// Bundle context. Regenerate it with `bun scripts/build-datastar-client`
// whenever src/datastar/ changes.
test.it("DatastarClient.ts matches a fresh build of src/datastar/", async () => {
  const root = NPath.join(import.meta.dir, "../..")

  const result = await Bun.build({
    entrypoints: [NPath.join(root, "src/datastar/index.ts")],
    target: "browser",
    format: "esm",
  })

  test
    .expect(result.success)
    .toBe(true)

  const fresh = await result.outputs[0]!.text()

  test
    .expect(DatastarClient)
    .toBe(fresh)
})
