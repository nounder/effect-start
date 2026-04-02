import * as test from "bun:test"
import * as HtmlScanner from "../src/_HtmlScanner.ts"

test.describe("parse", () => {
  test.it("finds script tags with attributes", () => {
    const els = [...HtmlScanner.parse(`<html><head><script src="/app.js" type="module"></script></head></html>`)]
    const script = els.find((e) => e.tagName === "script")!
    test.expect(script.attributes.get("src")).toBe("/app.js")
    test.expect(script.attributes.get("type")).toBe("module")
  })

  test.it("finds link tags", () => {
    const els = [...HtmlScanner.parse(`<link rel="stylesheet" href="/style.css">`)]
    test.expect(els[0].tagName).toBe("link")
    test.expect(els[0].attributes.get("rel")).toBe("stylesheet")
    test.expect(els[0].attributes.get("href")).toBe("/style.css")
  })

  test.it("yields all tags", () => {
    const els = [...HtmlScanner.parse(`<div class="foo"><p>hello</p><script src="x"></script></div>`)]
    const tags = els.map((e) => e.tagName)
    test.expect(tags).toEqual(["div", "p", "script"])
  })

  test.it("handles self-closing tags", () => {
    const els = [...HtmlScanner.parse(`<link rel="stylesheet" href="/a.css" />`)]
    test.expect(els[0].attributes.get("href")).toBe("/a.css")
  })

  test.it("handles single-quoted attributes", () => {
    const els = [...HtmlScanner.parse(`<script src='/app.js'></script>`)]
    test.expect(els[0].attributes.get("src")).toBe("/app.js")
  })

  test.it("handles unquoted attributes", () => {
    const els = [...HtmlScanner.parse(`<script src=app.js></script>`)]
    test.expect(els[0].attributes.get("src")).toBe("app.js")
  })

  test.it("handles boolean attributes", () => {
    const els = [...HtmlScanner.parse(`<script defer async src="/app.js"></script>`)]
    test.expect([...els[0].attributes]).toEqual([
      ["defer", ""],
      ["async", ""],
      ["src", "/app.js"],
    ])
  })

  test.it("normalizes attribute names to lowercase", () => {
    const els = [...HtmlScanner.parse(`<script SRC="/app.js" TYPE="module"></script>`)]
    test.expect(els[0].attributes.get("src")).toBe("/app.js")
    test.expect(els[0].attributes.get("type")).toBe("module")
  })

  test.it("handles multiple elements", () => {
    const els = [...HtmlScanner.parse(`
      <link rel="stylesheet" href="/a.css">
      <link rel="stylesheet" href="/b.css">
      <script src="/x.js"></script>
      <script src="/y.js"></script>
    `)]
    test.expect(els).toHaveLength(4)
  })

  test.it("skips HTML comments", () => {
    const els = [...HtmlScanner.parse(`<!-- <script src="/old.js"></script> --><script src="/new.js"></script>`)]
    test.expect(els).toHaveLength(1)
    test.expect(els[0].attributes.get("src")).toBe("/new.js")
  })

  test.it("skips doctype", () => {
    const els = [...HtmlScanner.parse(`<!DOCTYPE html><script src="/app.js"></script>`)]
    test.expect(els[0].attributes.get("src")).toBe("/app.js")
  })

  test.it("does not parse tags inside script body", () => {
    const els = [...HtmlScanner.parse(`<script src="/app.js">var x = "<link href=trap>";</script><link rel="stylesheet" href="/style.css">`)]
    test.expect(els).toHaveLength(2)
    test.expect(els[0].tagName).toBe("script")
    test.expect(els[1].tagName).toBe("link")
  })

  test.it("skips content inside style tags", () => {
    const els = [...HtmlScanner.parse(`<link rel="stylesheet" href="/a.css"><style>body { background: url("<link href=trap>") }</style><script src="/app.js"></script>`)]
    const tags = els.map((e) => e.tagName)
    test.expect(tags).toEqual(["link", "style", "script"])
  })

  test.it("handles attributes with equals in value", () => {
    const els = [...HtmlScanner.parse(`<script src="/app.js?v=123&t=abc"></script>`)]
    test.expect(els[0].attributes.get("src")).toBe("/app.js?v=123&t=abc")
  })

  test.it("handles mixed case tag names", () => {
    const els = [...HtmlScanner.parse(`<Script src="/a.js"></Script><LINK rel="stylesheet" href="/b.css">`)]
    test.expect(els[0].tagName).toBe("script")
    test.expect(els[1].tagName).toBe("link")
  })

  test.it("handles mixed quote styles and boolean attrs in one tag", () => {
    const els = [...HtmlScanner.parse(`<script src="a.js" data-x='b' async></script>`)]
    test.expect([...els[0].attributes]).toEqual([
      ["src", "a.js"],
      ["data-x", "b"],
      ["async", ""],
    ])
  })

  test.it("handles empty attribute values", () => {
    const els = [...HtmlScanner.parse(`<script src=""></script>`)]
    test.expect(els[0].attributes.get("src")).toBe("")
  })

  test.it("works as lazy generator", () => {
    const tags: Array<string> = []
    for (const el of HtmlScanner.parse(`<div><script src="a"></script><link href="b"><p></p>`)) {
      tags.push(el.tagName)
      if (el.tagName === "script") break
    }
    test.expect(tags).toEqual(["div", "script"])
  })
})

