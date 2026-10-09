import * as test from "bun:test"
import { Html } from "effect-start"
import { morph, start } from "effect-start/cell"
import type { Cell, CellDeclaration, Runtime } from "effect-start/cell"
import type { JSX } from "effect-start/jsx-runtime"
import { JSDOM } from "jsdom"

let dom: JSDOM
let runtime: Runtime
let errors: Array<unknown>

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

test.beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  })
  errors = []
  runtime = start(dom.window.document, { onError: (error) => errors.push(error) })
})

test.afterEach(() => {
  runtime.stop()
  dom.window.close()

  test
    .expect(errors)
    .toEqual([])
})

const mount = async (source: string, tag = "button") => {
  const element = dom.window.document.createElement(tag)
  element.setAttribute("data-cell", source)
  dom.window.document.body.append(element)
  await tick()
  return element
}

test.it("serializes JSX functions and types the cell target and native events", async () => {
  const props: JSX.IntrinsicElements["button"] = {
    "data-cell": (cell) => {
      test
        .expectTypeOf(cell.target)
        .toEqualTypeOf<HTMLButtonElement>()

      cell.on("click", (event) => {
        test
          .expectTypeOf(event)
          .toEqualTypeOf<HTMLElementEventMap["click"]>()
      })
    },
  }

  test
    .expect(props)
    .toBeDefined()

  dom.window.document.body.innerHTML = Html.text(
    <button
      data-cell={(cell) => {
        cell.on("click", () => {
          cell.target.textContent = "clicked"
        })
      }}
    >
      click
    </button>,
  )
  await tick()
  dom.window.document.querySelector("button")!.click()

  test
    .expect(dom.window.document.body.textContent)
    .toBe("clicked")
})

test.it("types declarations and initializes their serialized setup on existing DOM", async () => {
  const props: JSX.IntrinsicElements["button"] = {
    "data-cell": {
      append: "#missing",
      setup: (cell) => {
        test
          .expectTypeOf(cell.target)
          .toEqualTypeOf<HTMLButtonElement>()

        cell.on("click", (event) => {
          test
            .expectTypeOf(event)
            .toEqualTypeOf<HTMLElementEventMap["click"]>()
        })
      },
    },
  }

  test
    .expect(props)
    .toBeDefined()
  test
    .expectTypeOf<{ append: string; prepend: string }>()
    .not
    .toExtend<CellDeclaration>()
  test
    .expectTypeOf<{ morph: string; morphChildren: string }>()
    .not
    .toExtend<CellDeclaration>()
  test
    .expectTypeOf<{ replace: string; append: string }>()
    .not
    .toExtend<CellDeclaration>()
  test
    .expectTypeOf<{ setup: string }>()
    .not
    .toExtend<CellDeclaration>()

  const inner: JSX.IntrinsicElements["section"] = {
    "data-cell": {
      morphChildren: "#form",
      setup: (cell) => {
        test
          .expectTypeOf(cell.target)
          .toEqualTypeOf<Element>()
      },
    },
  }

  test
    .expect(inner)
    .toBeDefined()

  dom.window.document.body.innerHTML = Html.text(
    <button
      data-cell={{
        append: "#missing",
        setup: (cell) => {
          if (!cell.target.isConnected) throw new Error("Detached setup")
          cell.on("click", () => {
            cell.target.textContent = "clicked"
          })
        },
      }}
    >
      Ready
    </button>,
  )
  await tick()
  dom.window.document.querySelector("button")!.click()

  test
    .expect(dom.window.document.body.textContent)
    .toBe("clicked")
})

