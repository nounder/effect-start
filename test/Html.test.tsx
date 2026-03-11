/** @jsxImportSource effect-start */
import * as test from "bun:test"
import * as Html from "../src/Html.ts"

test.it("boolean true attributes render without value (React-like)", () => {
  const node = Html.make("div", {
    hidden: true,
    disabled: true,
    "data-active": true,
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe("<div hidden disabled data-active></div>")
})

test.it("boolean false attributes are omitted", () => {
  const node = Html.make("div", {
    hidden: false,
    disabled: false,
    "data-active": false,
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe("<div></div>")
})

test.it("string attributes render with values", () => {
  const node = Html.make("div", {
    id: "test",
    class: "my-class",
    "data-value": "hello",
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe('<div id="test" class="my-class" data-value="hello"></div>')
})

test.it("number attributes render with values", () => {
  const node = Html.make("input", {
    type: "number",
    min: 0,
    max: 100,
    value: 50,
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe('<input type="number" min="0" max="100" value="50">')
})

test.it("null and undefined attributes are omitted", () => {
  const node = Html.make("div", {
    id: null,
    class: undefined,
    "data-test": "value",
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe('<div data-test="value"></div>')
})

test.it("mixed boolean and string attributes", () => {
  const node = Html.make("input", {
    type: "checkbox",
    checked: true,
    disabled: false,
    name: "test",
    value: "on",
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe('<input type="checkbox" checked name="test" value="on">')
})

test.it("data-* attributes with object values use single-quoted JSON", () => {
  const node = Html.make("div", {
    "data-signals": {
      draft: "",
      pendingDraft: "",
      username: "User123",
    },
  })

  const html = Html.renderToString(node)

  test
    .expect(html)
    .toBe(`<div data-signals='{"draft":"","pendingDraft":"","username":"User123"}'></div>`)
})

test.it("data-* attributes with array values use single-quoted JSON", () => {
  const node = Html.make("div", {
    "data-items": [1, 2, 3],
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe("<div data-items='[1,2,3]'></div>")
})

test.it("data-* attributes with nested object values use single-quoted JSON", () => {
  const node = Html.make("div", {
    "data-config": {
      user: { name: "John", active: true },
      settings: { theme: "dark" },
    },
  })

  const html = Html.renderToString(node)

  test
    .expect(html)
    .toBe(
      `<div data-config='{"user":{"name":"John","active":true},"settings":{"theme":"dark"}}'></div>`,
    )
})

test.it("data-* object values with single quotes in values are escaped", () => {
  const node = Html.make("div", {
    "data-signals": {
      message: "it's a test",
      name: "O'Brien",
    },
  })

  const html = Html.renderToString(node)

  test
    .expect(html)
    .toBe(`<div data-signals='{"message":"it&#39;s a test","name":"O&#39;Brien"}'></div>`)
})

test.it("data-* string values are not JSON stringified", () => {
  const node = Html.make("div", {
    "data-value": "hello world",
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe('<div data-value="hello world"></div>')
})

test.it("non-data attributes with object values are not JSON stringified", () => {
  const node = Html.make("div", {
    style: "color: red",
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe('<div style="color: red"></div>')
})

test.it("script with function child renders as IIFE", () => {
  const handler = (window: Window) => {
    console.log("Hello from", window.document.title)
  }

  const node = Html.make("script", {
    children: handler,
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe(`<script>(${handler.toString()})(window)</script>`)
})

test.describe("raw text escaping", () => {
  test.it("script children escapes closing tag", () => {
    const html = Html.renderToString(<script>{'console.log("</script>")'}</script>)

    test.expect(html).toBe('<script>console.log("<\\/script>")</script>')
    test.expect(html).not.toContain("</script><")
  })

  test.it("style children escapes closing tag", () => {
    const html = Html.renderToString(<style>{'div::after { content: "</style>" }'}</style>)

    test.expect(html).toBe('<style>div::after { content: "<\\/style>" }</style>')
    test.expect(html).not.toContain("</style><")
  })

  test.it("script dangerouslySetInnerHTML escapes closing tag", () => {
    const node = Html.make("script", {
      dangerouslySetInnerHTML: { __html: 'console.log("</script>")' },
    })

    const html = Html.renderToString(node)

    test.expect(html).toBe('<script>console.log("<\\/script>")</script>')
  })

  test.it("case-insensitive closing tags are escaped", () => {
    const html = Html.renderToString(<script>{'x = "</Script></SCRIPT></sCrIpT>"'}</script>)

    test.expect(html).toBe('<script>x = "<\\/Script><\\/SCRIPT><\\/sCrIpT>"</script>')
  })

  test.it("closing tag with whitespace is escaped", () => {
    const html = Html.renderToString(<script>{'x = "</script >"'}</script>)

    test.expect(html).toBe('<script>x = "<\\/script >"</script>')
  })

  test.it("XSS via script injection in script children", () => {
    const userInput = '</script><script>alert("xss")</script>'
    const html = Html.renderToString(<script>{`var data = "${userInput}"`}</script>)

    test.expect(html).not.toMatch(/<\/script.*<script/i)
  })

  test.it("XSS via script injection in style children", () => {
    const userInput = '</style><script>alert("xss")</script>'
    const html = Html.renderToString(<style>{`div::after { content: "${userInput}" }`}</style>)

    test.expect(html).not.toMatch(/<\/style.*<script/i)
  })

  test.it("XSS via script injection in dangerouslySetInnerHTML", () => {
    const userInput = '</script><script>alert("xss")</script>'
    const node = Html.make("script", {
      dangerouslySetInnerHTML: { __html: `var data = "${userInput}"` },
    })

    const html = Html.renderToString(node)

    test.expect(html).not.toMatch(/<\/script.*<script/i)
  })

  test.it("XSS via dangerouslySetInnerHTML", () => {
    const userInput = '</script><script>alert("xss")</script>'
    const node = Html.make("script", {
      dangerouslySetInnerHTML: { __html: `var data = "${userInput}"` },
    })

    const html = Html.renderToString(node)

    test.expect(html).not.toMatch(/<\/script.*<script/i)
  })

  test.it("function child with closing tag in string literal", () => {
    const html = Html.renderToString(
      <script>
        {(window: Window) => {
          const x = "</script><script>alert(1)</script>"
          window.document.title = x
        }}
      </script>,
    )

    test.expect(html).not.toMatch(/<\/script.*<script/i)
  })

  test.it("multiple closing tags in one string", () => {
    const html = Html.renderToString(<script>{'a = "</script>"; b = "</script>"'}</script>)

    test.expect(html).toBe('<script>a = "<\\/script>"; b = "<\\/script>"</script>')
  })

  test.it("partial closing tag sequences are escaped", () => {
    const html = Html.renderToString(<script>{'x = "</" + "script>"'}</script>)

    test.expect(html).toBe('<script>x = "<\\/" + "script>"</script>')
  })

  test.it("style dangerouslySetInnerHTML escapes closing tag", () => {
    const node = Html.make("style", {
      dangerouslySetInnerHTML: { __html: 'div::after { content: "</style>" }' },
    })

    const html = Html.renderToString(node)

    test.expect(html).not.toMatch(/<\/style.*</)
  })

  test.it("escaped output is still valid JS", () => {
    const html = Html.renderToString(<script>{'var x = "</script>"'}</script>)

    const content = html.replace("<script>", "").replace("</script>", "")
    const fn = new Function(content)
    fn()
  })
})

test.it("script with arrow function child renders as IIFE", () => {
  const node = Html.make("script", {
    children: (window: Window) => {
      window.alert("test")
    },
  })

  const html = Html.renderToString(node)

  test.expect(html).toContain("<script>(")
  test.expect(html).toContain(")(window)</script>")
  test.expect(html).toContain("window.alert")
})

test.it("script with string child renders without escaping", () => {
  const node = Html.make("script", {
    children: "console.log('hello')",
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe("<script>console.log('hello')</script>")
})

test.it("script with string child preserves ampersands and quotes", () => {
  const node = Html.make("script", {
    children: 'if (a && b) { console.log("yes") }',
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe('<script>if (a && b) { console.log("yes") }</script>')
})

test.it("style tag content is not escaped", () => {
  const node = Html.make("style", {
    children: ".foo > .bar { content: '&'; }",
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe("<style>.foo > .bar { content: '&'; }</style>")
})

test.it("script with attributes and no children", () => {
  const node = Html.make("script", {
    type: "module",
    src: "https://example.com/app.js",
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe('<script type="module" src="https://example.com/app.js"></script>')
})

test.it("normal tag string content is escaped", () => {
  const node = Html.make("div", {
    children: "a && b",
  })

  const html = Html.renderToString(node)

  test.expect(html).toBe("<div>a &amp;&amp; b</div>")
})

test.it("data-* function values are serialized with toString", () => {
  const node = Html.make("div", {
    "data-on-click": () => console.log("clicked"),
  })

  const html = Html.renderToString(node)

  test.expect(html).toContain("data-on-click=")
  test.expect(html).toContain("console.log")
})

test.it("data-* object values don't render as [object Object]", () => {
  const html = Html.renderToString(<div data-signals={{ isOpen: false, count: 42 }}>content</div>)

  test.expect(html).toBe(`<div data-signals='{"isOpen":false,"count":42}'>content</div>`)
  test.expect(html).not.toContain("[object Object]")
})

test.it("data-computed object values preserve function leaves", () => {
  const html = Html.renderToString(
    <div
      data-computed={{
        listening: (e) => e.signals.speechState !== "idle",
        statusText: (e) => {
          return (
            {
              idle: "Idle",
              listening: "Listening",
            }[e.signals.speechState] ?? "Idle"
          )
        },
      }}
    >
      content
    </div>,
  )

  test.expect(html).toContain("data-computed='")
  test.expect(html).toContain('"listening":')
  test.expect(html).toContain("e.signals.speechState")
  test.expect(html).not.toContain(`data-computed='{}'`)
})

test.it("dangerouslySetInnerHTML injects html without escaping", () => {
  const html = Html.renderToString(
    <div dangerouslySetInnerHTML={{ __html: '<span class="bold">hello & world</span>' }} />,
  )

  test.expect(html).toBe('<div><span class="bold">hello & world</span></div>')
})

test.it("JSX component with data-* object values", () => {
  function TestComponent() {
    return (
      <div data-signals={{ isOpen: false }}>
        <span>nested</span>
      </div>
    )
  }

  const html = Html.renderToString(<TestComponent />)

  test.expect(html).toBe(`<div data-signals='{"isOpen":false}'><span>nested</span></div>`)
})
