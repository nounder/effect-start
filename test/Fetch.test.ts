import * as test from "bun:test"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Entity from "effect-start/Entity"
import * as Fetch from "effect-start/Fetch"

function patchFetch(fn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return Effect.asVoid(
    Effect.acquireRelease(
      Effect.sync(() => {
        const original = globalThis.fetch
        globalThis.fetch = fn as typeof globalThis.fetch
        return original
      }),
      (original) =>
        Effect.sync(() => {
          globalThis.fetch = original
        }),
    ),
  )
}

test.describe("fetch", () => {
  test.it("performs basic fetch", () =>
    Effect.gen(function* () {
      yield* patchFetch(async () => new Response("result", { status: 200 }))

      const entity = yield* Fetch.fetch("https://example.com")
      test.expect(entity.status).toBe(200)
      const text = yield* entity.text
      test.expect(text).toBe("result")
    }).pipe(Effect.scoped, Effect.runPromise),
  )

  test.it("accepts Request object", () =>
    Effect.gen(function* () {
      yield* patchFetch(async () => new Response("ok"))

      const request = new Request("https://example.com", { method: "POST" })
      const entity = yield* Fetch.fetch(request)
      const text = yield* entity.text
      test.expect(text).toBe("ok")
    }).pipe(Effect.scoped, Effect.runPromise),
  )

  test.it("accepts URL object", () =>
    Effect.gen(function* () {
      yield* patchFetch(async () => new Response("ok"))

      const url = new URL("https://example.com/path")
      const entity = yield* Fetch.fetch(url)
      const text = yield* entity.text
      test.expect(text).toBe("ok")
    }).pipe(Effect.scoped, Effect.runPromise),
  )

  test.it("accepts RequestInit options", () =>
    Effect.gen(function* () {
      let capturedMethod = ""
      yield* patchFetch(async (input: string | URL | Request) => {
        capturedMethod = (input as Request).method
        return new Response("ok")
      })

      yield* Fetch.fetch("https://example.com", { method: "DELETE" })
      test.expect(capturedMethod).toBe("DELETE")
    }).pipe(Effect.scoped, Effect.runPromise),
  )

  test.it("wraps fetch errors in FetchError", () =>
    Effect.gen(function* () {
      yield* patchFetch(async () => {
        throw new Error("network error")
      })

      const result = yield* Effect.exit(Fetch.fetch("https://example.com"))
      test.expect(result._tag).toBe("Failure")
      if (result._tag === "Failure") {
        test.expect(result.cause._tag).toBe("Fail")
        if (result.cause._tag === "Fail") {
          const error = result.cause.error as Fetch.FetchError
          test.expect(error._tag).toBe("FetchError")
          test.expect(error.reason).toBe("Network")
          test.expect(error.request?.url).toBe("https://example.com/")
        }
      }
    }).pipe(Effect.scoped, Effect.runPromise),
  )

  test.it("get() sets method to GET", () =>
    Effect.gen(function* () {
      let capturedMethod = ""
      yield* patchFetch(async (input: string | URL | Request) => {
        capturedMethod = (input as Request).method
        return new Response("ok")
      })

      yield* Fetch.get("https://example.com")
      test.expect(capturedMethod).toBe("GET")
    }).pipe(Effect.scoped, Effect.runPromise),
  )

  test.it("post() sets method to POST", () =>
    Effect.gen(function* () {
      let capturedMethod = ""
      yield* patchFetch(async (input: string | URL | Request) => {
        capturedMethod = (input as Request).method
        return new Response("ok")
      })

      yield* Fetch.post("https://example.com")
      test.expect(capturedMethod).toBe("POST")
    }).pipe(Effect.scoped, Effect.runPromise),
  )
})

