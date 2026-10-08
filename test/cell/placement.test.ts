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

test.it.each([false, true])("moves multiple incoming roots in order and mounts each once, SSE=%s", async (sse) => {
  const source = `cell => {
    cell.move('#messages')
    cell.signals.mounts = (cell.signals.mounts ?? 0) + 1
    cell.on('click', () => { cell.signals.clicks = (cell.signals.clicks ?? 0) + 1 })
    return () => { cell.signals.cleanups = (cell.signals.cleanups ?? 0) + 1 }
  }`
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
})

test.it.each(["append", "prepend", "before", "after", "replace"])("move supports %s", async (position) => {
  const document = dom.window.document
  const original = document.getElementById("anchor")!
  await respond(fragment("p", `cell => cell.move('#anchor', '${position}')`, "Incoming", "id=\"incoming\""))
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
})

test.it("move accepts an element and preserves live listeners and cell lifetime", async () => {
  const target = cell.target
  const destination = dom.window.document.getElementById("anchor")!
  let clicks = 0
  cell.on("click", () => {
    clicks++
  })
  cell.move(destination, "prepend")
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

test.it("a moved cell and its descendants can react and make subsequent requests", async () => {
  const child = fragment("span", "cell => cell.effect(() => { cell.target.textContent = cell.signals.count ?? 0 })")
  await respond(fragment(
    "li",
    `cell => {
    cell.move('#messages')
    cell.target.cell = cell
    cell.effect(() => { cell.target.title = String(cell.signals.count ?? 0) })
  }`,
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

test.it.each(["outer", "inner"])("morph %s is one-shot and preserves the destination's cell", async (mode) => {
  const document = dom.window.document
  const destination = document.getElementById("anchor")!
  destination.className = "old"
  destination.innerHTML = "<input id=\"draft\" value=\"initial\"><b>Old</b>"
  destination.setAttribute(
    "data-cell",
    `cell => {
    cell.signals.destinationMounts = (cell.signals.destinationMounts ?? 0) + 1
    cell.on('click', () => { cell.signals.clicked = true })
    return () => { cell.signals.destinationDisposed = true }
  }`,
  )
  await tick()
  const input = document.getElementById("draft") as HTMLInputElement
  input.value = "typed"
  const source = `cell => {
    cell.signals.instructions = (cell.signals.instructions ?? 0) + 1
    cell.morph('#anchor', '${mode}')
    return () => { cell.signals.instructionCleanups = (cell.signals.instructionCleanups ?? 0) + 1 }
  }`
  const html = fragment(
    "div",
    source,
    "<input id=\"draft\" value=\"initial\"><b>New</b>" +
      fragment("span", "cell => { cell.signals.childMounts = (cell.signals.childMounts ?? 0) + 1 }", "Child"),
    "id=\"anchor\" class=\"new\"",
  )
  await respond(html)
  await respond(html)
  ;(destination as HTMLElement).click()

  test
    .expect(document.getElementById("anchor"))
    .toBe(destination)
  test
    .expect(destination.className)
    .toBe(mode === "outer" ? "new" : "old")
  test
    .expect(destination.querySelector("b")!.textContent)
    .toBe("New")
  test
    .expect(runtime.signals.childMounts)
    .toBe(1)
  test
    .expect(document.getElementById("draft"))
    .toBe(input)
  test
    .expect(input.value)
    .toBe("typed")
  test
    .expect(runtime.signals.instructions)
    .toBe(2)
  test
    .expect(runtime.signals.instructionCleanups)
    .toBe(2)
  test
    .expect(runtime.signals.destinationMounts)
    .toBe(1)
  test
    .expect(runtime.signals.destinationDisposed)
    .toBeUndefined()
  test
    .expect(runtime.signals.clicked)
    .toBe(true)
})

test.it("outer morph can change the tag and mounts new child cells once", async () => {
  const source = "cell => { cell.signals.childMounts = (cell.signals.childMounts ?? 0) + 1 }"
  await respond(fragment("section", "cell => cell.morph('#anchor')", fragment("p", source, "Child"), "id=\"anchor\""))
  const destination = dom.window.document.getElementById("anchor")!

  test
    .expect(destination.tagName)
    .toBe("SECTION")
  test
    .expect(destination.hasAttribute("data-cell"))
    .toBe(false)
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

test.it("incoming roots have stable detached targets and listeners and effects work before moving", async () => {
  await respond(fragment(
    "li",
    `cell => {
    const target = cell.target
    window.incomingCell = cell
    window.detachedBeforeMove = !target.isConnected
    cell.on('click', () => { cell.signals.clicks = (cell.signals.clicks ?? 0) + 1 })
    cell.effect(() => { target.title = String(cell.signals.count ?? 7) })
    target.click()
    window.effectBeforeMove = target.title
    cell.move('#messages')
    window.sameTarget = cell.target === target
    return () => { cell.signals.disposed = true }
  }`,
    "Message",
  ))
  const target = dom.window.document.querySelector("#messages li:last-child") as HTMLLIElement
  const incoming = (dom.window as any).incomingCell as Cell

  test
    .expect((dom.window as any).detachedBeforeMove)
    .toBe(true)
  test
    .expect((dom.window as any).effectBeforeMove)
    .toBe("7")
  test
    .expect((dom.window as any).sameTarget)
    .toBe(true)
  test
    .expect(incoming.target)
    .toBe(target)
  test
    .expect(runtime.signals.clicks)
    .toBe(1)

  runtime.signals.count = 9
  await tick()

  test
    .expect(target.title)
    .toBe("9")

  target.remove()
  await tick()

  test
    .expect(incoming.abortSignal.aborted)
    .toBe(true)
  test
    .expect(runtime.signals.disposed)
    .toBe(true)
})

test.it.each([false, true])("unplaced roots never fall back to ID morphing and are disposed, SSE=%s", async (sse) => {
  const anchor = dom.window.document.getElementById("anchor")!
  const source = `cell => {
    window.incomingCell = cell
    window.detached = !cell.target.isConnected
    cell.signals.setups = (cell.signals.setups ?? 0) + 1
    cell.on('click', () => { cell.signals.clicked = true })
    cell.effect(() => {
      cell.target.title = 'effect ran'
      return () => { cell.signals.effectCleanups = (cell.signals.effectCleanups ?? 0) + 1 }
    })
    cell.limit(() => { cell.signals.late = true }, { debounce: 0 })()
    return () => { cell.signals.cleanups = (cell.signals.cleanups ?? 0) + 1 }
  }`
  await respond(fragment("div", source, "Unplaced", "id=\"anchor\""), sse)
  await respond(fragment("div", source, "Unplaced", "id=\"anchor\""), sse)
  const incoming = (dom.window as any).incomingCell as Cell<HTMLElement>
  incoming.target.click()

  test
    .expect((dom.window as any).detached)
    .toBe(true)
  test
    .expect(dom.window.document.getElementById("anchor"))
    .toBe(anchor)
  test
    .expect(anchor.textContent)
    .toBe("Anchor")
  test
    .expect(incoming.target)
    .not
    .toBe(anchor)
  test
    .expect(incoming.target.title)
    .toBe("effect ran")
  test
    .expect(incoming.abortSignal.aborted)
    .toBe(true)
  test
    .expect(runtime.signals.setups)
    .toBe(2)
  test
    .expect(runtime.signals.cleanups)
    .toBe(2)
  test
    .expect(runtime.signals.effectCleanups)
    .toBe(2)
  test
    .expect(runtime.signals.clicked)
    .toBeUndefined()
  test
    .expect(runtime.signals.late)
    .toBeUndefined()
})

test.it("incoming templates can expand before moving, and dispose their rows on removal", async () => {
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
    `cell => {
    cell.expand(() => cell.signals.items)
    cell.move('#messages')
  }`,
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
      fragment("li", "cell => cell.move('#new-messages')", "New message"),
  )

  test
    .expect(dom.window.document.querySelector("#new-messages li")!.textContent)
    .toBe("New message")
})

test.it("unplaced incoming cells abort requests started during setup", async () => {
  let signal: AbortSignal | undefined
  const html = fragment(
    "div",
    `cell => {
    window.background = cell.request('/background')
  }`,
  )
  dom.window.fetch = (async (url, options) => {
    if (String(url).endsWith("/patch")) return new Response(html, { headers: { "Content-Type": "text/html" } })
    signal = options!.signal!
    return new Promise<Response>((_, reject) => {
      signal!.addEventListener("abort", () => reject(new Error("cancelled")), { once: true })
    })
  }) as typeof fetch
  await cell.request("/patch")
  await (dom.window as any).background

  test
    .expect(signal?.aborted)
    .toBe(true)
})

test.it("one-shot morph effects run immediately and are cleaned up with the detached wrapper", async () => {
  const document = dom.window.document
  const destination = document.getElementById("anchor")!
  runtime.signals.title = "Before"
  await respond(fragment(
    "div",
    `cell => {
    const target = cell.target
    window.instructionCell = cell
    cell.effect(() => {
      target.title = cell.signals.title
      return () => { cell.signals.effectCleanups = (cell.signals.effectCleanups ?? 0) + 1 }
    })
    cell.morph('#anchor')
    window.sameInstructionTarget = cell.target === target && !target.isConnected
  }`,
    "Updated",
    "id=\"anchor\"",
  ))
  runtime.signals.title = "After"
  await tick()
  const instruction = (dom.window as any).instructionCell as Cell

  test
    .expect(document.getElementById("anchor"))
    .toBe(destination)
  test
    .expect(destination.title)
    .toBe("Before")
  test
    .expect((dom.window as any).sameInstructionTarget)
    .toBe(true)
  test
    .expect(instruction.abortSignal.aborted)
    .toBe(true)
  test
    .expect(runtime.signals.effectCleanups)
    .toBe(1)
})

test.it("missing destinations report an error and dispose detached setup", async () => {
  await respond(fragment(
    "li",
    `cell => {
    cell.abortSignal.addEventListener('abort', () => { cell.signals.disposed = true })
    cell.move('#missing')
  }`,
    "Lost",
  ))

  test
    .expect(String(errors.shift()))
    .toContain("Cell move destination not found")
  test
    .expect(runtime.signals.disposed)
    .toBe(true)
  test
    .expect(dom.window.document.body.textContent)
    .not
    .toContain("Lost")
})
