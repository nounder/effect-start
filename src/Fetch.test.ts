import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Fetch from "./Fetch.ts"

test.describe("Fetch.fetch", () => {
  test.it("fetches a URL and returns an Entity with string body", async () => {
    const entity = await Effect.runPromise(
      Fetch.fetch("https://httpbin.org/get"),
    )

    test.expect(entity.status).toBe(200)
    test.expect(typeof entity.body).toBe("string")
    test.expect(entity.headers["content-type"]).toContain("application/json")
  })

  test.it("exposes json accessor on the entity", async () => {
    const entity = await Effect.runPromise(
      Fetch.fetch("https://httpbin.org/get"),
    )
    const json = (await Effect.runPromise(entity.json)) as { url: string }

    test.expect(json.url).toBe("https://httpbin.org/get")
  })

  test.it("returns FetchError for unreachable host", async () => {
    const exit = await Effect.runPromiseExit(
      Fetch.fetch("http://localhost:1"),
    )

    test.expect(exit._tag).toBe("Failure")
  })

  test.it("handles empty-body responses", async () => {
    const entity = await Effect.runPromise(
      Fetch.fetch("https://httpbin.org/status/204"),
    )

    test.expect(entity.status).toBe(204)
    test.expect(entity.body).toBe("")
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
  test.it("has correct _tag", () => {
    const err = Fetch.FetchError(
      new Request("http://example.com"),
      "Transport",
      new Error("fail"),
    )

    test.expect(err._tag).toBe("FetchError")
    test.expect(err.reason).toBe("Transport")
  })
})