test.describe("FetchClient", () => {
  test.it("use() adds middleware", () =>
    Effect.gen(function* () {
      let capturedUrl = ""
      yield* patchFetch(async (input: string | URL | Request) => {
        capturedUrl = (input as Request).url
        return new Response("ok")
      })

      const client = Fetch.use((request, next) => {
        const url = new URL(request.url)
        url.searchParams.set("token", "abc")
        return next(new Request(url.toString(), request))
      })

      yield* client.fetch("https://example.com/api")
      test.expect(capturedUrl).toBe("https://example.com/api?token=abc")
    }).pipe(Effect.scoped, Effect.runPromise),
  )

  test.it("chains middleware in application order", () =>
    Effect.gen(function* () {
      const order: Array<string> = []
      yield* patchFetch(async () => {
        order.push("fetch")
        return new Response("ok")
      })

      const client = Fetch.use((request, next) =>
        Effect.gen(function* () {
          order.push("mw1-before")
          const entity = yield* next(request)
          order.push("mw1-after")
          return entity
        }),
      ).use((request, next) =>
        Effect.gen(function* () {
          order.push("mw2-before")
          const entity = yield* next(request)
          order.push("mw2-after")
          return entity
        }),
      )

      yield* client.fetch("https://example.com")
      test.expect(order).toEqual(["mw1-before", "mw2-before", "fetch", "mw2-after", "mw1-after"])
    }).pipe(Effect.scoped, Effect.runPromise),
  )

  test.it("middleware can modify request", () =>
    Effect.gen(function* () {
      let sawHeader = false
      yield* patchFetch(async (input: string | URL | Request) => {
        sawHeader = (input as Request).headers.has("x-custom")
        return new Response("ok")
      })

      const client = Fetch.use((request, next) =>
        Effect.gen(function* () {
          const headers = new Headers(request.headers)
          headers.set("x-custom", "value")
          return yield* next(new Request(request.url, { headers }))
        }),
      )

      yield* client.fetch("https://example.com")
      test.expect(sawHeader).toBe(true)
    }).pipe(Effect.scoped, Effect.runPromise),
  )

  test.it("middleware can short-circuit with cached response", () =>
    Effect.gen(function* () {
      let fetchCalled = false
      yield* patchFetch(async () => {
        fetchCalled = true
        return new Response("real")
      })

      const client = Fetch.use((_request, _next) => {
        const cached = new Response("from-cache", { status: 200 })
        return Effect.succeed(Entity.fromResponse<Fetch.FetchError>(cached, _request))
      })

      const entity = yield* client.fetch("https://example.com")
      const text = yield* entity.text
      test.expect(text).toBe("from-cache")
      test.expect(fetchCalled).toBe(false)
    }).pipe(Effect.scoped, Effect.runPromise),
  )

  test.it("use() returns new client without mutating original", () =>
    Effect.gen(function* () {
      let headerSeen = false
      yield* patchFetch(async (input: string | URL | Request) => {
        headerSeen = (input as Request).headers.has("x-added")
        return new Response("ok")
      })

      const base = Fetch
      const withHeader = base.use((request, next) =>
        Effect.gen(function* () {
          const headers = new Headers(request.headers)
          headers.set("x-added", "yes")
          return yield* next(new Request(request.url, { headers }))
        }),
      )

      yield* base.fetch("https://example.com")
      test.expect(headerSeen).toBe(false)

      yield* withHeader.fetch("https://example.com")
      test.expect(headerSeen).toBe(true)
    }).pipe(Effect.scoped, Effect.runPromise),
  )

  test.it("use() accepts multiple middleware at once", () =>
    Effect.gen(function* () {
      const order: Array<string> = []
      yield* patchFetch(async () => {
        order.push("fetch")
        return new Response("ok")
      })

      const client = Fetch.use(
        (request, next) =>
          Effect.gen(function* () {
            order.push("a")
            return yield* next(request)
          }),
        (request, next) =>
          Effect.gen(function* () {
            order.push("b")
            return yield* next(request)
          }),
      )

      yield* client.fetch("https://example.com")
      test.expect(order).toEqual(["a", "b", "fetch"])
    }).pipe(Effect.scoped, Effect.runPromise),
  )
})

