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

test.it.each(["record", "pairs", "URLSearchParams", "string"])(
  "urlParams accepts %s, replaces supplied keys, and preserves other URL components",
  async (kind) => {
    const pairs: Array<[string, string]> = [["q", "Ada & Łódź + #?"], ["tag", "first"]]
    if (kind !== "record") pairs.push(["tag", "second"])
    const urlParams = kind === "record" ?
      { q: pairs[0][1], tag: "first" }
      : kind === "URLSearchParams" ?
      new URLSearchParams(pairs)
      : kind === "string" ?
      new URLSearchParams(pairs).toString()
      : pairs
    const url = new URL("http://localhost/search?q=old&tag=old&keep=yes&keep=also#results")
    let requestedUrl: URL | undefined
    let init: RequestInit | undefined
    dom.window.fetch = (async (input, options) => {
      requestedUrl = new URL(String(input))
      init = options
      return new Response(null, { status: 204 })
    }) as typeof fetch
    await cell.request(url, { urlParams })

    test
      .expect(Array.from(requestedUrl!.searchParams.entries()))
      .toEqual([["keep", "yes"], ["keep", "also"], ...pairs])
    test
      .expect(requestedUrl!.hash)
      .toBe("#results")
    test
      .expect(url.href)
      .toBe("http://localhost/search?q=old&tag=old&keep=yes&keep=also#results")
    test
      .expect(Object.hasOwn(init!, "urlParams"))
      .toBe(false)
    test
      .expect(init?.body)
      .toBeUndefined()
  },
)

test.it("empty urlParams preserves existing parameters", async () => {
  let requestedUrl: URL | undefined
  dom.window.fetch = (async (input) => {
    requestedUrl = new URL(String(input))
    return new Response(null, { status: 204 })
  }) as typeof fetch
  await cell.request("/search?q=hello%20world&tag=one&tag=two", { urlParams: {} })

  test
    .expect(requestedUrl!.href)
    .toBe("http://localhost/search?q=hello%20world&tag=one&tag=two")
})

test.it.each([{ count: 2, nested: { _included: true } }, null, false, 0, ""])(
  "bodyJson serializes %j and supplies its content type",
  async (bodyJson) => {
    let init: RequestInit | undefined
    dom.window.fetch = (async (_url, options) => {
      init = options
      return new Response(null, { status: 204 })
    }) as typeof fetch
    await cell.request("/save", { method: "POST", bodyJson })

    test
      .expect(init?.body)
      .toBe(JSON.stringify(bodyJson))
    test
      .expect(new Headers(init?.headers).get("Content-Type"))
      .toBe("application/json")
    test
      .expect(Object.hasOwn(init!, "bodyJson"))
      .toBe(false)
    test
      .expect(phases)
      .toEqual(["started", "finished"])
  },
)

test.it("bodyJson preserves explicit headers without mutating them", async () => {
  const headers = new Headers({ "content-type": "application/merge-patch+json", "X-Custom": "explicit" })
  let init: RequestInit | undefined
  dom.window.fetch = (async (_url, options) => {
    init = options
    return new Response(null, { status: 204 })
  }) as typeof fetch
  await cell.request("/save", { method: "PATCH", bodyJson: { name: "Ada" }, headers })

  test
    .expect(new Headers(init?.headers).get("Content-Type"))
    .toBe("application/merge-patch+json")
  test
    .expect(new Headers(init?.headers).get("X-Custom"))
    .toBe("explicit")
  test
    .expect(headers.has("Accept"))
    .toBe(false)
})

test.it("bodyForm preserves repeated fields and files and lets fetch generate the multipart boundary", async () => {
  const form = new FormData()
  form.append("tag", "first")
  form.append("tag", "second")
  form.append("file", new File(["contents"], "note.txt", { type: "text/plain" }))
  const headers = new Headers({ "Content-Type": "multipart/form-data", "X-Custom": "explicit" })
  let init: RequestInit | undefined
  dom.window.fetch = (async (_url, options) => {
    init = options
    return new Response(null, { status: 204 })
  }) as typeof fetch
  await cell.request("/save", { method: "POST", bodyForm: form, headers })

  test
    .expect(init?.body)
    .toBe(form)
  test
    .expect(new Headers(init?.headers).has("Content-Type"))
    .toBe(false)
  test
    .expect(new Headers(init?.headers).get("X-Custom"))
    .toBe("explicit")
  test
    .expect(headers.get("Content-Type"))
    .toBe("multipart/form-data")
  test
    .expect(Object.hasOwn(init!, "bodyForm"))
    .toBe(false)

  const request = new Request("http://localhost/save", { ...init, signal: undefined })
  test
    .expect(request.headers.get("Content-Type"))
    .toStartWith("multipart/form-data; boundary=")
  const parsed = await request.formData()
  test
    .expect(parsed.getAll("tag"))
    .toEqual(["first", "second"])
  test
    .expect(await (parsed.get("file") as File).text())
    .toBe("contents")
})

