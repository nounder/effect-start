import * as test from "bun:test"
import * as HyperHtml from "./HyperHtml.ts"
import * as HyperNode from "./HyperNode.ts"

test.it("boolean true attributes render without value (React-like)", () => {
  const node = HyperNode.make("div", {
    hidden: true,
    disabled: true,
    "data-active": true,
  })

  const html = HyperHtml.renderToString(node)

  test
    .expect(html)
    .toBe("<div hidden disabled data-active></div>")
})

test.it("boolean false attributes are omitted", () => {
  const node = HyperNode.make("div", {
    hidden: false,
    disabled: false,
    "data-active": false,
  })

  const html = HyperHtml.renderToString(node)

  test
    .expect(html)
    .toBe("<div></div>")
})

test.it("string attributes render with values", () => {
  const node = HyperNode.make("div", {
    id: "test",
    class: "my-class",
    "data-value": "hello",
  })

  const html = HyperHtml.renderToString(node)

  test
    .expect(html)
    .toBe("<div id=\"test\" class=\"my-class\" data-value=\"hello\"></div>")
})

test.it("number attributes render with values", () => {
  const node = HyperNode.make("input", {
    type: "number",
    min: 0,
    max: 100,
    value: 50,
  })

  const html = HyperHtml.renderToString(node)

  test
    .expect(html)
    .toBe("<input type=\"number\" min=\"0\" max=\"100\" value=\"50\">")
})

test.it("null and undefined attributes are omitted", () => {
  const node = HyperNode.make("div", {
    id: null,
    class: undefined,
    "data-test": "value",
  })

  const html = HyperHtml.renderToString(node)

  test
    .expect(html)
    .toBe("<div data-test=\"value\"></div>")
})

test.it("mixed boolean and string attributes", () => {
  const node = HyperNode.make("input", {
    type: "checkbox",
    checked: true,
    disabled: false,
    name: "test",
    value: "on",
  })

  const html = HyperHtml.renderToString(node)

  test
    .expect(html)
    .toBe("<input type=\"checkbox\" checked name=\"test\" value=\"on\">")
})
