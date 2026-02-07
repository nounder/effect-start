import * as test from "bun:test"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Fetch from "./Fetch.ts"

test.describe("Fetch.fetch", () => {
  test.it("fetches a URL and returns an Entity with Uint8Array body", async () => {
    const entity = await Effect.runPromise(
      Fetch.fetch("https://httpbin.org/get"),
    )

    test.expect(entity.status).toBe(200)
    test.expect(entity.body).toBeInstanceOf(Uint8Array)
    test.expect(entity.headers["content-type"]).toContain("application/json")
  })

  test.it("exposes json accessor on the entity", async () => {
    const entity = await Effect.runPromise(
      Fetch.fetch("https://httpbin.org/get"),
    )
    const json = (await Effect.runPromise(entity.json)) as { url: string }

    test.expect(json.url).toBe("https://httpbin.org/get")
  })

  test.it("returns FetchError with TransportError for unreachable host", async () => {
    const exit = await Effect.runPromiseExit(
      Fetch.fetch("http://localhost:1"),
    )

    test.expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      const error = Cause.failureOption(exit.cause).pipe(
        (opt) => (opt as any).value as Fetch.FetchError,
      )
      test.expect(error._tag).toBe("FetchError")
      test.expect(error.reason._tag).toBe("TransportError")
      test.expect(error.request.url).toBe("http://localhost:1/")
      test.expect(error.message).toContain("Transport")
      test.expect(Fetch.isFetchError(error)).toBe(true)
    }
  })

  test.it("handles empty-body responses", async () => {
    const entity = await Effect.runPromise(
      Fetch.fetch("https://httpbin.org/status/204"),
    )

    test.expect(entity.status).toBe(204)
    test.expect(entity.body).toEqual(new Uint8Array(0))
  })
})

test.describe("Fetch.make", () => {
  test.it("creates a client with no middleware", async () => {
    const client = Fetch.make()
    const entity = await Effect.runPromise(
      client.execute(new Request("https://httpbin.org/get")),
    )

    test.expect(entity.status).toBe(200)
  })

  test.it("applies middleware in order", async () => {
    const client = Fetch.make(
      Fetch.setHeader("x-custom", "hello"),
      Fetch.baseUrl("https://httpbin.org"),
    )

    const entity = await Effect.runPromise(
      client.execute(new Request("https://httpbin.org/headers")),
    )
    const json = (await Effect.runPromise(entity.json)) as {
      headers: Record<string, string>
    }

    test.expect(json.headers["X-Custom"]).toBe("hello")
  })
})

test.describe("Fetch.middleware", () => {
  test.it("supports Effect.gen-style middleware via generator", async () => {
    const logging = Fetch.middleware(function* (request, next) {
      const entity = yield* next(request)
      return entity
    })

    const client = Fetch.make(logging)
    const entity = await Effect.runPromise(
      client.execute(new Request("https://httpbin.org/get")),
    )

    test.expect(entity.status).toBe(200)
  })
})

test.describe("Fetch.bearerToken", () => {
  test.it("adds Authorization header", async () => {
    const client = Fetch.make(Fetch.bearerToken("my-token"))
    const entity = await Effect.runPromise(
      client.execute(new Request("https://httpbin.org/headers")),
    )
    const json = (await Effect.runPromise(entity.json)) as {
      headers: Record<string, string>
    }

    test.expect(json.headers["Authorization"]).toBe("Bearer my-token")
  })
})

test.describe("Fetch.setHeaders", () => {
  test.it("sets multiple headers", async () => {
    const client = Fetch.make(
      Fetch.setHeaders({ "x-one": "1", "x-two": "2" }),
    )
    const entity = await Effect.runPromise(
      client.execute(new Request("https://httpbin.org/headers")),
    )
    const json = (await Effect.runPromise(entity.json)) as {
      headers: Record<string, string>
    }

    test.expect(json.headers["X-One"]).toBe("1")
    test.expect(json.headers["X-Two"]).toBe("2")
  })
})

test.describe("Fetch.tap", () => {
  test.it("allows side-effects without altering the response", async () => {
    let tappedStatus: number | undefined
    const client = Fetch.make(
      Fetch.tap((entity) => {
        tappedStatus = entity.status
      }),
    )

    await Effect.runPromise(
      client.execute(new Request("https://httpbin.org/get")),
    )

    test.expect(tappedStatus).toBe(200)
  })
})

test.describe("FetchError", () => {
  test.it("wraps TransportError with formatted message", () => {
    const request = new Request("http://example.com/api")
    const err = new Fetch.FetchError({
      reason: new Fetch.TransportError({ request, cause: new Error("ECONNREFUSED") }),
    })

    test.expect(err._tag).toBe("FetchError")
    test.expect(err.reason._tag).toBe("TransportError")
    test.expect(err.request).toBe(request)
    test.expect(err.message).toBe("Transport (GET http://example.com/api)")
  })

  test.it("wraps DecodeError with formatted message", () => {
    const request = new Request("http://example.com/data", { method: "POST" })
    const err = new Fetch.FetchError({
      reason: new Fetch.DecodeError({
        request,
        description: "invalid body encoding",
      }),
    })

    test.expect(err._tag).toBe("FetchError")
    test.expect(err.reason._tag).toBe("DecodeError")
    test.expect(err.message).toBe("Decode: invalid body encoding (POST http://example.com/data)")
  })

  test.it("isFetchError type guard works", () => {
    const err = new Fetch.FetchError({
      reason: new Fetch.TransportError({
        request: new Request("http://example.com"),
      }),
    })

    test.expect(Fetch.isFetchError(err)).toBe(true)
    test.expect(Fetch.isFetchError(new Error("nope"))).toBe(false)
    test.expect(Fetch.isFetchError(null)).toBe(false)
  })
})
