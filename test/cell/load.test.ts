import * as test from "bun:test"
import "effect-start/cell"
import { JSDOM } from "jsdom"

let bundle: string
let dom: JSDOM

test.beforeAll(async () => {
  const result = await Bun.build({
    entrypoints: [new URL("./fixtures/load.ts", import.meta.url).pathname],
    target: "browser",
    format: "iife",
  })
  if (!result.success) throw new AggregateError(result.logs, "Cell bundle failed")
  bundle = await result.outputs[0].text()
})

test.beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only" })
  dom.window.structuredClone = structuredClone
})

test.afterEach(() => {
  dom.window.close()
})

test.it("imports safely outside the browser", () => {
  test
    .expect(() => new Function(bundle)())
    .not
    .toThrow()
})

test.it("automatically starts from a side-effect import and observes later elements", async () => {
  dom.window.document.body.innerHTML = `<button data-cell="cell => { cell.target.textContent = 'started' }"></button>`
  dom.window.eval(bundle)

  test
    .expect(dom.window.document.querySelector("button")!.textContent)
    .toBe("started")

  const target = dom.window.document.createElement("div")
  target.setAttribute("data-cell", "cell => { cell.target.textContent = 'mounted' }")
  dom.window.document.body.append(target)
  await Promise.resolve()

  test
    .expect(target.textContent)
    .toBe("mounted")
})

test.it("separate copies tear down the previous runtime before restarting", () => {
  const error = test.spyOn(dom.window.console, "error").mockImplementation(() => {})
  dom.window.document.body.innerHTML = `<button data-cell="cell => {
    cell.target.dataset.setups = String(Number(cell.target.dataset.setups ?? 0) + 1)
    cell.target.abortSignal = cell.abortSignal
    cell.on('click', () => { cell.target.textContent = String(Number(cell.target.textContent) + 1) })
    return () => { cell.target.dataset.cleanups = String(Number(cell.target.dataset.cleanups ?? 0) + 1) }
  }">0</button>`
  dom.window.eval(bundle)
  const target = dom.window.document.querySelector("button")!
  const previousSignal: AbortSignal = (target as any).abortSignal
  dom.window.eval(bundle)
  target.click()

  test
    .expect([target.dataset.setups, target.dataset.cleanups, target.textContent])
    .toEqual(["2", "1", "1"])
  test
    .expect(previousSignal.aborted)
    .toBe(true)
  test
    .expect((target as any).abortSignal.aborted)
    .toBe(false)
  test
    .expect(error)
    .not
    .toHaveBeenCalled()
})
