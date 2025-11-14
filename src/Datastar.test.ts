import {
  expect,
  test,
} from "bun:test"
import * as Datastar from "./Datastar.ts"
import * as HyperHtml from "./HyperHtml.ts"
import * as HyperNode from "./HyperNode.ts"
import { jsx } from "./jsx-runtime.ts"

test("data-signals object serialization", () => {
  const node = HyperNode.make("div", {
    "data-signals": { foo: 1, bar: { baz: "hello" } } as any,
  })

  const html = HyperHtml.renderToString(node, Datastar.HyperHooks)

  expect(html)
    .toBe(
      "<div data-signals=\"{&quot;foo&quot;:1,&quot;bar&quot;:{&quot;baz&quot;:&quot;hello&quot;}}\"></div>",
    )
})

test("data-signals string passthrough", () => {
  const node = HyperNode.make("div", {
    "data-signals": "$mySignal",
  })

  const html = HyperHtml.renderToString(node, Datastar.HyperHooks)

  expect(html)
    .toBe("<div data-signals=\"$mySignal\"></div>")
})

test("data-signals-* object serialization", () => {
  const node = HyperNode.make("div", {
    "data-signals-user": { name: "John", age: 30 } as any,
  })

  const html = HyperHtml.renderToString(node, Datastar.HyperHooks)

  expect(html)
    .toBe(
      "<div data-signals-user=\"{&quot;name&quot;:&quot;John&quot;,&quot;age&quot;:30}\"></div>",
    )
})

test("non-data attributes unchanged", () => {
  const node = HyperNode.make("div", {
    id: "test",
    class: "my-class",
    "data-text": "$count",
    "data-signals": { count: 0 } as any,
  })

  const html = HyperHtml.renderToString(node, Datastar.HyperHooks)

  expect(html)
    .toContain("id=\"test\"")
  expect(html)
    .toContain("class=\"my-class\"")
  expect(html)
    .toContain("data-text=\"$count\"")
  expect(html)
    .toContain("data-signals=\"{&quot;count&quot;:0}\"")
})

test("null and undefined values ignored", () => {
  const node = HyperNode.make("div", {
    "data-signals": null,
    "data-other": undefined,
  })

  const html = HyperHtml.renderToString(node, Datastar.HyperHooks)

  expect(html)
    .toBe("<div></div>")
})

test("complex nested objects serialization", () => {
  const complexObject = {
    user: { name: "John Doe", preferences: { theme: "dark" } },
    items: [1, 2, 3],
  }

  const node = HyperNode.make("div", {
    "data-signals": complexObject as any,
  })

  const html = HyperHtml.renderToString(node, Datastar.HyperHooks)

  expect(html)
    .toContain("data-signals=")
  expect(html)
    .toContain("John Doe")
})

test("non-signals data attributes serialized", () => {
  const node = HyperNode.make("div", {
    "data-class": { hidden: true, visible: false } as any,
    "data-style": { color: "red", display: "none" } as any,
    "data-show": true as any,
    "data-text": "$count",
  })

  const html = HyperHtml.renderToString(node, Datastar.HyperHooks)

  expect(html)
    .toContain(
      "data-class=\"{&quot;hidden&quot;:true,&quot;visible&quot;:false}\"",
    )
  expect(html)
    .toContain(
      "data-style=\"{&quot;color&quot;:&quot;red&quot;,&quot;display&quot;:&quot;none&quot;}\"",
    )
  expect(html)
    .toContain("data-show=\"true\"")
  expect(html)
    .toContain("data-text=\"$count\"")
})

test("data-attr object serialization", () => {
  const node = HyperNode.make("div", {
    "data-attr": { disabled: true, tabindex: 0 } as any,
  })

  const html = HyperHtml.renderToString(node, Datastar.HyperHooks)

  expect(html)
    .toBe(
      "<div data-attr=\"{&quot;disabled&quot;:true,&quot;tabindex&quot;:0}\"></div>",
    )
})

test("boolean attributes converted to strings", () => {
  const node = HyperNode.make("div", {
    "data-ignore": false as any,
    "data-ignore-morph": true as any,
  })

  const html = HyperHtml.renderToString(node, Datastar.HyperHooks)

  expect(html)
    .not
    .toContain("data-ignore=\"")
  expect(html)
    .toContain("data-ignore-morph")
  expect(html)
    .not
    .toContain("data-ignore-morph=")
})

test("data-ignore attributes only present when true", () => {
  const nodeTrue = HyperNode.make("div", {
    "data-ignore": true as any,
  })

  const nodeFalse = HyperNode.make("div", {
    "data-ignore": false as any,
  })

  const htmlTrue = HyperHtml.renderToString(nodeTrue, Datastar.HyperHooks)
  const htmlFalse = HyperHtml.renderToString(nodeFalse, Datastar.HyperHooks)

  expect(htmlTrue)
    .toContain("data-ignore")
  expect(htmlTrue)
    .not
    .toContain("data-ignore=")
  expect(htmlFalse)
    .not
    .toContain("data-ignore")
})

test("dynamic attributes with suffixes", () => {
  const node = HyperNode.make("div", {
    "data-class-active": "hidden" as any,
    "data-attr-tabindex": "5" as any,
    "data-style-opacity": "0.5" as any,
  })

  const html = HyperHtml.renderToString(node, Datastar.HyperHooks)

  expect(html)
    .toContain("data-class-active=\"hidden\"")
  expect(html)
    .toContain("data-attr-tabindex=\"5\"")
  expect(html)
    .toContain("data-style-opacity=\"0.5\"")
})

test("JSX with data-signals object", () => {
  const node = jsx("div", {
    "data-signals": { isOpen: false, count: 42 } as any,
    children: "content",
  })

  const html = HyperHtml.renderToString(node, Datastar.HyperHooks)

  expect(html)
    .toBe(
      "<div data-signals=\"{&quot;isOpen&quot;:false,&quot;count&quot;:42}\">content</div>",
    )
  expect(html)
    .not
    .toContain("[object Object]")
})

test("JSX component returning element with data-signals", () => {
  function TestComponent() {
    return jsx("div", {
      "data-signals": { isOpen: false } as any,
      children: jsx("span", { children: "nested content" }),
    })
  }

  const node = jsx(TestComponent, {})

  const html = HyperHtml.renderToString(node, Datastar.HyperHooks)

  expect(html)
    .toBe(
      "<div data-signals=\"{&quot;isOpen&quot;:false}\"><span>nested content</span></div>",
    )
  expect(html)
    .not
    .toContain("[object Object]")
})

test("debug hook execution", () => {
  const node = jsx("div", {
    "data-signals": { isOpen: false, count: 42 } as any,
    children: "content",
  })

  const html = HyperHtml.renderToString(node, Datastar.HyperHooks)
  console.log("Final HTML:", html)

  expect(html)
    .not
    .toContain("[object Object]")
})