test.describe("fromHandler", () => {
  test.it("creates a client from a WebHandler", () =>
    Effect.gen(function* () {
      const handler = (_request: Request) => new Response("from handler", { status: 200 })
      const client = Fetch.fromHandler(handler)

      const entity = yield* client.fetch("http://localhost/test")
      test.expect(entity.status).toBe(200)
      const text = yield* entity.text
      test.expect(text).toBe("from handler")
    }).pipe(Effect.runPromise),
  )

  test.it("passes request to handler", () =>
    Effect.gen(function* () {
      let capturedMethod = ""
      let capturedPath = ""
      const handler = (request: Request) => {
        capturedMethod = request.method
        capturedPath = new URL(request.url).pathname
        return new Response("ok")
      }
      const client = Fetch.fromHandler(handler)

      yield* client.post("http://localhost/users")
      test.expect(capturedMethod).toBe("POST")
      test.expect(capturedPath).toBe("/users")
    }).pipe(Effect.runPromise),
  )

  test.it("supports middleware on handler-backed client", () =>
    Effect.gen(function* () {
      const handler = (_request: Request) =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })

      const client = Fetch.fromHandler(handler).use(
        Fetch.filterStatusOk(),
      )

      const entity = yield* client.fetch("http://localhost/api")
      const json = yield* entity.json
      test.expect(json).toEqual({ ok: true })
    }).pipe(Effect.runPromise),
  )

  test.it("handles async WebHandler", () =>
    Effect.gen(function* () {
      const handler = async (_request: Request) => {
        return new Response("async result", { status: 201 })
      }
      const client = Fetch.fromHandler(handler)

      const entity = yield* client.fetch("http://localhost/test")
      test.expect(entity.status).toBe(201)
      const text = yield* entity.text
      test.expect(text).toBe("async result")
    }).pipe(Effect.runPromise),
  )
})