test.describe("rewrite", () => {
  test.it("setAttribute replaces existing value", () => {
    const doc = HtmlScanner.rewrite(`<script src="/old.js"></script>`)
    for (const el of doc) {
      el.setAttribute("src", "/new.js")
    }
    test.expect(doc.toString()).toBe(`<script src="/new.js"></script>`)
  })

  test.it("setAttribute on single-quoted value", () => {
    const doc = HtmlScanner.rewrite(`<script src='/old.js'></script>`)
    for (const el of doc) {
      el.setAttribute("src", "/new.js")
    }
    test.expect(doc.toString()).toBe(`<script src='/new.js'></script>`)
  })

  test.it("setAttribute adds new attribute", () => {
    const doc = HtmlScanner.rewrite(`<script src="/app.js"></script>`)
    for (const el of doc) {
      el.setAttribute("defer", "true")
    }
    test.expect(doc.toString()).toBe(`<script src="/app.js" defer="true"></script>`)
  })

  test.it("setAttribute on boolean attribute", () => {
    const doc = HtmlScanner.rewrite(`<script defer src="/app.js"></script>`)
    for (const el of doc) {
      el.setAttribute("defer", "true")
    }
    test.expect(doc.toString()).toBe(`<script defer="true" src="/app.js"></script>`)
  })

  test.it("removeAttribute", () => {
    const doc = HtmlScanner.rewrite(`<script src="/app.js" type="module"></script>`)
    for (const el of doc) {
      el.removeAttribute("type")
    }
    test.expect(doc.toString()).toBe(`<script src="/app.js"></script>`)
  })

  test.it("multiple mutations on different elements", () => {
    const doc = HtmlScanner.rewrite(`<link rel="stylesheet" href="/old.css"><script src="/old.js"></script>`)
    for (const el of doc) {
      if (el.tagName === "script") el.setAttribute("src", "/bundled.js")
      if (el.tagName === "link") el.setAttribute("href", "/bundled.css")
    }
    test.expect(doc.toString()).toBe(`<link rel="stylesheet" href="/bundled.css"><script src="/bundled.js"></script>`)
  })

  test.it("multiple setAttribute on same element", () => {
    const doc = HtmlScanner.rewrite(`<script src="/old.js" type="module"></script>`)
    for (const el of doc) {
      el.setAttribute("src", "/new.js")
      el.setAttribute("type", "text/javascript")
    }
    test.expect(doc.toString()).toBe(`<script src="/new.js" type="text/javascript"></script>`)
  })

  test.it("toString with no mutations returns html unchanged", () => {
    const html = `<script src="/app.js"></script>`
    const doc = HtmlScanner.rewrite(html)
    for (const _ of doc) { /* no-op */ }
    test.expect(doc.toString()).toBe(html)
  })

  test.it("toString without iterating returns html unchanged", () => {
    const html = `<script src="/app.js"></script>`
    const doc = HtmlScanner.rewrite(html)
    test.expect(doc.toString()).toBe(html)
  })
})
