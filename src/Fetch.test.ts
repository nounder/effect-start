import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Fetch from "./Fetch.ts"

test.describe("fromResponse", () => {
  test.it("creates entity with status and headers", () => {
    const response = new Response("hello", {
      status: 201,
      headers: { "content-type": "text/plain", "x-custom": "value" },
    })
    const request = new Request("https://example.com")
    const entity = Fetch.fromResponse(response, request)

    test.expect(entity.status).toBe(201)
    test.expect(entity.headers["content-type"]).toBe("text/plain")
    test.expect(entity.headers["x-custom"]).toBe("value")
  })

  test.it("url is undefined for constructed responses", () => {
    const response = new Response("hello")
    const request = new Request("https://example.com/path")
    const entity = Fetch.fromResponse(response, request)

    // Response constructor does not set .url; only fetch()-returned responses have it
    test.expect(entity.url).toBeUndefined()
  })

  test.it("reads body as text", async () => {
    const response = new Response("hello world")
    const request = new Request("https://example.com")
    const entity = Fetch.fromResponse(response, request)
    const text = await Effect.runPromise(entity.text)

    test.expect(text).toBe("hello world")
  })

  test.it("reads body as json", async () => {
    const response = new Response(JSON.stringify({ key: "value" }))
    const request = new Request("https://example.com")
    const entity = Fetch.fromResponse(response, request)
    const json = await Effect.runPromise(entity.json)

    test.expect(json).toEqual({ key: "value" })
  })

  test.it("reads body as bytes", async () => {
    const response = new Response("hello")
    const request = new Request("https://example.com")
    const entity = Fetch.fromResponse(response, request)
    const bytes = await Effect.runPromise(entity.bytes)

    test.expect(bytes).toEqual(new TextEncoder().encode("hello"))
  })
})

test.describe("fetch", () => {
  test.it("wraps global fetch and returns entity", async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () => new Response("fetched", { status: 200 })

    try {
      const entity = await Effect.runPromise(Fetch.fetch("https://example.com"))
      test.expect(entity.status).toBe(200)
      const text = await Effect.runPromise(entity.text)
      test.expect(text).toBe("fetched")
    } finally {
      globalThis.fetch = original
    }
  })

  test.it("passes request method and headers", async () => {
    const original = globalThis.fetch
    let captured: Request | undefined
    globalThis.fetch = async (input: string | URL | Request) => {
      captured = input as Request
      return new Response("ok")
    }

    try {
      await Effect.runPromise(
        Fetch.fetch("https://example.com/api", {
          method: "POST",
          headers: { authorization: "Bearer token" },
        }),
      )
      test.expect(captured!.method).toBe("POST")
      test.expect(captured!.headers.get("authorization")).toBe("Bearer token")
    } finally {
      globalThis.fetch = original
    }
  })

  test.it("wraps fetch errors as FetchError", async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () => {
      throw new Error("network error")
    }

    try {
      const exit = await Effect.runPromiseExit(Fetch.fetch("https://example.com"))
      test.expect(exit._tag).toBe("Failure")
    } finally {
      globalThis.fetch = original
    }
  })
})

test.describe("make", () => {
  test.it("creates client with Effect middleware", async () => {
    const original = globalThis.fetch
    let capturedUrl = ""
    globalThis.fetch = async (input: string | URL | Request) => {
      capturedUrl = (input as Request).url
      return new Response("ok")
    }

    try {
      const client = Fetch.make((request, next) => {
        const url = new URL(request.url)
        url.searchParams.set("token", "abc")
        return next(new Request(url.toString(), request))
      })

      await Effect.runPromise(client("https://example.com/api"))
      test.expect(capturedUrl).toBe("https://example.com/api?token=abc")
    } finally {
      globalThis.fetch = original
    }
  })

  test.it("supports generator middleware", async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () => new Response("original")

    try {
      const client = Fetch.make(function* (request, next) {
        const entity = yield* next(request)
        return entity
      })

      const entity = await Effect.runPromise(client("https://example.com"))
      const text = await Effect.runPromise(entity.text)
      test.expect(text).toBe("original")
    } finally {
      globalThis.fetch = original
    }
  })

  test.it("executes middleware in order (first added = outermost)", async () => {
    const order: Array<string> = []
    const original = globalThis.fetch
    globalThis.fetch = async () => {
      order.push("fetch")
      return new Response("ok")
    }

    try {
      const client = Fetch.make(
        function* (request, next) {
          order.push("mw1-before")
          const entity = yield* next(request)
          order.push("mw1-after")
          return entity
        },
        function* (request, next) {
          order.push("mw2-before")
          const entity = yield* next(request)
          order.push("mw2-after")
          return entity
        },
      )

      await Effect.runPromise(client("https://example.com"))
      test.expect(order).toEqual(["mw1-before", "mw2-before", "fetch", "mw2-after", "mw1-after"])
    } finally {
      globalThis.fetch = original
    }
  })

  test.it("middleware can modify request headers", async () => {
    const original = globalThis.fetch
    let captured: Request | undefined
    globalThis.fetch = async (input: string | URL | Request) => {
      captured = input as Request
      return new Response("ok")
    }

    try {
      const client = Fetch.make(function* (request, next) {
        const headers = new Headers(request.headers)
        headers.set("x-request-id", "123")
        return yield* next(new Request(request.url, { method: request.method, headers }))
      })

      await Effect.runPromise(client("https://example.com"))
      test.expect(captured!.headers.get("x-request-id")).toBe("123")
    } finally {
      globalThis.fetch = original
    }
  })

  test.it("middleware can short-circuit with cached response", async () => {
    const original = globalThis.fetch
    let fetchCalled = false
    globalThis.fetch = async () => {
      fetchCalled = true
      return new Response("from-network")
    }

    try {
      const client = Fetch.make((_request, _next) => {
        const cached = new Response("from-cache", { status: 200 })
        return Effect.succeed(Fetch.fromResponse(cached, _request))
      })

      const entity = await Effect.runPromise(client("https://example.com"))
      const text = await Effect.runPromise(entity.text)
      test.expect(text).toBe("from-cache")
      test.expect(fetchCalled).toBe(false)
    } finally {
      globalThis.fetch = original
    }
  })

  test.it("with no middleware behaves like bare fetch", async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () => new Response("bare", { status: 200 })

    try {
      const client = Fetch.make()
      const entity = await Effect.runPromise(client("https://example.com"))
      test.expect(entity.status).toBe(200)
      const text = await Effect.runPromise(entity.text)
      test.expect(text).toBe("bare")
    } finally {
      globalThis.fetch = original
    }
  })
})

test.describe("FetchError", () => {
  test.it("creates error with tag, request, and cause", () => {
    const request = new Request("https://example.com")
    const cause = new Error("timeout")
    const error = Fetch.FetchError(request, cause)

    test.expect(error._tag).toBe("FetchError")
    test.expect(error.request).toBe(request)
    test.expect(error.cause).toBe(cause)
  })
})
