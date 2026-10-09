import * as test from "bun:test"
import { start } from "effect-start/cell"
import type { Cell, Runtime } from "effect-start/cell"
import { JSDOM } from "jsdom"

let dom: JSDOM
let runtime: Runtime
let cell: Cell
let errors: Array<unknown>

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

const fragment = (tag: string, source: string, children = "", attributes = "") => {
  const template = dom.window.document.createElement("template")
  template.innerHTML = `<${tag} ${attributes}>${children}</${tag}>`
  template.content.firstElementChild!.setAttribute("data-cell", source)
  return template.innerHTML
}

const respond = async (html: string, sse = false) => {
  dom.window.fetch = (async () =>
    sse
      ? new Response(
        `event: datastar-patch-elements\n${html.split("\n").map((line) => `data: ${line}`).join("\n")}\n\n`,
        {
          headers: { "Content-Type": "text/event-stream" },
        },
      )
      : new Response(html, { headers: { "Content-Type": "text/html" } })) as unknown as typeof fetch
  await cell.request("/patch")
  await tick()
}

test.beforeEach(() => {
  dom = new JSDOM(
    "<!doctype html><html><body><button id=\"request\"></button><ol id=\"messages\"><li>First</li></ol><div id=\"anchor\">Anchor</div></body></html>",
    {
      url: "http://localhost/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  )
  errors = []
  dom.window.document.getElementById("request")!.setAttribute("data-cell", "cell => { cell.target.cell = cell }")
  runtime = start(dom.window.document, { onError: (error) => errors.push(error) })
  cell = (dom.window.document.getElementById("request") as any).cell
})

test.afterEach(() => {
  runtime.stop()
  dom.window.close()

  test
    .expect(errors)
    .toEqual([])
})

test.it.each([false, true])(
  "appends response roots in order and initializes each once on the DOM, SSE=%s",
  async (sse) => {
    const source = `{ append: "#messages", setup: cell => {
    if (!cell.target.isConnected) throw new Error("Detached setup")
    cell.signals.mounts = (cell.signals.mounts ?? 0) + 1
    cell.on('click', () => { cell.signals.clicks = (cell.signals.clicks ?? 0) + 1 })
    return () => { cell.signals.cleanups = (cell.signals.cleanups ?? 0) + 1 }
  } }`
    await respond(fragment("li", source, "Second") + fragment("li", source, "Third"), sse)
    const list = dom.window.document.getElementById("messages")!
    const second = list.children[1] as HTMLElement
    second.click()

    test
      .expect(Array.from(list.children, (child) => child.textContent))
      .toEqual(["First", "Second", "Third"])
    test
      .expect(runtime.signals.mounts)
      .toBe(2)
    test
      .expect(runtime.signals.clicks)
      .toBe(1)

    list.prepend(second)
    await tick()

    test
      .expect(runtime.signals.mounts)
      .toBe(2)
    test
      .expect(runtime.signals.cleanups)
      .toBeUndefined()

    second.remove()
    await tick()
    second.click()

    test
      .expect(runtime.signals.cleanups)
      .toBe(1)
    test
      .expect(runtime.signals.clicks)
      .toBe(1)
  },
)

test.it.each(["append", "prepend", "before", "after", "replace"])(
  "placement supports %s without setup",
  async (position) => {
    const document = dom.window.document
    const original = document.getElementById("anchor")!
    await respond(fragment("p", `{ ${position}: "#anchor" }`, "Incoming", "id=\"incoming\""))
    const incoming = document.getElementById("incoming")!

    test
      .expect(incoming)
      .not
      .toBeNull()

    if (position === "append") {
      test
        .expect(original.lastChild)
        .toBe(incoming)
    } else if (position === "prepend") {
      test
        .expect(original.firstChild)
        .toBe(incoming)
    } else if (position === "before") {
      test
        .expect(incoming.nextSibling)
        .toBe(original)
    } else if (position === "after") {
      test
        .expect(incoming.previousSibling)
        .toBe(original)
    } else {test
        .expect(document.getElementById("anchor"))
        .toBeNull()}
  },
)

test.it("native moves preserve live listeners and cell lifetime", async () => {
  const target = cell.target
  const destination = dom.window.document.getElementById("anchor")!
  let clicks = 0
  cell.on("click", () => {
    clicks++
  })
  destination.prepend(target)
  await tick()
  ;(target as HTMLElement).click()

  test
    .expect(target.parentNode)
    .toBe(destination)
  test
    .expect(cell.abortSignal.aborted)
    .toBe(false)
  test
    .expect(clicks)
    .toBe(1)
})

test.it("an appended cell and its descendants can react and make subsequent requests", async () => {
  const child = fragment("span", "cell => cell.effect(() => { cell.target.textContent = cell.signals.count ?? 0 })")
  await respond(fragment(
    "li",
    `{ append: "#messages", setup: cell => {
    cell.target.cell = cell
    cell.effect(() => { cell.target.title = String(cell.signals.count ?? 0) })
  } }`,
    child,
  ))
  runtime.signals.count = 5
  await tick()
  const target = dom.window.document.querySelector("#messages li:last-child")!
  dom.window.fetch = (async () => new Response(null, { status: 204 })) as unknown as typeof fetch
  await (target as any).cell.request("/next")

  test
    .expect(target.getAttribute("title"))
    .toBe("5")
  test
    .expect(target.querySelector("span")!.textContent)
    .toBe("5")
})

test.it.each(["morph", "morphChildren"])(
  "%s initializes final root behavior and preserves unchanged nested cells",
  async (operation) => {
    const document = dom.window.document
    const destination = document.getElementById("anchor")!
    const child = fragment(
      "span",
      `cell => {
    cell.signals.childMounts = (cell.signals.childMounts ?? 0) + 1
    return () => { cell.signals.childDisposed = true }
  }`,
      "Child",
      "id=\"child\"",
    )
    destination.className = "old"
    destination.innerHTML = "<input id=\"draft\" value=\"initial\">" + child
    destination.setAttribute(
      "data-cell",
      `cell => {
    cell.signals.oldMounts = (cell.signals.oldMounts ?? 0) + 1
    cell.on('click', () => { cell.signals.oldClicked = true })
    return () => { cell.signals.oldDisposed = true }
  }`,
    )
    await tick()
    const input = document.getElementById("draft") as HTMLInputElement
    const originalChild = document.getElementById("child")!
    input.value = "typed"
    const source = `{ ${operation}: "#anchor", setup: cell => {
    if (!cell.target.isConnected) throw new Error("Detached setup")
    if (!cell.signals.oldDisposed) throw new Error("Previous setup is still active")
    const input = cell.target.querySelector('input')
    cell.target.cell = cell
    cell.signals.mounts = (cell.signals.mounts ?? 0) + 1
    cell.effect(() => { cell.target.title = cell.signals.title ?? 'ready' })
    cell.on('click', () => { cell.signals.readValue = input.value })
    return () => { cell.signals.disposed = true }
  } }`
    const html = fragment(
      "div",
      source,
      "<input id=\"draft\" value=\"initial\"><b>New</b>" + child,
      "id=\"anchor\" class=\"new\"",
    )
    await respond(html)
    const owner = (destination as any).cell as Cell
    await respond(html)
    ;(destination as HTMLElement).click()
    runtime.signals.title = "updated"
    await tick()

    test
      .expect(document.getElementById("anchor"))
      .toBe(destination)
    test
      .expect(destination.className)
      .toBe(operation === "morph" ? "new" : "old")
    test
      .expect(destination.querySelector("b")!.textContent)
      .toBe("New")
    test
      .expect(document.getElementById("draft"))
      .toBe(input)
    test
      .expect(document.getElementById("child"))
      .toBe(originalChild)
    test
      .expect(runtime.signals.readValue)
      .toBe("typed")
    test
      .expect(runtime.signals.mounts)
      .toBe(1)
    test
      .expect(runtime.signals.childMounts)
      .toBe(1)
    test
      .expect(runtime.signals.childDisposed)
      .toBeUndefined()
    test
      .expect(runtime.signals.oldClicked)
      .toBeUndefined()
    test
      .expect(runtime.signals.disposed)
      .toBeUndefined()
    test
      .expect(owner.target)
      .toBe(destination)
    test
      .expect(owner.abortSignal.aborted)
      .toBe(false)
    test
      .expect(destination.title)
      .toBe("updated")
  },
)

test.it("explicit outer morph can change the tag and initializes root and child behavior once", async () => {
  const source = "cell => { cell.signals.childMounts = (cell.signals.childMounts ?? 0) + 1 }"
  await respond(fragment(
    "section",
    `{ morph: "#anchor", setup: cell => {
    cell.target.cell = cell
    cell.signals.rootMounts = (cell.signals.rootMounts ?? 0) + 1
  } }`,
    fragment("p", source, "Child"),
    "id=\"anchor\"",
  ))
  const destination = dom.window.document.getElementById("anchor")!

  test
    .expect(destination.tagName)
    .toBe("SECTION")
  test
    .expect((destination as any).cell.target)
    .toBe(destination)
  test
    .expect(runtime.signals.rootMounts)
    .toBe(1)
  test
    .expect(runtime.signals.childMounts)
    .toBe(1)
})

test.it("ordinary roots morph by ID and preserve nested cell setup", async () => {
  const source = `cell => {
    const target = cell.target
    target.cell = cell
    cell.signals.setups = (cell.signals.setups ?? 0) + 1
    cell.effect(() => { target.title = String(cell.signals.count ?? 0) })
    cell.on('click', () => { cell.signals.clicked = true })
  }`
  const anchor = dom.window.document.getElementById("anchor")!
  await respond(`<div id="anchor">${fragment("button", source, "One", "id=\"behavior\"")}</div>`)
  const target = dom.window.document.getElementById("behavior") as HTMLButtonElement
  await respond(`<div id="anchor">${fragment("button", source, "Two", "id=\"behavior\"")}</div>`)
  runtime.signals.count = 3
  await tick()
  target.click()

  test
    .expect(dom.window.document.getElementById("anchor"))
    .toBe(anchor)
  test
    .expect(dom.window.document.getElementById("behavior"))
    .toBe(target)
  test
    .expect(target.textContent)
    .toBe("Two")
  test
    .expect(target.getAttribute("title"))
    .toBe("3")
  test
    .expect(runtime.signals.setups)
    .toBe(1)
  test
    .expect(runtime.signals.clicked)
    .toBe(true)
  test
    .expect((target as any).cell.target)
    .toBe(target)
})

test.it.each([false, true])(
  "function roots morph by ID and initialize only once on the final element, SSE=%s",
  async (sse) => {
    const anchor = dom.window.document.getElementById("anchor")!
    const source = `cell => {
    if (!cell.target.isConnected) throw new Error("Detached setup")
    cell.target.cell = cell
    cell.signals.setups = (cell.signals.setups ?? 0) + 1
    cell.effect(() => {
      cell.target.title = cell.signals.title ?? 'ready'
      window.effects = (window.effects ?? 0) + 1
    })
    cell.on('click', () => { cell.signals.clicked = true })
  }`
    await respond(fragment("div", source, "Updated", "id=\"anchor\""), sse)
    await respond(fragment("div", source, "Again", "id=\"anchor\""), sse)
    ;(anchor as HTMLElement).click()

    test
      .expect(dom.window.document.getElementById("anchor"))
      .toBe(anchor)
    test
      .expect(anchor.textContent)
      .toBe("Again")
    test
      .expect(runtime.signals.setups)
      .toBe(1)
    test
      .expect((dom.window as any).effects)
      .toBe(1)
    test
      .expect(runtime.signals.clicked)
      .toBe(true)
    test
      .expect((anchor as any).cell.target)
      .toBe(anchor)
  },
)

test.it("unmatched response roots never execute setup or start work", async () => {
  const source = `cell => {
    cell.signals.executed = true
    cell.request('/background')
  }`
  await respond(fragment("div", source, "Ignored", "id=\"missing\""))
  await respond(fragment("div", `{ setup: ${source} }`, "Ignored"))

  test
    .expect(runtime.signals.executed)
    .toBeUndefined()
  test
    .expect(dom.window.document.body.textContent)
    .not
    .toContain("Ignored")
})

test.it("incoming templates expand after placement and dispose their rows on removal", async () => {
  runtime.signals.items = ["One", "Two"]
  const row = fragment(
    "li",
    `cell => {
    cell.target.textContent = cell.item
    return () => { cell.signals.removed = (cell.signals.removed ?? 0) + 1 }
  }`,
  )
  await respond(fragment(
    "template",
    `{ append: "#messages", setup: cell => {
    cell.expand(() => cell.signals.items)
  } }`,
    row,
  ))
  const list = dom.window.document.getElementById("messages")!

  test
    .expect(Array.from(list.querySelectorAll("li"), (row) => row.textContent))
    .toEqual(["First", "One", "Two"])

  list.querySelector("template")!.remove()
  await tick()

  test
    .expect(Array.from(list.querySelectorAll("li"), (row) => row.textContent))
    .toEqual(["First"])
  test
    .expect(runtime.signals.removed)
    .toBe(2)
})

test.it("mixed response roots are applied in order", async () => {
  await respond(
    "<div id=\"anchor\"><ol id=\"new-messages\"></ol></div>" +
      fragment("li", "{ append: \"#new-messages\" }", "New message"),
  )

  test
    .expect(dom.window.document.querySelector("#new-messages li")!.textContent)
    .toBe("New message")
})

test.it("morphChildren without setup preserves the destination wrapper and its behavior", async () => {
  const target = dom.window.document.getElementById("anchor")!
  const source = `cell => {
    cell.signals.mounts = (cell.signals.mounts ?? 0) + 1
    cell.on('click', () => { cell.signals.clicked = true })
  }`
  target.setAttribute("data-cell", source)
  await tick()
  await respond(fragment("section", "{ morphChildren: \"#anchor\" }", "<b>New</b>"))
  ;(target as HTMLElement).click()

  test
    .expect(target.tagName)
    .toBe("DIV")
  test
    .expect(target.innerHTML)
    .toBe("<b>New</b>")
  test
    .expect(target.getAttribute("data-cell"))
    .toBe(source)
  test
    .expect(runtime.signals.mounts)
    .toBe(1)
  test
    .expect(runtime.signals.clicked)
    .toBe(true)
})

test.it("replace disposes the previous cell and initializes a new element even with identical setup", async () => {
  const source = `{ replace: "#anchor", setup: cell => {
    cell.signals.mounts = (cell.signals.mounts ?? 0) + 1
    cell.target.cell = cell
    return () => { cell.signals.cleanups = (cell.signals.cleanups ?? 0) + 1 }
  } }`
  const target = dom.window.document.getElementById("anchor")!
  target.setAttribute("data-cell", source)
  await tick()
  const previous = (target as any).cell as Cell
  await respond(fragment("div", source, "New", "id=\"anchor\""))
  const next = dom.window.document.getElementById("anchor")!

  test
    .expect(next)
    .not
    .toBe(target)
  test
    .expect(previous.abortSignal.aborted)
    .toBe(true)
  test
    .expect((next as any).cell.abortSignal.aborted)
    .toBe(false)
  test
    .expect(runtime.signals.mounts)
    .toBe(2)
  test
    .expect(runtime.signals.cleanups)
    .toBe(1)
})

test.it("root and nested cells follow the same setup-change and attribute-removal lifecycle", async () => {
  const source = `cell => {
    cell.signals.mounts = (cell.signals.mounts ?? 0) + 1
    cell.on('click', () => { cell.signals.clicks = (cell.signals.clicks ?? 0) + 1 })
    return () => { cell.signals.cleanups = (cell.signals.cleanups ?? 0) + 1 }
  }`
  const first = fragment("div", source, fragment("button", source, "Child", "id=\"child\""), "id=\"anchor\"")
  await respond(first)
  await respond(first)

  test
    .expect(runtime.signals.mounts)
    .toBe(2)
  test
    .expect(runtime.signals.cleanups)
    .toBeUndefined()

  await respond(
    fragment("div", source + " ", fragment("button", source + " ", "Child", "id=\"child\""), "id=\"anchor\""),
  )

  test
    .expect(runtime.signals.mounts)
    .toBe(4)
  test
    .expect(runtime.signals.cleanups)
    .toBe(2)

  await respond("<div id=\"anchor\"><button id=\"child\">Child</button></div>")
  ;(dom.window.document.getElementById("child") as HTMLElement).click()

  test
    .expect(runtime.signals.cleanups)
    .toBe(4)
  test
    .expect(runtime.signals.clicks)
    .toBeUndefined()
})

test.it("nested declarations initialize in place without replaying response placement", async () => {
  await respond(
    "<div id=\"anchor\">" + fragment(
      "button",
      `{ append: "#messages", setup: cell => {
    cell.signals.parent = cell.target.parentElement.id
  } }`,
      "Child",
    ) + "</div>",
  )

  test
    .expect(runtime.signals.parent)
    .toBe("anchor")
  test
    .expect(dom.window.document.querySelector("#anchor button")!.textContent)
    .toBe("Child")
  test
    .expect(dom.window.document.getElementById("messages")!.textContent)
    .toBe("First")
})

test.it("a full-document SSE morph preserves its unchanged connection-owning cell", async () => {
  const document = dom.window.document
  let stream!: ReadableStreamDefaultController<Uint8Array>
  let signal: AbortSignal | undefined
  let requests = 0
  dom.window.fetch = (async (_url, options) => {
    requests++
    signal = options!.signal!
    return new Response(
      new ReadableStream({
        start(controller) {
          stream = controller
        },
      }),
      {
        headers: { "Content-Type": "text/event-stream" },
      },
    )
  }) as typeof fetch
  const owner = document.createElement("div")
  owner.id = "connection"
  owner.setAttribute(
    "data-cell",
    `cell => {
    cell.signals.connections = (cell.signals.connections ?? 0) + 1
    cell.target.cell = cell
    window.connection = cell.request('/events')
  }`,
  )
  document.body.append(owner)
  await tick()
  const connection = (owner as any).cell as Cell
  const html = document.documentElement.outerHTML.replace(
    "<div id=\"anchor\">Anchor</div>",
    "<div id=\"anchor\">Updated</div>",
  )
  stream.enqueue(new TextEncoder().encode(
    `event: datastar-patch-elements\n${html.split("\n").map((line) => `data: ${line}`).join("\n")}\n\n`,
  ))
  await tick()
  stream.enqueue(
    new TextEncoder().encode("event: datastar-patch-signals\ndata: {\"signals\":{\"continued\":true}}\n\n"),
  )
  await tick()

  test
    .expect(document.getElementById("connection"))
    .toBe(owner)
  test
    .expect(document.getElementById("anchor")!.textContent)
    .toBe("Updated")
  test
    .expect(runtime.signals.connections)
    .toBe(1)
  test
    .expect(runtime.signals.continued)
    .toBe(true)
  test
    .expect(requests)
    .toBe(1)
  test
    .expect(signal!.aborted)
    .toBe(false)
  test
    .expect(connection.abortSignal.aborted)
    .toBe(false)

  owner.remove()
  await tick()
  await (dom.window as any).connection

  test
    .expect(signal!.aborted)
    .toBe(true)
})