test.it.each(["record", "FormData"])("bodyForm accepts %s from the document realm", async (kind) => {
  const file = new dom.window.File(["contents"], "note.txt")
  const form = new dom.window.FormData()
  form.append("name", "Ada & Grace")
  form.append("file", file)
  form.append("get", "field")
  form.append("preventDefault", "field")
  form.append("nodeType", "field")
  let init: RequestInit | undefined
  dom.window.fetch = (async (_url, options) => {
    init = options
    return new Response(null, { status: 204 })
  }) as typeof fetch
  await cell.request("/save", {
    method: "POST",
    bodyForm: kind === "record"
      ? { name: "Ada & Grace", file, get: "field", preventDefault: "field", nodeType: "field" }
      : form,
  })

  test
    .expect(Array.from((init?.body as FormData).entries()))
    .toEqual(Array.from(form.entries()))
  test
    .expect(new Headers(init?.headers).has("Content-Type"))
    .toBe(false)
})

test.it("bodyForm accepts a form and serializes its current successful controls", async () => {
  const form = dom.window.document.createElement("form")
  form.innerHTML = `
    <input name="name" value="initial">
    <input name="tag" value="first">
    <input name="tag" value="second">
    <input name="disabled" value="ignored" disabled>
    <input type="checkbox" name="unchecked" value="ignored">
    <button name="action" value="save">Save</button>
  `
  dom.window.document.body.append(form)
  form.querySelector("input")!.value = "Ada"
  let init: RequestInit | undefined
  dom.window.fetch = (async (_url, options) => {
    init = options
    return new Response(null, { status: 204 })
  }) as typeof fetch
  await cell.request("/save", { method: "POST", bodyForm: form })

  test
    .expect(Array.from((init?.body as FormData).entries()))
    .toEqual([["name", "Ada"], ["tag", "first"], ["tag", "second"]])
  test
    .expect(new Headers(init?.headers).has("Content-Type"))
    .toBe(false)
})

test.it.each(["save", "publish", null])("bodyForm accepts a submit event with submitter %s", async (action) => {
  const form = dom.window.document.createElement("form")
  form.id = "submission"
  form.innerHTML = `
    <input name="name" value="Ada">
    <button name="action" value="save">Save</button>
  `
  dom.window.document.body.append(form)
  form.insertAdjacentHTML("afterend", "<button form=\"submission\" name=\"action\" value=\"publish\">Publish</button>")
  let init: RequestInit | undefined
  dom.window.fetch = (async (_url, options) => {
    init = options
    return new Response(null, { status: 204 })
  }) as typeof fetch
  let request: Promise<void> | undefined
  dom.window.document.addEventListener("submit", (event) => {
    event.preventDefault()
    request = cell.request("/save", { method: "POST", bodyForm: event })
  })
  form.dispatchEvent(
    new dom.window.SubmitEvent("submit", {
      bubbles: true,
      cancelable: true,
      submitter: action ? dom.window.document.querySelector<HTMLButtonElement>(`button[value="${action}"]`) : null,
    }),
  )
  await request

  test
    .expect(Array.from((init?.body as FormData).entries()))
    .toEqual(action ? [["name", "Ada"], ["action", action]] : [["name", "Ada"]])
  test
    .expect(new Headers(init?.headers).has("Content-Type"))
    .toBe(false)
})

test.it("request body options are mutually exclusive through their types", () => {
  type Options = NonNullable<Parameters<Cell["request"]>[1]>
  test
    .expectTypeOf<{ body: string; bodyJson: null }>()
    .not
    .toExtend<Options>()
  test
    .expectTypeOf<{ body: string; bodyForm: FormData }>()
    .not
    .toExtend<Options>()
  test
    .expectTypeOf<{ bodyJson: null; bodyForm: FormData }>()
    .not
    .toExtend<Options>()
})

test.it("bodyJson rejects unsupported values through its type", () => {
  type BodyJson = NonNullable<Parameters<Cell["request"]>[1]>["bodyJson"]
  test
    .expectTypeOf<bigint>()
    .not
    .toExtend<BodyJson>()
  test
    .expectTypeOf<() => void>()
    .not
    .toExtend<BodyJson>()
  test
    .expectTypeOf<symbol>()
    .not
    .toExtend<BodyJson>()
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

test.it.each(["body", "bodyJson", "bodyForm"] as const)(
  "a successful connection resets retry limits and retries preserve %s",
  async (kind) => {
    let calls = 0
    let stream!: ReadableStreamDefaultController<Uint8Array>
    const body = kind === "bodyForm" ? new dom.window.FormData() : JSON.stringify({ count: 7 })
    if (typeof body !== "string") body.append("count", "7")
    dom.window.fetch = (async (url, options) => {
      calls++

      test
        .expect(String(url))
        .toBe("http://localhost/stream?q=explicit&page=2")
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
      urlParams: { page: "2" },
      headers: { "X-Custom": "explicit" },
      ...(kind === "bodyJson" ? { bodyJson: { count: 7 } } : { [kind]: body }),
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
  },
)

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
                "id: 42\r\nretry: 7\r\nevent: datastar-patch-signals\r\ndata: {\"signals\":{\"count\":1}}\r\n\r\n",
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
  dom.window.fetch = (async () => sse("event: datastar-patch-signals\ndata: invalid\n\n")) as unknown as typeof fetch
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
        ? sse(`event: datastar-patch-elements\ndata: ${html}\n\n`)
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
