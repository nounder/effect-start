import * as test from "bun:test"
import { start } from "effect-start/cell"
import type { Cell, Runtime } from "effect-start/cell"
import { JSDOM } from "jsdom"

let dom: JSDOM
let runtime: Runtime
let cell: Cell<HTMLButtonElement>
let phases: Array<string>

const flush = async () => {
  for (let index = 0; index < 30; index++) await Promise.resolve()
}

const advance = async (milliseconds: number) => {
  test.jest.advanceTimersByTime(milliseconds)
  await flush()
}

const sse = (data: string) => new Response(data, { headers: { "Content-Type": "text/event-stream" } })

test.beforeEach(() => {
  dom = new JSDOM(
    "<!doctype html><html><head><title>Old</title></head><body><button id=\"cell\"></button></body></html>",
    {
      url: "http://localhost/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  )
  dom.window.document.getElementById("cell")!.setAttribute("data-cell", "cell => { cell.target.cell = cell }")
  runtime = start(dom.window.document)
  cell = (dom.window.document.getElementById("cell") as any).cell
  phases = []
  cell.target.addEventListener("cell:request", (event: any) => phases.push(event.detail.phase))
  test.jest.useFakeTimers()
})

test.afterEach(() => {
  runtime.stop()
  dom.window.close()
  test.jest.useRealTimers()
})

test.it("network retries back off, cap the delay, and stop at the configured limit", async () => {
  let calls = 0
  const delays: Array<number> = []
  cell.target.addEventListener("cell:request", (event: any) => {
    if (event.detail.phase === "retrying") delays.push(event.detail.delay)
  })
  dom.window.fetch = (async () => {
    calls++
    throw new TypeError("offline")
  }) as unknown as typeof fetch
  const result = cell.request("/stream", { retryInterval: 10, retryMaxWait: 25, retryMaxCount: 3 }).catch((error) =>
    error
  )
  await flush()

  test
    .expect(calls)
    .toBe(1)

  await advance(9)

  test
    .expect(calls)
    .toBe(1)

  await advance(1)
  await advance(20)
  await advance(25)

  test
    .expect(calls)
    .toBe(4)
  test
    .expect(delays)
    .toEqual([10, 20, 25])
  test
    .expect((await result).message)
    .toBe("Cell request reached maximum retries")
  test
    .expect(phases)
    .toEqual(["started", "retrying", "retrying", "retrying", "retries-failed", "error", "finished"])
  test
    .expect(test.jest.getTimerCount())
    .toBe(0)
})

test.it("a successful connection resets retry limits and retries preserve explicit request data", async () => {
  let calls = 0
  let stream!: ReadableStreamDefaultController<Uint8Array>
  const body = JSON.stringify({ count: 7 })
  dom.window.fetch = (async (url, options) => {
    calls++

    test
      .expect(String(url))
      .toBe("http://localhost/stream?q=explicit")
    test
      .expect(options?.body)
      .toBe(body)
    test
      .expect(options?.method)
      .toBe("POST")
    test
      .expect(new Headers(options?.headers).get("X-Custom"))
      .toBe("explicit")
    test
      .expect(Object.hasOwn(options!, "retryMaxCount"))
      .toBe(false)

    if (calls === 1) throw new TypeError("offline")
    if (calls === 2) {
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            stream = controller
          },
        }),
        {
          headers: { "Content-Type": "text/event-stream" },
        },
      )
    }
    return new Response(null, { status: 204 })
  }) as typeof fetch
  const request = cell.request("/stream?q=explicit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Custom": "explicit" },
    body,
    retryMaxCount: 1,
  })
  await flush()
  await advance(1000)
  stream.error(new TypeError("disconnected"))
  await flush()
  await advance(999)

  test
    .expect(calls)
    .toBe(2)

  await advance(1)
  await request

  test
    .expect(calls)
    .toBe(3)
})