test.it("sets up once, tracks dynamic signal dependencies, and cleans up effects", async () => {
  const target = await mount(`cell => {
    cell.signals.setups = (cell.signals.setups ?? 0) + 1
    cell.effect(() => {
      cell.target.textContent = cell.signals.choose ? cell.signals.left : cell.signals.right
      return () => { cell.target.title += 'x' }
    })
    cell.on('click', () => { cell.signals.choose = !cell.signals.choose })
  }`)
  runtime.signals.left = "left"
  runtime.signals.right = "right"
  await tick()

  test
    .expect(target.textContent)
    .toBe("right")

  target.click()
  await tick()

  test
    .expect(target.textContent)
    .toBe("left")

  const previous = target.title
  runtime.signals.right = "ignored"
  await tick()

  test
    .expect(target.title)
    .toBe(previous)
  test
    .expect(runtime.signals.setups)
    .toBe(1)

  target.remove()
  await tick()

  test
    .expect(target.title)
    .toBe(`${previous}x`)

  runtime.signals.left = "detached"
  await tick()

  test
    .expect(target.textContent)
    .toBe("left")

  const choose = runtime.signals.choose
  target.click()

  test
    .expect(runtime.signals.choose)
    .toBe(choose)
})

test.it("missing signals support ??= and nested writes, deletion, and array changes are reactive", async () => {
  const target = await mount(`cell => {
    cell.signals.count ??= 3
    cell.signals.user = { name: 'Ada' }
    cell.signals.items = ['a', 'b']
    cell.effect(() => {
      cell.target.textContent = JSON.stringify([cell.signals.count, cell.signals.user.name, cell.signals.items.length, cell.signals.items[1]])
    })
  }`)

  test
    .expect(runtime.signals.count)
    .toBe(3)

  runtime.signals.user.name = "Grace"
  runtime.signals.items.push("c")
  await tick()

  test
    .expect(target.textContent)
    .toBe("[3,\"Grace\",3,\"b\"]")

  delete runtime.signals.user.name
  runtime.signals.items.length = 1
  await tick()

  test
    .expect(target.textContent)
    .toBe("[3,null,1,null]")
})

test.it("signal existence reacts to undefined property creation and deletion, but not repeated assignment", async () => {
  const target = await mount(`cell => { cell.target.cell = cell }`)
  const cell = (target as any).cell as Cell
  const observations: Array<boolean> = []
  cell.effect(() => {
    observations.push("foo" in cell.signals)
  })

  test
    .expect(observations)
    .toEqual([false])

  cell.signals.foo = undefined
  await tick()

  test
    .expect(observations)
    .toEqual([false, true])

  cell.signals.foo = undefined
  await tick()

  test
    .expect(observations)
    .toEqual([false, true])

  delete cell.signals.foo
  await tick()

  test
    .expect(observations)
    .toEqual([false, true, false])
})

test.it("root assignment reconnects earlier effects, including missing-property reads", async () => {
  const reader = await mount(`cell => {
    cell.target.runs = 0
    cell.effect(() => {
      cell.target.runs++
      cell.target.textContent = cell.signals.user?.name ?? 'missing'
    })
  }`)
  const writer = await mount(`cell => { cell.target.cell = cell }`)
  const cell = (writer as any).cell as Cell

  test
    .expect([reader.textContent, Object.keys(runtime.signals)])
    .toEqual(["missing", []])

  cell.signals = { user: { name: "Ada", obsolete: true }, obsolete: true }
  const previous = runtime.signals
  await tick()

  test
    .expect(reader.textContent)
    .toBe("Ada")

  cell.signals = { user: { name: "Intermediate" } }
  cell.signals = { user: { name: "Grace" }, nullable: null }
  await tick()

  test
    .expect(runtime.signals)
    .toEqual({ user: { name: "Grace" }, nullable: null })
  test
    .expect([reader.textContent, (reader as any).runs])
    .toEqual(["Grace", 3])

  previous.user.name = "Old root"
  await tick()

  test
    .expect((reader as any).runs)
    .toBe(3)

  cell.signals.user.name = "Lin"
  await tick()

  test
    .expect([reader.textContent, (reader as any).runs])
    .toEqual(["Lin", 4])

  Reflect.set(cell, "signals", cell.signals)
  cell.signals.unrelated = true
  await tick()

  test
    .expect((reader as any).runs)
    .toBe(4)

  for (const value of [null, undefined, [], 1]) {
    test
      .expect(() => Reflect.set(cell, "signals", value))
      .toThrow("Signals must be an object")
  }

  test
    .expect(runtime.signals.user.name)
    .toBe("Lin")
})