test.describe("type tests", () => {
  test.it("FetchClient tracks error channel from middleware", () => {
    class CustomError extends Error {
      readonly _tag = "CustomError"
    }

    const middleware: Fetch.Middleware<CustomError> = (_request, next) =>
      Effect.gen(function* () {
        const entity = yield* next(_request)
        if (entity.status === 404) {
          return yield* Effect.fail(new CustomError("Not found"))
        }
        return entity
      })

    const client = Fetch.use(middleware)
    type R = ReturnType<typeof client.fetch>

    test.expectTypeOf<Effect.Effect.Error<R>>().toEqualTypeOf<Fetch.FetchError | CustomError>()
    test.expectTypeOf<Effect.Effect.Context<R>>().toEqualTypeOf<never>()
  })

  test.it("FetchClient tracks context channel from middleware", () => {
    interface Token {
      readonly _tag: "Token"
      readonly value: string
    }
    const Token = Context.GenericTag<Token>("Token")

    const middleware: Fetch.Middleware<never, Token> = (request, next) =>
      Effect.gen(function* () {
        const token = yield* Token
        const headers = new Headers(request.headers)
        headers.set("authorization", `Bearer ${token.value}`)
        return yield* next(new Request(request.url, { headers }))
      })

    const client = Fetch.use(middleware)
    type R = ReturnType<typeof client.fetch>

    test.expectTypeOf<Effect.Effect.Error<R>>().toEqualTypeOf<Fetch.FetchError>()
    test.expectTypeOf<Effect.Effect.Context<R>>().toEqualTypeOf<Token>()
  })

  test.it("FetchClient accumulates error and context channels", () => {
    class ErrorA extends Error {
      readonly _tag = "ErrorA"
    }
    class ErrorB extends Error {
      readonly _tag = "ErrorB"
    }

    interface ServiceA {
      readonly _tag: "ServiceA"
    }
    interface ServiceB {
      readonly _tag: "ServiceB"
    }
    const ServiceA = Context.GenericTag<ServiceA>("ServiceA")
    const ServiceB = Context.GenericTag<ServiceB>("ServiceB")

    const mwA: Fetch.Middleware<ErrorA, ServiceA> = (_request, next) =>
      Effect.gen(function* () {
        yield* ServiceA
        return yield* next(_request)
      })

    const mwB: Fetch.Middleware<ErrorB, ServiceB> = (_request, next) =>
      Effect.gen(function* () {
        yield* ServiceB
        return yield* next(_request)
      })

    const client = Fetch.use(mwA).use(mwB)
    type R = ReturnType<typeof client.fetch>

    test.expectTypeOf<Effect.Effect.Error<R>>().toEqualTypeOf<Fetch.FetchError | ErrorA | ErrorB>()
    test.expectTypeOf<Effect.Effect.Context<R>>().toEqualTypeOf<ServiceA | ServiceB>()
  })

  test.it("filterStatusOk adds FetchError to error channel", () => {
    const client = Fetch.use(Fetch.filterStatusOk())
    type R = ReturnType<typeof client.fetch>

    test.expectTypeOf<Effect.Effect.Error<R>>().toEqualTypeOf<Fetch.FetchError>()
    test.expectTypeOf<Effect.Effect.Context<R>>().toEqualTypeOf<never>()
  })

  test.it("chaining use() accumulates types", () => {
    class Error1 extends Error {
      readonly _tag = "Error1"
    }
    class Error2 extends Error {
      readonly _tag = "Error2"
    }

    const mw1: Fetch.Middleware<Error1> = (_request, next) => next(_request)
    const mw2: Fetch.Middleware<Error2> = (_request, next) => next(_request)

    const client = Fetch.use(mw1).use(mw2)
    type R = ReturnType<typeof client.fetch>

    test.expectTypeOf<Effect.Effect.Error<R>>().toEqualTypeOf<Fetch.FetchError | Error1 | Error2>()
    test.expectTypeOf<Effect.Effect.Context<R>>().toEqualTypeOf<never>()
  })

  test.it("fetch method returns correct effect type with errors", () => {
    class CustomError extends Error {
      readonly _tag = "CustomError"
    }

    const middleware: Fetch.Middleware<CustomError> = (_request, next) =>
      Effect.gen(function* () {
        const entity = yield* next(_request)
        if (entity.status === 404) {
          return yield* Effect.fail(new CustomError("Not found"))
        }
        return entity
      })

    const client = Fetch.use(middleware)
    type R = ReturnType<typeof client.fetch>

    test.expectTypeOf<Effect.Effect.Success<R>>().toEqualTypeOf<Fetch.FetchEntity>()
    test.expectTypeOf<Effect.Effect.Error<R>>().toEqualTypeOf<Fetch.FetchError | CustomError>()
    test.expectTypeOf<Effect.Effect.Context<R>>().toEqualTypeOf<never>()
  })

  test.it("fetch method returns correct effect type with context", () => {
    interface Token {
      readonly _tag: "Token"
      readonly value: string
    }
    const Token = Context.GenericTag<Token>("Token")

    const middleware: Fetch.Middleware<never, Token> = (request, next) =>
      Effect.gen(function* () {
        const token = yield* Token
        const headers = new Headers(request.headers)
        headers.set("authorization", `Bearer ${token.value}`)
        return yield* next(new Request(request.url, { headers }))
      })

    const client = Fetch.use(middleware)
    type R = ReturnType<typeof client.fetch>

    test.expectTypeOf<Effect.Effect.Error<R>>().toEqualTypeOf<Fetch.FetchError>()
    test.expectTypeOf<Effect.Effect.Context<R>>().toEqualTypeOf<Token>()
  })

  test.it("base module fetch returns correct effect type", () => {
    const fetchResult = Fetch.fetch("https://example.com")
    const getResult = Fetch.get("https://example.com")
    const postResult = Fetch.post("https://example.com")

    test
      .expectTypeOf<Effect.Effect.Success<typeof fetchResult>>()
      .toEqualTypeOf<Fetch.FetchEntity>()
    test.expectTypeOf<Effect.Effect.Error<typeof fetchResult>>().toEqualTypeOf<Fetch.FetchError>()
    test.expectTypeOf<Effect.Effect.Context<typeof fetchResult>>().toEqualTypeOf<never>()

    test.expectTypeOf<Effect.Effect.Success<typeof getResult>>().toEqualTypeOf<Fetch.FetchEntity>()
    test.expectTypeOf<Effect.Effect.Error<typeof getResult>>().toEqualTypeOf<Fetch.FetchError>()
    test.expectTypeOf<Effect.Effect.Context<typeof getResult>>().toEqualTypeOf<never>()

    test.expectTypeOf<Effect.Effect.Success<typeof postResult>>().toEqualTypeOf<Fetch.FetchEntity>()
    test.expectTypeOf<Effect.Effect.Error<typeof postResult>>().toEqualTypeOf<Fetch.FetchError>()
    test.expectTypeOf<Effect.Effect.Context<typeof postResult>>().toEqualTypeOf<never>()
  })
})
