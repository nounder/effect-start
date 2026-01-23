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

test.it("data-* attributes with object values are JSON stringified", () => {
  const node = HyperNode.make("div", {
    "data-signals": {
      draft: "",
      pendingDraft: "",
      username: "User123",
    },
  })

  const html = HyperHtml.renderToString(node)

  test
    .expect(html)
    .toBe(
      "<div data-signals=\"{&quot;draft&quot;:&quot;&quot;,&quot;pendingDraft&quot;:&quot;&quot;,&quot;username&quot;:&quot;User123&quot;}\"></div>",
    )
})

test.it("data-* attributes with array values are JSON stringified", () => {
  const node = HyperNode.make("div", {
    "data-items": [1, 2, 3],
  })

  const html = HyperHtml.renderToString(node)

  test
    .expect(html)
    .toBe("<div data-items=\"[1,2,3]\"></div>")
})

test.it("data-* attributes with nested object values", () => {
  const node = HyperNode.make("div", {
    "data-config": {
      user: { name: "John", active: true },
      settings: { theme: "dark" },
    },
  })

  const html = HyperHtml.renderToString(node)

  test
    .expect(html)
    .toBe(
      "<div data-config=\"{&quot;user&quot;:{&quot;name&quot;:&quot;John&quot;,&quot;active&quot;:true},&quot;settings&quot;:{&quot;theme&quot;:&quot;dark&quot;}}\"></div>",
    )
})

test.it("data-* string values are not JSON stringified", () => {
  const node = HyperNode.make("div", {
    "data-value": "hello world",
  })

  const html = HyperHtml.renderToString(node)

  test
    .expect(html)
    .toBe("<div data-value=\"hello world\"></div>")
})

test.it("non-data attributes with object values are not JSON stringified", () => {
  const node = HyperNode.make("div", {
    style: "color: red",
  })

  const html = HyperHtml.renderToString(node)

  test
    .expect(html)
    .toBe("<div style=\"color: red\"></div>")
})