test.it("a root cell can replace startup signals before descendant setup", () => {
  runtime.stop()
  dom.window.document.body.innerHTML = Html.text(
    <main
      data-cell={(cell) => {
        cell.signals = { count: 7 }
      }}
    >
      <span
        data-cell={(cell) => {
          cell.target.textContent = String(cell.signals.count)
        }}
      />
    </main>,
  )
  runtime = start(dom.window.document, { signals: { obsolete: true }, onError: (error) => errors.push(error) })

  test
    .expect(dom.window.document.querySelector("span")!.textContent)
    .toBe("7")
  test
    .expect(runtime.signals)
    .toEqual({ count: 7 })
})

test.it("existing request handles apply SSE signal patches to the current root after replacement", async () => {
  let body: unknown
  let respond!: (response: Response) => void
  dom.window.fetch = ((_url, options) => {
    body = options?.body
    return new Promise<Response>((resolve) => {
      respond = resolve
    })
  }) as typeof fetch
  const target = await mount(`cell => { cell.target.cell = cell }`)
  const cell = (target as any).cell as Cell
  cell.signals = { count: 1 }
  const request = cell.request("/update", { method: "POST" })

  test
    .expect(body)
    .toBeUndefined()

  cell.signals = { count: 2, keep: true, nullable: true }
  respond(
    new Response("event: datastar-patch-signals\ndata: {\"signals\":{\"count\":3,\"nullable\":null}}\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    }),
  )
  await request

  test
    .expect(runtime.signals)
    .toEqual({ count: 3, keep: true, nullable: null })
})

test.it("preserves setup across moves and identical attributes; changed code replaces it", async () => {
  const source = `cell => {
    cell.signals.mounts = (cell.signals.mounts ?? 0) + 1
    cell.on('click', () => { cell.signals.clicks = (cell.signals.clicks ?? 0) + 1 })
    return () => { cell.signals.cleanups = (cell.signals.cleanups ?? 0) + 1 }
  }`
  const target = await mount(source)
  const container = dom.window.document.createElement("div")
  dom.window.document.body.append(container)
  container.append(target)
  target.setAttribute("data-cell", source)
  await tick()

  test
    .expect(runtime.signals.mounts)
    .toBe(1)

  target.setAttribute("data-cell", `${source} `)
  await tick()

  test
    .expect(runtime.signals.mounts)
    .toBe(2)
  test
    .expect(runtime.signals.cleanups)
    .toBe(1)

  target.click()

  test
    .expect(runtime.signals.clicks)
    .toBe(1)

  target.removeAttribute("data-cell")
  await tick()
  target.click()

  test
    .expect(runtime.signals.clicks)
    .toBe(1)
  test
    .expect(runtime.signals.cleanups)
    .toBe(2)
})

test.it("mounts inserted cells, isolates failed setups, and disposes partially registered handlers", async () => {
  await mount(`cell => {
    cell.on('click', () => { cell.signals.leaked = true })
    throw new Error('broken setup')
  }`)

  test
    .expect(errors.map(String))
    .toEqual(["Error: broken setup"])

  errors.length = 0
  const healthy = await mount(`cell => cell.on('click', () => { cell.signals.healthy = true })`)
  dom.window.document.querySelector("button")!.click()
  healthy.click()

  test
    .expect(runtime.signals.leaked)
    .toBeUndefined()
  test
    .expect(runtime.signals.healthy)
    .toBe(true)
})

test.it("stop is idempotent, aborts cell lifetimes, and permits restart", async () => {
  const target = await mount(`cell => {
    cell.target.cellSignal = cell.abortSignal
    cell.on('click', () => { cell.target.textContent += 'x' })
  }`)

  test
    .expect(start(dom.window.document))
    .toBe(runtime)

  runtime.stop()
  runtime.stop()

  test
    .expect((target as any).cellSignal.aborted)
    .toBe(true)

  target.click()

  test
    .expect(target.textContent)
    .toBe("")

  runtime = start(dom.window.document, { onError: (error) => errors.push(error) })
  target.click()

  test
    .expect(target.textContent)
    .toBe("x")
})

test.it("morph preserves keyed cells moved across parents and their listeners", async () => {
  const target = await mount(`cell => {
    cell.signals.mounts = (cell.signals.mounts ?? 0) + 1
    cell.on('click', () => { cell.signals.clicked = true })
  }`)
  target.id = "counter"
  const old = dom.window.document.createElement("main")
  dom.window.document.body.append(old)
  old.append(target)
  await tick()
  const template = dom.window.document.createElement("template")
  template.innerHTML = `<section><div>${target.outerHTML}</div></section>`
  morph(old, template.content, "inner")
  await tick()

  test
    .expect(old.querySelector<HTMLElement>("button"))
    .toBe(target)
  test
    .expect(runtime.signals.mounts)
    .toBe(1)

  target.click()

  test
    .expect(runtime.signals.clicked)
    .toBe(true)
})

test.it("morph preserves dirty input values unless the server changes the value attribute", () => {
  const document = dom.window.document
  document.body.innerHTML = "<main><input id=\"field\" value=\"initial\"></main><footer>keep</footer>"
  const input = document.querySelector("input")!
  input.value = "typed locally"
  const template = document.createElement("template")
  template.innerHTML = "<input id=\"field\" value=\"initial\" title=\"server\">"
  morph(document.querySelector("main")!, template.content, "inner")

  test
    .expect(document.querySelector("input"))
    .toBe(input)
  test
    .expect(input.value)
    .toBe("typed locally")

  template.innerHTML = "<input id=\"field\" value=\"updated\">"
  morph(input, template.content)

  test
    .expect(input.value)
    .toBe("updated")
  test
    .expect(input.hasAttribute("title"))
    .toBe(false)
  test
    .expect(document.querySelector("footer")!.textContent)
    .toBe("keep")
})

test.it("request emits paired lifecycle events and preserves explicit data and headers", async () => {
  const requests: Array<{ url: URL; init: RequestInit }> = []
  dom.window.fetch = (async (url, init) => {
    requests.push({ url: new URL(String(url)), init: init! })
    return new Response(null, { status: 204 })
  }) as typeof fetch
  runtime.signals.count = 0
  runtime.signals._private = "local"
  const target = await mount(`cell => { cell.target.cell = cell }`)
  const phases: Array<string> = []
  target.addEventListener("cell:request", (event: any) => phases.push(event.detail.phase))
  await (target as any).cell.request("/count")

  test
    .expect(requests[0].url.search)
    .toBe("")
  test
    .expect(requests[0].init.body)
    .toBeUndefined()
  test
    .expect(new Headers(requests[0].init.headers).get("Datastar-Request"))
    .toBeNull()
  test
    .expect(new Headers(requests[0].init.headers).get("Accept"))
    .toBe("text/event-stream, text/html")
  test
    .expect(phases)
    .toEqual(["started", "finished"])

  const body = JSON.stringify({ count: 2, _included: true, nested: { _included: true } })
  await (target as any).cell.request("/count", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/html", "X-Custom": "explicit" },
    body,
  })

  test
    .expect(requests[1].init.body)
    .toBe(body)
  test
    .expect(new Headers(requests[1].init.headers).get("Content-Type"))
    .toBe("application/json")
  test
    .expect(new Headers(requests[1].init.headers).get("Accept"))
    .toBe("text/html")
  test
    .expect(new Headers(requests[1].init.headers).get("X-Custom"))
    .toBe("explicit")
})

