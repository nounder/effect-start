/**
 * Tests are skipped here because they write to a filesystem.
 */
import {
  expect,
  it,
} from "bun:test"
import * as Esm from "./esm.ts"

it.skip("import js bundle", async () => {
  const blobs = {
    "a.js": new Blob([`
import { b } from "./b.js"

export default b
`]),

    "b.js": new Blob([`
export const b = "B"
`]),
  }

  const mod = await Esm.importJsBundle<any>(blobs, "a.js")

  expect(
    mod.default,
  )
    .toBe("B")
})

it.skip("import single js bundle", async () => {
  const blob = new Blob([`
export const b = "B"
`])

  const mod = await Esm.importJsBlob<any>(blob)

  expect(
    mod.b,
  )
    .toBe("B")
})
