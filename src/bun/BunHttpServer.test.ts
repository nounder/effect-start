import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Route from "../Route.ts"
import * as BunHttpServer from "./BunHttpServer.ts"

test.describe("smart port selection", () => {
  // Skip when running in TTY because the random port logic requires !isTTY && CLAUDECODE,
  // and process.stdout.isTTY cannot be mocked
  test.test.skipIf(process.stdout.isTTY)(
    "uses random port when PORT not set, isTTY=false, CLAUDECODE set",
    async () => {
      const originalPort = process.env.PORT
      const originalClaudeCode = process.env.CLAUDECODE

      try {
        delete process.env.PORT
        process.env.CLAUDECODE = "1"

        const port = await Effect.runPromise(
          Effect.scoped(
            Effect.gen(function*() {
              const bunServer = yield* BunHttpServer.make({})
              return bunServer.server.port
            }),
          ),
        )

        test
          .expect(port)
          .not
          .toBe(3000)
      } finally {
        if (originalPort !== undefined) {
          process.env.PORT = originalPort
        } else {
          delete process.env.PORT
        }
        if (originalClaudeCode !== undefined) {
          process.env.CLAUDECODE = originalClaudeCode
        } else {
          delete process.env.CLAUDECODE
        }
      }
    },
  )

  test.test("uses explicit PORT even when CLAUDECODE is set", async () => {
    const originalPort = process.env.PORT
    const originalClaudeCode = process.env.CLAUDECODE

    try {
      process.env.PORT = "5678"
      process.env.CLAUDECODE = "1"

      const port = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function*() {
            const bunServer = yield* BunHttpServer.make({})
            return bunServer.server.port
          }),
        ),
      )

      test
        .expect(port)
        .toBe(5678)
    } finally {
      if (originalPort !== undefined) {
        process.env.PORT = originalPort
      } else {
        delete process.env.PORT
      }
      if (originalClaudeCode !== undefined) {
        process.env.CLAUDECODE = originalClaudeCode
      } else {
        delete process.env.CLAUDECODE
      }
    }
  })
})

const testLayer = (routes: ReturnType<typeof Route.tree>) =>
  BunHttpServer.layer({ port: 0 }).pipe(
    Layer.provide(Route.layer(routes)),
  )

test.describe("routes", () => {
  test.test("serves static text route", async () => {
    const routes = Route.tree({
      "/": Route.get(Route.text("Hello, World!")),
    })

    const response = await Effect.runPromise(
      Effect.scoped(
        Effect
          .gen(function*() {
            const bunServer = yield* BunHttpServer.BunHttpServer
            return yield* Effect.promise(() =>
              fetch(`http://localhost:${bunServer.server.port}/`)
            )
          })
          .pipe(Effect.provide(testLayer(routes))),
      ),
    )

    test.expect(response.status).toBe(200)
    test.expect(await response.text()).toBe("Hello, World!")
  })

  test.test("serves JSON route", async () => {
    const routes = Route.tree({
      "/api/data": Route.get(Route.json({ message: "success", value: 42 })),
    })

    const response = await Effect.runPromise(
      Effect.scoped(
        Effect
          .gen(function*() {
            const bunServer = yield* BunHttpServer.BunHttpServer
            return yield* Effect.promise(() =>
              fetch(`http://localhost:${bunServer.server.port}/api/data`)
            )
          })
          .pipe(Effect.provide(testLayer(routes))),
      ),
    )

    test.expect(response.status).toBe(200)
    test.expect(response.headers.get("Content-Type")).toBe("application/json")
    test.expect(await response.json()).toEqual({
      message: "success",
      value: 42,
    })
  })

  test.test("returns 404 for unknown routes", async () => {
    const routes = Route.tree({
      "/": Route.get(Route.text("Home")),
    })

    const response = await Effect.runPromise(
      Effect.scoped(
        Effect
          .gen(function*() {
            const bunServer = yield* BunHttpServer.BunHttpServer
            return yield* Effect.promise(() =>
              fetch(`http://localhost:${bunServer.server.port}/unknown`)
            )
          })
          .pipe(Effect.provide(testLayer(routes))),
      ),
    )

    test.expect(response.status).toBe(404)
  })

  test.test("handles content negotiation", async () => {
    const routes = Route.tree({
      "/data": Route
        .get(Route.json({ type: "json" }))
        .get(Route.html("<div>html</div>")),
    })

    const [jsonResponse, htmlResponse] = await Effect.runPromise(
      Effect.scoped(
        Effect
          .gen(function*() {
            const bunServer = yield* BunHttpServer.BunHttpServer
            const baseUrl = `http://localhost:${bunServer.server.port}`

            const json = yield* Effect.promise(() =>
              fetch(`${baseUrl}/data`, {
                headers: { Accept: "application/json" },
              })
            )

            const html = yield* Effect.promise(() =>
              fetch(`${baseUrl}/data`, {
                headers: { Accept: "text/html" },
              })
            )

            return [json, html] as const
          })
          .pipe(Effect.provide(testLayer(routes))),
      ),
    )

    test.expect(jsonResponse.headers.get("Content-Type")).toBe(
      "application/json",
    )
    test.expect(await jsonResponse.json()).toEqual({ type: "json" })

    test.expect(htmlResponse.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8",
    )
    test.expect(await htmlResponse.text()).toBe("<div>html</div>")
  })

  test.test("returns 406 for unacceptable content type", async () => {
    const routes = Route.tree({
      "/data": Route.get(Route.json({ type: "json" })),
    })

    const response = await Effect.runPromise(
      Effect.scoped(
        Effect
          .gen(function*() {
            const bunServer = yield* BunHttpServer.BunHttpServer
            return yield* Effect.promise(() =>
              fetch(`http://localhost:${bunServer.server.port}/data`, {
                headers: { Accept: "image/png" },
              })
            )
          })
          .pipe(Effect.provide(testLayer(routes))),
      ),
    )

    test.expect(response.status).toBe(406)
  })

  test.test("handles parameterized routes", async () => {
    const routes = Route.tree({
      "/users/:id": Route.get(Route.text("user")),
    })

    const response = await Effect.runPromise(
      Effect.scoped(
        Effect
          .gen(function*() {
            const bunServer = yield* BunHttpServer.BunHttpServer
            return yield* Effect.promise(() =>
              fetch(`http://localhost:${bunServer.server.port}/users/123`)
            )
          })
          .pipe(Effect.provide(testLayer(routes))),
      ),
    )

    test.expect(response.status).toBe(200)
    test.expect(await response.text()).toBe("user")
  })
})