test.it("request rejects JSON responses without patching signals", async () => {
  dom.window.fetch = (async () =>
    Response.json({ count: 7, user: { name: "Ada" }, remove: null }, {
      headers: { "datastar-only-if-missing": "true" },
    })) as unknown as typeof fetch
  runtime.signals.count = 0
  runtime.signals.remove = true
  const target = await mount(`cell => { cell.target.cell = cell }`)
  const phases: Array<string> = []
  target.addEventListener("cell:request", (event: any) => phases.push(event.detail.phase))

  await test.expect((target as any).cell.request("/count")).rejects.toThrow(
    "Unsupported cell response: application/json",
  )

  test
    .expect(runtime.signals.count)
    .toBe(0)
  test
    .expect(runtime.signals.user)
    .toBeUndefined()
  test
    .expect(runtime.signals.remove)
    .toBe(true)
  test
    .expect(phases)
    .toEqual(["started", "error", "finished"])
})

test.it.each(["GET", "HEAD", "DELETE", "POST", "PUT", "PATCH"])(
  "request never serializes state or adds query parameters for %s",
  async (method) => {
    let requestedUrl: URL | undefined
    let requestedOptions: RequestInit | undefined
    dom.window.fetch = (async (url, options) => {
      requestedUrl = new URL(String(url))
      requestedOptions = options
      return new Response(null, { status: 204 })
    }) as typeof fetch
    runtime.signals.count = 7
    runtime.signals._local = true
    runtime.signals.circular = runtime.signals
    const target = await mount(`cell => { cell.target.cell = cell }`)
    const cell = (target as any).cell as Cell
    await cell.request("/empty", { method })

    test
      .expect(requestedUrl?.href)
      .toBe("http://localhost/empty")
    test
      .expect(requestedOptions?.body)
      .toBeUndefined()
    test
      .expect(new Headers(requestedOptions?.headers).has("Content-Type"))
      .toBe(false)
  },
)

