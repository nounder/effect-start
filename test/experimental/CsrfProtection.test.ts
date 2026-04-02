import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Fetch from "effect-start/Fetch"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as CsrfProtection from "../../src/experimental/CsrfProtection.ts"

function makeHandler(options?: CsrfProtection.Options) {
  return Fetch.fromHandler(
    RouteHttp.toWebHandler(
      Route.use(CsrfProtection.make(options)).post(Route.json({ ok: true })),
    ),
  )
}

function post(client: Fetch.FetchClient, headers?: Record<string, string>) {
  return client.post("http://localhost/test", headers ? { headers } : undefined)
}

test.describe("CsrfProtection", () => {
  const client = makeHandler()

  test.it("allows POST without Sec-Fetch-Site (non-browser client)", () =>
    Effect.gen(function* () {
      const entity = yield* post(client)
      test.expect(entity.status).toBe(200)
    }).pipe(Effect.runPromise),
  )

  test.it("allows same-origin POST", () =>
    Effect.gen(function* () {
      const entity = yield* post(client, {
        "sec-fetch-site": "same-origin",
        "origin": "http://localhost",
      })
      test.expect(entity.status).toBe(200)
    }).pipe(Effect.runPromise),
  )

  test.it("allows same-site POST", () =>
    Effect.gen(function* () {
      const entity = yield* post(client, {
        "sec-fetch-site": "same-site",
        "origin": "http://localhost",
      })
      test.expect(entity.status).toBe(200)
    }).pipe(Effect.runPromise),
  )

  test.it("is case insensitive for Sec-Fetch-Site", () =>
    Effect.gen(function* () {
      const entity = yield* post(client, {
        "sec-fetch-site": "Same-Origin",
        "origin": "http://localhost",
      })
      test.expect(entity.status).toBe(200)
    }).pipe(Effect.runPromise),
  )

  test.it("blocks cross-site POST", () =>
    Effect.gen(function* () {
      const entity = yield* post(client, {
        "sec-fetch-site": "cross-site",
        "origin": "http://localhost",
      })
      test.expect(entity.status).toBe(403)
    }).pipe(Effect.runPromise),
  )

  test.it("blocks POST with Sec-Fetch-Site: none", () =>
    Effect.gen(function* () {
      const entity = yield* post(client, {
        "sec-fetch-site": "none",
        "origin": "http://localhost",
      })
      test.expect(entity.status).toBe(403)
    }).pipe(Effect.runPromise),
  )

  test.it("adds Vary: Sec-Fetch-Site on success", () =>
    Effect.gen(function* () {
      const entity = yield* post(client, {
        "sec-fetch-site": "same-origin",
        "origin": "http://localhost",
      })
      test.expect(entity.status).toBe(200)
      test.expect(entity.headers["vary"]).toContain("Sec-Fetch-Site")
    }).pipe(Effect.runPromise),
  )

  test.describe("origin validation", () => {
    test.it("blocks when origin doesn't match base URL", () =>
      Effect.gen(function* () {
        const entity = yield* post(client, {
          "sec-fetch-site": "same-origin",
          "origin": "http://evil.com",
        })
        test.expect(entity.status).toBe(403)
      }).pipe(Effect.runPromise),
    )

    test.it("allows POST without Origin header", () =>
      Effect.gen(function* () {
        const entity = yield* post(client, {
          "sec-fetch-site": "same-origin",
        })
        test.expect(entity.status).toBe(200)
      }).pipe(Effect.runPromise),
    )
  })

  test.describe("trusted origins", () => {
    const trusted = makeHandler({
      trustedOrigins: ["https://accounts.google.com"],
    })

    test.it("allows cross-site POST from trusted origin", () =>
      Effect.gen(function* () {
        const entity = yield* post(trusted, {
          "sec-fetch-site": "cross-site",
          "origin": "https://accounts.google.com",
        })
        test.expect(entity.status).toBe(200)
      }).pipe(Effect.runPromise),
    )

    test.it("blocks cross-site POST from untrusted origin", () =>
      Effect.gen(function* () {
        const entity = yield* post(trusted, {
          "sec-fetch-site": "cross-site",
          "origin": "https://evil.com",
        })
        test.expect(entity.status).toBe(403)
      }).pipe(Effect.runPromise),
    )
  })

  test.describe("allowSameSite: false", () => {
    const strict = makeHandler({ allowSameSite: false })

    test.it("allows same-origin", () =>
      Effect.gen(function* () {
        const entity = yield* post(strict, {
          "sec-fetch-site": "same-origin",
          "origin": "http://localhost",
        })
        test.expect(entity.status).toBe(200)
      }).pipe(Effect.runPromise),
    )

    test.it("blocks same-site", () =>
      Effect.gen(function* () {
        const entity = yield* post(strict, {
          "sec-fetch-site": "same-site",
          "origin": "http://localhost",
        })
        test.expect(entity.status).toBe(403)
      }).pipe(Effect.runPromise),
    )
  })
})