test.it("SSE retries resume using event IDs and the server delay, and empty IDs clear the header", async () => {
  const ids: Array<string | null> = []
  let stream!: ReadableStreamDefaultController<Uint8Array>
  dom.window.fetch = (async (_url, options) => {
    ids.push(new Headers(options?.headers).get("Last-Event-ID"))
    if (ids.length === 1) {
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            stream = controller
            controller.enqueue(
              new TextEncoder().encode(
                "id: 42\r\nretry: 7\r\nevent: datastar-patch-signals\r\ndata: signals {\"count\":1}\r\n\r\n",
              ),
            )
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      )
    }
    if (ids.length === 2) return sse("id:\nretry: invalid\nretry: -1\nretry: 1.5\n\n")
    return new Response(null, { status: 204 })
  }) as typeof fetch
  const request = cell.request("/stream", { retry: "always" })
  await flush()

  test
    .expect(runtime.signals.count)
    .toBe(1)

  stream.error(new TypeError("connection lost"))
  await flush()
  await advance(6)

  test
    .expect(ids)
    .toEqual([null])

  await advance(1)

  test
    .expect(ids)
    .toEqual([null, "42"])

  await advance(7)
  await request

  test
    .expect(ids)
    .toEqual([null, "42", null])
  test
    .expect(phases)
    .toEqual(["started", "retrying", "retrying", "finished"])
})

test.it.each(["auto", "error", "never"] as const)("a clean SSE close finishes with retry=%s", async (retry) => {
  let calls = 0
  dom.window.fetch = (async () => {
    calls++
    return sse("")
  }) as unknown as typeof fetch
  await cell.request("/stream", { retry })
  await advance(60_000)

  test
    .expect(calls)
    .toBe(1)
  test
    .expect(phases)
    .toEqual(["started", "finished"])
})

test.it("retry never disables network retries", async () => {
  dom.window.fetch = (async () => {
    throw new TypeError("offline")
  }) as unknown as typeof fetch
  await test.expect(cell.request("/stream", { retry: "never" })).rejects.toThrow("offline")

  test
    .expect(test.jest.getTimerCount())
    .toBe(0)
})

test.it.each(["error", "always"] as const)("retry=%s retries HTTP errors and stops on 204", async (retry) => {
  let calls = 0
  dom.window.fetch = (async () => new Response(null, { status: ++calls === 1 ? 503 : 204 })) as unknown as typeof fetch
  const request = cell.request("/stream", { retry, retryInterval: 10 })
  await flush()
  await advance(10)
  await request

  test
    .expect(calls)
    .toBe(2)
  test
    .expect(test.jest.getTimerCount())
    .toBe(0)
})

test.it.each(["external", "unmount", "supersede", "stop"])("%s cancels a pending retry", async (kind) => {
  let calls = 0
  dom.window.fetch = (async () => {
    calls++
    throw new TypeError("offline")
  }) as unknown as typeof fetch
  const controller = new dom.window.AbortController()
  const request = cell.request("/stream", { signal: controller.signal })
  await flush()

  test
    .expect(test.jest.getTimerCount())
    .toBe(1)

  if (kind === "external") controller.abort()
  else if (kind === "unmount") cell.target.remove()
  else if (kind === "stop") runtime.stop()
  else {
    dom.window.fetch = (async () => new Response(null, { status: 204 })) as unknown as typeof fetch
    await cell.request("/other")
  }
  await flush()
  await request
  await advance(60_000)

  test
    .expect(calls)
    .toBe(1)
  test
    .expect(test.jest.getTimerCount())
    .toBe(0)
})

test.it("openWhenHidden false pauses a live stream and resumes with the last event ID", async () => {
  let hidden = false
  Object.defineProperty(dom.window.document, "hidden", { get: () => hidden })
  const ids: Array<string | null> = []
  let cancelled = false
  dom.window.fetch = (async (_url, options) => {
    ids.push(new Headers(options?.headers).get("Last-Event-ID"))
    if (ids.length > 1) return new Response(null, { status: 204 })
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("id: visible\n\n"))
        },
        cancel() {
          cancelled = true
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    )
  }) as typeof fetch
  const request = cell.request("/stream", { openWhenHidden: false })
  await flush()
  hidden = true
  dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"))
  await flush()

  test
    .expect(cancelled)
    .toBe(true)

  await advance(60_000)

  test
    .expect(ids)
    .toEqual([null])

  hidden = false
  dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"))
  await request

  test
    .expect(ids)
    .toEqual([null, "visible"])
})

test.it("a request paused with openWhenHidden false can be cancelled before fetching", async () => {
  Object.defineProperty(dom.window.document, "hidden", { value: true })
  let calls = 0
  dom.window.fetch = (async () => {
    calls++
    return sse("")
  }) as unknown as typeof fetch
  const request = cell.request("/stream", { openWhenHidden: false })
  runtime.stop()
  await request

  test
    .expect(calls)
    .toBe(0)
})

