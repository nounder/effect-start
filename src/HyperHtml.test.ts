import * as t from "bun:test"
import * as HyperHtml from "./HyperHtml.ts"
import * as HyperNode from "./HyperNode.ts"

t.test("boolean true attributes render without value (React-like)", () => {
  const node = HyperNode.make("div", {
    hidden: true,
    disabled: true,
    "data-active": true,
  })

  const html = HyperHtml.renderToString(node)

  t
    .expect(html)
    .toBe("<div hidden disabled data-active></div>")
})

t.test("boolean false attributes are omitted", () => {
  const node = HyperNode.make("div", {
    hidden: false,
    disabled: false,
    "data-active": false,
  })

  const html = HyperHtml.renderToString(node)

  t
    .expect(html)
    .toBe("<div></div>")
})

t.test("string attributes render with values", () => {
  const node = HyperNode.make("div", {
    id: "test",
    class: "my-class",
    "data-value": "hello",
  })

  const html = HyperHtml.renderToString(node)

  t
    .expect(html)
    .toBe("<div id=\"test\" class=\"my-class\" data-value=\"hello\"></div>")
})

t.test("number attributes render with values", () => {
  const node = HyperNode.make("input", {
    type: "number",
    min: 0,
    max: 100,
    value: 50,
  })

  const html = HyperHtml.renderToString(node)

  t
    .expect(html)
    .toBe("<input type=\"number\" min=\"0\" max=\"100\" value=\"50\">")
})

t.test("null and undefined attributes are omitted", () => {
  const node = HyperNode.make("div", {
    id: null,
    class: undefined,
    "data-test": "value",
  })

  const html = HyperHtml.renderToString(node)

  t
    .expect(html)
    .toBe("<div data-test=\"value\"></div>")
})

t.test("mixed boolean and string attributes", () => {
  const node = HyperNode.make("input", {
    type: "checkbox",
    checked: true,
    disabled: false,
    name: "test",
    value: "on",
  })

  const html = HyperHtml.renderToString(node)

  t
    .expect(html)
    .toBe("<input type=\"checkbox\" checked name=\"test\" value=\"on\">")
})
