import * as t from "bun:test"
import * as JsModule from "./JsModule.ts"

t.describe(`${JsModule.importSource.name}`, () => {
  t.it("imports a string", async () => {
    const mod = await JsModule.importSource<any>(`
      export const b = "B"
    `)

    t
      .expect(mod.b)
      .toBe("B")
  })
})