test.it.each(["string", "URL"])("request preserves explicit query parameters from a %s", async (kind) => {
  let requestedUrl: URL | undefined
  dom.window.fetch = (async (url) => {
    requestedUrl = new URL(String(url))
    return new Response(null, { status: 204 })
  }) as typeof fetch
  const target = await mount(`cell => { cell.target.cell = cell }`)
  const cell = (target as any).cell as Cell
  const url = new URL("http://localhost/search?q=hello%20world&tag=a&tag=b&datastar=explicit")
  await cell.request(kind === "URL" ? url : url.pathname + url.search)

  test
    .expect(requestedUrl?.href)
    .toBe(url.href)
})

test.it("request passes FormData through and morphs HTML by ID ignoring special response headers", async () => {
  let body: unknown
  dom.window.fetch = (async (_url, init) => {
    body = init?.body
    return new Response(
      "<div id=\"result\"><span data-cell=\"cell => { cell.target.title = 'mounted' }\">saved</span></div>",
      {
        headers: {
          "Content-Type": "text/html",
          "datastar-selector": "#unrelated",
          "datastar-mode": "append",
          "datastar-namespace": "svg",
        },
      },
    )
  }) as typeof fetch
  const target = await mount(`cell => { cell.target.cell = cell }`, "form")
  const result = dom.window.document.createElement("div")
  result.id = "result"
  target.append(result)
  const unrelated = dom.window.document.createElement("div")
  unrelated.id = "unrelated"
  unrelated.textContent = "keep"
  target.append(unrelated)
  const form = new FormData()
  form.set("name", "Ada")
  await (target as any).cell.request("/save", { method: "POST", body: form })
  await tick()

  test
    .expect(body)
    .toBe(form)
  test
    .expect(result.textContent)
    .toBe("saved")
  test
    .expect(result.firstElementChild!.getAttribute("title"))
    .toBe("mounted")
  test
    .expect(result.firstElementChild!.namespaceURI)
    .toBe("http://www.w3.org/1999/xhtml")
  test
    .expect(unrelated.innerHTML)
    .toBe("keep")
})

