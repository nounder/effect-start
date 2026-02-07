/** @jsxImportSource effect-start */
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

  test.expect(html).toBe("<div hidden disabled data-active></div>")
})

test.it("boolean false attributes are omitted", () => {
  const node = HyperNode.make("div", {
    hidden: false,
    disabled: false,
    "data-active": false,
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toBe("<div></div>")
})

test.it("string attributes render with values", () => {
  const node = HyperNode.make("div", {
    id: "test",
    class: "my-class",
    "data-value": "hello",
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toBe('<div id="test" class="my-class" data-value="hello"></div>')
})

test.it("number attributes render with values", () => {
  const node = HyperNode.make("input", {
    type: "number",
    min: 0,
    max: 100,
    value: 50,
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toBe('<input type="number" min="0" max="100" value="50">')
})

test.it("null and undefined attributes are omitted", () => {
  const node = HyperNode.make("div", {
    id: null,
    class: undefined,
    "data-test": "value",
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toBe('<div data-test="value"></div>')
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

  test.expect(html).toBe('<input type="checkbox" checked name="test" value="on">')
})

test.it("data-* attributes with object values use single-quoted JSON", () => {
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
    .toBe(`<div data-signals='{"draft":"","pendingDraft":"","username":"User123"}'></div>`)
})

test.it("data-* attributes with array values use single-quoted JSON", () => {
  const node = HyperNode.make("div", {
    "data-items": [1, 2, 3],
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toBe("<div data-items='[1,2,3]'></div>")
})

test.it("data-* attributes with nested object values use single-quoted JSON", () => {
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
      `<div data-config='{"user":{"name":"John","active":true},"settings":{"theme":"dark"}}'></div>`,
    )
})

test.it("data-* object values with single quotes in values are escaped", () => {
  const node = HyperNode.make("div", {
    "data-signals": {
      message: "it's a test",
      name: "O'Brien",
    },
  })

  const html = HyperHtml.renderToString(node)

  test
    .expect(html)
    .toBe(`<div data-signals='{"message":"it&#39;s a test","name":"O&#39;Brien"}'></div>`)
})

test.it("data-* string values are not JSON stringified", () => {
  const node = HyperNode.make("div", {
    "data-value": "hello world",
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toBe('<div data-value="hello world"></div>')
})

test.it("non-data attributes with object values are not JSON stringified", () => {
  const node = HyperNode.make("div", {
    style: "color: red",
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toBe('<div style="color: red"></div>')
})

test.it("script with function child renders as IIFE", () => {
  const handler = (window: Window) => {
    console.log("Hello from", window.document.title)
  }

  const node = HyperNode.make("script", {
    children: handler,
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toBe(`<script>(${handler.toString()})(window)</script>`)
})

test.it("script with arrow function child renders as IIFE", () => {
  const node = HyperNode.make("script", {
    children: (window: Window) => {
      window.alert("test")
    },
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toContain("<script>(")
  test.expect(html).toContain(")(window)</script>")
  test.expect(html).toContain("window.alert")
})

test.it("script with string child renders without escaping", () => {
  const node = HyperNode.make("script", {
    children: "console.log('hello')",
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toBe("<script>console.log('hello')</script>")
})

test.it("script with string child preserves ampersands and quotes", () => {
  const node = HyperNode.make("script", {
    children: 'if (a && b) { console.log("yes") }',
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toBe('<script>if (a && b) { console.log("yes") }</script>')
})

test.it("style tag content is not escaped", () => {
  const node = HyperNode.make("style", {
    children: ".foo > .bar { content: '&'; }",
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toBe("<style>.foo > .bar { content: '&'; }</style>")
})

test.it("script with attributes and no children", () => {
  const node = HyperNode.make("script", {
    type: "module",
    src: "https://example.com/app.js",
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toBe('<script type="module" src="https://example.com/app.js"></script>')
})

test.it("normal tag string content is escaped", () => {
  const node = HyperNode.make("div", {
    children: "a && b",
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toBe("<div>a &amp;&amp; b</div>")
})

test.it("data-* function values are serialized with toString", () => {
  const node = HyperNode.make("div", {
    "data-on-click": () => console.log("clicked"),
  })

  const html = HyperHtml.renderToString(node)

  test.expect(html).toContain("data-on-click=")
  test.expect(html).toContain("console.log")
})

test.it("data-* object values don't render as [object Object]", () => {
  const html = HyperHtml.renderToString(
    <div data-signals={{ isOpen: false, count: 42 }}>content</div>,
  )

  test.expect(html).toBe(`<div data-signals='{"isOpen":false,"count":42}'>content</div>`)
  test.expect(html).not.toContain("[object Object]")
})

test.it("JSX component with data-* object values", () => {
  function TestComponent() {
    return (
      <div data-signals={{ isOpen: false }}>
        <span>nested</span>
      </div>
    )
  }

  const html = HyperHtml.renderToString(<TestComponent />)

  test.expect(html).toBe(`<div data-signals='{"isOpen":false}'><span>nested</span></div>`)
})