test.it.each(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"])("%s starts while hidden by default", async (method) => {
  Object.defineProperty(dom.window.document, "hidden", { value: true })
  dom.window.fetch = (async () => sse("")) as unknown as typeof fetch
  await cell.request("/stream", { method })

  test
    .expect(phases)
    .toEqual(["started", "finished"])
})

test.it("switching tabs does not abort or restart a stream by default", async () => {
  let hidden = false
  Object.defineProperty(dom.window.document, "hidden", { get: () => hidden })
  let calls = 0
  let signal: AbortSignal | undefined
  let stream!: ReadableStreamDefaultController<Uint8Array>
  dom.window.fetch = (async (_url, options) => {
    calls++
    signal = options?.signal ?? undefined
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          stream = controller
        },
      }),
      {
        headers: { "Content-Type": "text/event-stream" },
      },
    )
  }) as typeof fetch
  const request = cell.request("/stream")
  await flush()
  for (const nextHidden of [true, false]) {
    hidden = nextHidden
    dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"))
    await flush()

    test
      .expect(signal?.aborted)
      .toBe(false)
    test
      .expect(calls)
      .toBe(1)
  }
  stream.close()
  await request
})

test.it("malformed signal patches reject without retrying", async () => {
  dom.window.fetch =
    (async () => sse("event: datastar-patch-signals\ndata: signals invalid\n\n")) as unknown as typeof fetch
  await test.expect(cell.request("/stream", { retry: "always" })).rejects.toThrow()

  test
    .expect(test.jest.getTimerCount())
    .toBe(0)
})

test.it.each(["HTML", "SSE"])(
  "%s morphs a full document while preserving mounted cells and dirty inputs",
  async (kind) => {
    const document = dom.window.document
    document.body.insertAdjacentHTML("beforeend", "<input id=\"field\" value=\"initial\"><p id=\"obsolete\">old</p>")
    const input = document.getElementById("field") as HTMLInputElement
    input.value = "typed"
    const html =
      `<!doctype html><html lang="en"><head><title>New</title><meta name="description" content="updated"></head><body class="new"><main>${cell.target.outerHTML}<input id="field" value="initial"></main><footer>New footer</footer></body></html>`
    dom.window.fetch = (async () =>
      kind === "SSE"
        ? sse(`event: datastar-patch-elements\ndata: elements ${html}\n\n`)
        : new Response(html, { headers: { "Content-Type": "text/html" } })) as unknown as typeof fetch
    await cell.request("/page")
    await flush()

    test
      .expect(document.title)
      .toBe("New")
    test
      .expect(document.documentElement.lang)
      .toBe("en")
    test
      .expect(document.body.className)
      .toBe("new")
    test
      .expect(document.querySelector("meta[name=\"description\"]")!.getAttribute("content"))
      .toBe("updated")
    test
      .expect(document.getElementById("obsolete"))
      .toBeNull()
    test
      .expect(document.querySelector("footer")!.textContent)
      .toBe("New footer")
    test
      .expect(document.getElementById("cell"))
      .toBe(cell.target)
    test
      .expect((cell.target as any).cell)
      .toBe(cell)
    test
      .expect(cell.abortSignal.aborted)
      .toBe(false)
    test
      .expect(document.getElementById("field"))
      .toBe(input)
    test
      .expect(input.value)
      .toBe("typed")
    test
      .expect(document.doctype!.name)
      .toBe("html")
    test
      .expect(document.documentElement.children.length)
      .toBe(2)
  },
)

test.it.each(["head", "body", "both"])("morphs standalone %s markup without IDs", async (kind) => {
  const document = dom.window.document
  const oldHead = document.head
  const oldBody = document.body
  const html = (kind !== "body" ? "<head><title>Updated</title></head>" : "")
    + (kind !== "head" ? "<body class=\"updated\"><article>Body</article></body>" : "")
  dom.window.fetch = (async () =>
    new Response(html, { headers: { "Content-Type": "text/html" } })) as unknown as typeof fetch
  await cell.request("/page")
  await flush()

  test
    .expect(document.head)
    .toBe(oldHead)
  test
    .expect(document.body)
    .toBe(oldBody)
  test
    .expect(document.title)
    .toBe(kind === "body" ? "Old" : "Updated")
  test
    .expect(document.body.className)
    .toBe(kind === "head" ? "" : "updated")
  test
    .expect(cell.abortSignal.aborted)
    .toBe(kind !== "head")
})
