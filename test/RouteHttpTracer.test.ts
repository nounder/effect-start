import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type * as Tracer from "effect/Tracer"
import * as Fetch from "effect-start/Fetch"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as RouteHttpTracer from "effect-start/RouteHttpTracer"
import * as RouteTree from "effect-start/RouteTree"

test.describe("tracing", () => {
  test.it("creates span with correct name and kind", () =>
    Effect.gen(function* () {
      let capturedSpan: Tracer.Span | undefined

      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.text(function* () {
            const span = yield* Effect.currentSpan
            capturedSpan = span
            return "ok"
          }),
        ),
      )

      const client = Fetch.fromHandler(handler)
      yield* client.get("http://localhost/test")

      test.expect(capturedSpan).toBeDefined()
      test.expect(capturedSpan?.name).toBe("http.server GET")
      test.expect(capturedSpan?.kind).toBe("server")
    }).pipe(Effect.runPromise),
  )

  test.it("adds request attributes to span", () =>
    Effect.gen(function* () {
      let capturedSpan: Tracer.Span | undefined

      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.text(function* () {
            const span = yield* Effect.currentSpan
            capturedSpan = span
            return "ok"
          }),
        ),
      )

      const client = Fetch.fromHandler(handler)
      yield* client.get("http://localhost/users?page=1&limit=10", {
        headers: { "user-agent": "test-agent" },
      })

      test.expect(capturedSpan?.attributes.get("http.request.method")).toBe("GET")
      test.expect(capturedSpan?.attributes.get("url.path")).toBe("/users")
      test.expect(capturedSpan?.attributes.get("url.query")).toBe("page=1&limit=10")
      test.expect(capturedSpan?.attributes.get("url.scheme")).toBe("http")
      test.expect(capturedSpan?.attributes.get("user_agent.original")).toBe("test-agent")
    }).pipe(Effect.runPromise),
  )

  test.it("adds response status code to span", () =>
    Effect.gen(function* () {
      let capturedSpan: Tracer.Span | undefined

      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.text(function* () {
            const span = yield* Effect.currentSpan
            capturedSpan = span
            return "ok"
          }),
        ),
      )

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")
      test.expect(entity.status).toBe(200)
      yield* Effect.sleep("10 millis")
      test.expect(capturedSpan?.attributes.get("http.response.status_code")).toBe(200)
    }).pipe(Effect.runPromise),
  )

  test.it("parses W3C traceparent header for parent span", () =>
    Effect.gen(function* () {
      let capturedSpan: Tracer.Span | undefined

      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.text(function* () {
            const span = yield* Effect.currentSpan
            capturedSpan = span
            return "ok"
          }),
        ),
      )

      const client = Fetch.fromHandler(handler)
      yield* client.get("http://localhost/test", {
        headers: {
          traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
        },
      })

      test.expect(capturedSpan?.parent).toBeDefined()

      const parent = Option.getOrUndefined(capturedSpan?.parent ?? Option.none()) as
        | Tracer.AnySpan
        | undefined

      test.expect(parent?.traceId).toBe("0af7651916cd43dd8448eb211c80319c")
      test.expect(parent?.spanId).toBe("b7ad6b7169203331")
    }).pipe(Effect.runPromise),
  )

  test.it("parses B3 single header for parent span", () =>
    Effect.gen(function* () {
      let capturedSpan: Tracer.Span | undefined

      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.text(function* () {
            const span = yield* Effect.currentSpan
            capturedSpan = span
            return "ok"
          }),
        ),
      )

      const client = Fetch.fromHandler(handler)
      yield* client.get("http://localhost/test", {
        headers: {
          b3: "80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1-1",
        },
      })

      test.expect(capturedSpan?.parent).toBeDefined()

      const parent = Option.getOrUndefined(capturedSpan?.parent ?? Option.none()) as
        | Tracer.AnySpan
        | undefined

      test.expect(parent?.traceId).toBe("80f198ee56343ba864fe8b2a57d3eff7")
      test.expect(parent?.spanId).toBe("e457b5a2e4d86bd1")
    }).pipe(Effect.runPromise),
  )

  test.it("parses X-B3 multi headers for parent span", () =>
    Effect.gen(function* () {
      let capturedSpan: Tracer.Span | undefined

      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.text(function* () {
            const span = yield* Effect.currentSpan
            capturedSpan = span
            return "ok"
          }),
        ),
      )

      const client = Fetch.fromHandler(handler)
      yield* client.get("http://localhost/test", {
        headers: {
          "x-b3-traceid": "463ac35c9f6413ad48485a3953bb6124",
          "x-b3-spanid": "0020000000000001",
          "x-b3-sampled": "1",
        },
      })

      test.expect(capturedSpan?.parent).toBeDefined()

      const parent = Option.getOrUndefined(capturedSpan?.parent ?? Option.none()) as
        | Tracer.AnySpan
        | undefined

      test.expect(parent?.traceId).toBe("463ac35c9f6413ad48485a3953bb6124")
      test.expect(parent?.spanId).toBe("0020000000000001")
    }).pipe(Effect.runPromise),
  )

  test.it("withTracerDisabledWhen disables tracing for matching requests", () =>
    Effect.gen(function* () {
      let spanCapturedOnHealth = false
      let spanCapturedOnUsers = false

      const runtime = yield* RouteHttpTracer.withTracerDisabledWhen(
        Effect.runtime<never>(),
        (req) => new URL(req.url).pathname === "/health",
      )
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.get(
          Route.text(function* () {
            const spanResult = yield* Effect.option(Effect.currentSpan)
            if (Option.isSome(spanResult)) {
              const path = spanResult.value.attributes.get("url.path")
              if (path === "/health") spanCapturedOnHealth = true
              if (path === "/users") spanCapturedOnUsers = true
            }
            return "ok"
          }),
        ),
      )

      const client = Fetch.fromHandler(handler)
      yield* client.get("http://localhost/health")
      yield* client.get("http://localhost/users")

      test.expect(spanCapturedOnHealth).toBe(false)
      test.expect(spanCapturedOnUsers).toBe(true)
    }).pipe(Effect.runPromise),
  )

  test.it("withSpanNameGenerator customizes span name", () =>
    Effect.gen(function* () {
      let capturedSpan: Tracer.Span | undefined

      const runtime = yield* RouteHttpTracer.withSpanNameGenerator(
        Effect.runtime<never>(),
        (req) => {
          const url = new URL(req.url)
          return `${req.method} ${url.pathname}`
        },
      )
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.get(
          Route.text(function* () {
            const span = yield* Effect.currentSpan
            capturedSpan = span
            return "ok"
          }),
        ),
      )

      const client = Fetch.fromHandler(handler)
      yield* client.get("http://localhost/users")

      test.expect(capturedSpan?.name).toBe("GET /users")
    }).pipe(Effect.runPromise),
  )

  test.it("adds http.route attribute when route has path", () =>
    Effect.gen(function* () {
      let capturedSpan: Tracer.Span | undefined

      const tree = RouteTree.make({
        "/users/:id": Route.get(
          Route.text(function* () {
            const span = yield* Effect.currentSpan
            capturedSpan = span
            return "ok"
          }),
        ),
      })

      const handles = Object.fromEntries(RouteHttp.walkHandles(tree))
      const handler = handles["/users/:id"]

      const client = Fetch.fromHandler(handler)
      yield* client.get("http://localhost/users/123")

      test.expect(capturedSpan?.attributes.get("http.route")).toBe("/users/:id")
    }).pipe(Effect.runPromise),
  )
})