test.it("SSE applies fragmented CRLF and UTF-8 messages, ignores other events, and patches signals", async () => {
  const payload = new TextEncoder().encode([
    ": heartbeat\r\n",
    "event: unrelated\r\ndata: ignore\r\n\r\n",
    "event: datastar-patch-elements\r\ndata: <div id=\"result\">café</div>\r\n\r\n",
    "event: datastar-patch-signals\ndata: {\"signals\":{\"count\":8}}\n\n",
    "event: datastar-patch-signals\ndata: {\ndata: \"signals\":{\"count\":9,\"new\":true},\ndata: \"onlyIfMissing\":true\ndata: }\n\n",
  ]
    .join(""))
  dom.window.fetch = (async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const byte of payload) controller.enqueue(new Uint8Array([byte]))
          controller.close()
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    )) as unknown as typeof fetch
  const target = await mount(`cell => { cell.target.cell = cell }`)
  const result = dom.window.document.createElement("div")
  result.id = "result"
  dom.window.document.body.append(result)
  await (target as any).cell.request("/stream")

  test
    .expect(dom.window.document.getElementById("result"))
    .toBe(result)
  test
    .expect(result.textContent)
    .toBe("café")
  test
    .expect(runtime.signals.count)
    .toBe(8)
  test
    .expect(runtime.signals.new)
    .toBe(true)
})

test.it.each([undefined, false, true])("SSE stores null values with onlyIfMissing=%s", async (onlyIfMissing) => {
  const patch = { existing: null, added: null, nested: { existing: null, added: null }, items: [null] }
  dom.window.fetch = (async () =>
    new Response(
      `event: datastar-patch-signals\ndata: ${JSON.stringify({ signals: patch, onlyIfMissing })}\n\n`,
      { headers: { "Content-Type": "text/event-stream" } },
    )) as unknown as typeof fetch
  runtime.signals.existing = "keep"
  runtime.signals.nested = { existing: "keep", untouched: true }
  runtime.signals.items = [1]
  const target = await mount(`cell => {
    cell.target.cell = cell
    cell.effect(() => {
      cell.target.textContent = JSON.stringify([cell.signals.existing, "added" in cell.signals, cell.signals.nested.added])
    })
  }`)
  await (target as any).cell.request("/stream")
  await tick()

  test
    .expect(runtime.signals)
    .toEqual({
      existing: onlyIfMissing ? "keep" : null,
      added: null,
      nested: { existing: onlyIfMissing ? "keep" : null, added: null, untouched: true },
      items: onlyIfMissing ? [1] : [null],
    })
  test
    .expect(Object.hasOwn(runtime.signals, "added"))
    .toBe(true)
  test
    .expect(target.textContent)
    .toBe(JSON.stringify([onlyIfMissing ? "keep" : null, true, null]))
})

test.it("new requests and removed cells cancel requests without applying stale responses", async () => {
  const requests: Array<{ signal: AbortSignal; respond: (response: Response) => void }> = []
  dom.window.fetch = ((_url, options) =>
    new Promise<Response>((respond) => {
      requests.push({ signal: options!.signal!, respond })
    })) as typeof fetch
  const target = await mount(`cell => { cell.target.cell = cell }`)
  const first = (target as any).cell.request("/first")
  const second = (target as any).cell.request("/second")
  const result = dom.window.document.createElement("div")
  result.id = "result"
  result.textContent = "original"
  dom.window.document.body.append(result)

  test
    .expect(requests[0].signal.aborted)
    .toBe(true)

  requests[0].respond(new Response("<div id=\"result\">stale</div>", { headers: { "Content-Type": "text/html" } }))
  await first

  test
    .expect(result.textContent)
    .toBe("original")

  target.remove()
  await tick()

  test
    .expect(requests[1].signal.aborted)
    .toBe(true)

  requests[1].respond(new Response("<div id=\"result\">stale</div>", { headers: { "Content-Type": "text/html" } }))
  await second

  test
    .expect(result.textContent)
    .toBe("original")
})

test.it("HTTP errors reject with balanced lifecycle events and no signal mutation", async () => {
  dom.window.fetch = (async () => Response.json({ bad: true }, { status: 500 })) as unknown as typeof fetch
  const target = await mount(`cell => { cell.target.cell = cell }`)
  const phases: Array<string> = []
  target.addEventListener("cell:request", (event: any) => phases.push(event.detail.phase))
  await test.expect((target as any).cell.request("/error")).rejects.toThrow("500")

  test
    .expect(phases)
    .toEqual(["started", "error", "finished"])
  test
    .expect(runtime.signals.bad)
    .toBeUndefined()
})
