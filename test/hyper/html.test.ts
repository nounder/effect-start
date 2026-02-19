import * as test from "bun:test"
import { html } from "effect-start/hyper"

test.describe("html", () => {
  test.test("plain template", () => {
    const expected = `
          <div>hello</div>
        `

    test
      .expect(
        html`
          <div>hello</div>
        `.value,
      )
      .toBe(expected)
  })

  test.test("strings pass through raw", () => {
    const input = '<script>alert("xss")</script>'

    test.expect(html`<div>${input}</div>`.value).toBe('<div><script>alert("xss")</script></div>')
  })

  test.test("interpolates numbers", () => {
    test.expect(html`<span>${42}</span>`.value).toBe("<span>42</span>")
  })

  test.test("interpolates bigints", () => {
    test.expect(html`<span>${100n}</span>`.value).toBe("<span>100</span>")
  })

  test.test("null/undefined/boolean render as empty", () => {
    test.expect(html`${null}${undefined}${false}${true}`.value).toBe("")
  })

  test.test("nested html templates compose", () => {
    const inner = html`
      <em>bold</em>
    `
    const expected = `<div>${inner.value}</div>`

    test.expect(html`<div>${inner}</div>`.value).toBe(expected)
  })

  test.test("arrays are joined", () => {
    const items = ["a", "b", "c"]

    test
      .expect(html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`.value)
      .toBe("<ul><li>a</li><li>b</li><li>c</li></ul>")
  })

  test.test("html.raw passes through", () => {
    const raw = html.raw("<b>bold</b>")

    test.expect(html`<div>${raw}</div>`.value).toBe("<div><b>bold</b></div>")
  })

  test.test("objects are JSON-serialized", () => {
    const data = { name: "bob", age: 30 }

    test
      .expect(html`<div data-signals='${data}'></div>`.value)
      .toBe('<div data-signals=\'{"name":"bob","age":30}\'></div>')
  })

  test.test("functions are stringified", () => {
    const fn = (window: Window) => window.alert("hi")

    test.expect(html`${fn}`.value).toBe('(window) => window.alert("hi")')
  })
})
