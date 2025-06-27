import {
  describe,
  expect,
  it,
} from "bun:test"
import * as JsModule from "./JsModule.ts"

describe("importSource", () => {
  it("imports a string", async () => {
    const mod = await JsModule.importSource<any>(`
      export const b = "B"
    `)

    expect(mod.b).toBe("B")
  })
})
