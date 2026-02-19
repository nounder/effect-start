import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import * as Schedule from "effect/Schedule"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Entity from "effect-start/Entity"
import * as Fetch from "effect-start/Fetch"
import * as Http from "../src/_Http.ts"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as RouteSchema from "effect-start/RouteSchema"
import * as RouteTree from "effect-start/RouteTree"
import { TestLogger } from "effect-start/testing"

test.it("converts string to text/plain for Route.text", async () => {
  const handler = RouteHttp.toWebHandler(Route.get(Route.text("Hello World")))
  const response = await Fetch.fromHandler(handler, { path: "/text" })

  test.expect(response.status).toBe(200)
  test.expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")
  test.expect(await response.text()).toBe("Hello World")
})

test.it("converts string to text/html for Route.html", async () => {
  const handler = RouteHttp.toWebHandler(Route.get(Route.html("<h1>Hello</h1>")))
  const response = await Fetch.fromHandler(handler, { path: "/html" })

  test.expect(response.status).toBe(200)
  test.expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
  test.expect(await response.text()).toBe("<h1>Hello</h1>")
})

test.it("converts object to JSON for Route.json", async () => {
  const handler = RouteHttp.toWebHandler(Route.get(Route.json({ message: "hello", count: 42 })))
  const response = await Fetch.fromHandler(handler, { path: "/json" })

  test.expect(response.status).toBe(200)
  test.expect(response.headers.get("Content-Type")).toBe("application/json")
  test.expect(await response.json()).toEqual({ message: "hello", count: 42 })
})

test.it("converts array to JSON for Route.json", async () => {
  const handler = RouteHttp.toWebHandler(Route.get(Route.json([1, 2, 3])))
  const response = await Fetch.fromHandler(handler, { path: "/array" })

  test.expect(response.status).toBe(200)
  test.expect(response.headers.get("Content-Type")).toBe("application/json")
  test.expect(await response.json()).toEqual([1, 2, 3])
})

test.it("handles method-specific routes", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.text("get resource")).post(Route.text("post resource")),
  )

  const getResponse = await Fetch.fromHandler(handler, {
    path: "/resource",
    method: "GET",
  })

  test.expect(await getResponse.text()).toBe("get resource")

  const postResponse = await Fetch.fromHandler(handler, {
    path: "/resource",
    method: "POST",
  })

  test.expect(await postResponse.text()).toBe("post resource")
})

test.it("handles errors by returning 500 response", () =>
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<TestLogger.TestLogger>()
    const handler = RouteHttp.toWebHandlerRuntime(runtime)(
      Route.get(
        Route.text(function* (): Generator<any, string, any> {
          return yield* Effect.fail(new Error("Something went wrong"))
        }),
      ),
    )
    const response = yield* Effect.promise(() => Fetch.fromHandler(handler, { path: "/error" }))

    test.expect(response.status).toBe(500)

    const text = yield* Effect.promise(() => response.text())

    test.expect(text).toContain("Something went wrong")

    const messages = yield* TestLogger.messages

    test.expect(messages.some((m) => m.includes("Something went wrong"))).toBe(true)
  }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
)

test.it("handles defects by returning 500 response", () =>
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<TestLogger.TestLogger>()
    const handler = RouteHttp.toWebHandlerRuntime(runtime)(
      Route.get(
        Route.text(function* () {
          return yield* Effect.die("Unexpected error")

          return "Hello"
        }),
      ),
    )
    const response = yield* Effect.promise(() => Fetch.fromHandler(handler, { path: "/defect" }))

    test.expect(response.status).toBe(500)

    const messages = yield* TestLogger.messages

    test.expect(messages.some((m) => m.includes("Unexpected error"))).toBe(true)
  }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
)

test.it("error response includes stack trace and cause chain", () =>
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<TestLogger.TestLogger>()
    const handler = RouteHttp.toWebHandlerRuntime(runtime)(
      Route.get(
        Route.text(function* (): Generator<any, string, any> {
          const innerError = new Error("Database connection failed")
          const outerError = new Error("Query failed", { cause: innerError })
          return yield* Effect.fail(outerError)
        }),
      ),
    )
    const response = yield* Effect.promise(() => Fetch.fromHandler(handler, { path: "/error" }))

    test.expect(response.status).toBe(500)

    const body = yield* Effect.promise(() => response.json())

    test
      .expect(body.message)
      .toMatch(/Error: Query failed[\s\S]+\[cause\]: Error: Database connection failed/)

    const messages = yield* TestLogger.messages
    const errorLog = messages.find((m) => m.startsWith("[Error]"))

    test
      .expect(errorLog)
      .toMatch(/Error: Query failed[\s\S]+\[cause\]: Error: Database connection failed/)
  }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
)

test.it("includes descriptor properties in handler context", async () => {
  let capturedMethod: string | undefined

  const handler = RouteHttp.toWebHandler(
    Route.get(
      Route.text(function* (ctx) {
        capturedMethod = ctx.method
        return "ok"
      }),
    ),
  )
  await Fetch.fromHandler(handler, { path: "/test" })

  test.expect(capturedMethod).toBe("GET")
})

test.it("includes request in handler context", async () => {
  let capturedRequest: Request | undefined

  const handler = RouteHttp.toWebHandler(
    Route.get(
      Route.text(function* (ctx) {
        test.expectTypeOf(ctx.request).toEqualTypeOf<Request>()

        capturedRequest = ctx.request
        return "ok"
      }),
    ),
  )
  await Fetch.fromHandler(handler, {
    path: "/test",
    headers: { "x-custom": "value" },
  })

  test.expect(capturedRequest).toBeInstanceOf(Request)
  test.expect(capturedRequest?.headers.get("x-custom")).toBe("value")
})

test.it("returns Allow header on 405 and OPTIONS responses", async () => {
  const handler = RouteHttp.toWebHandler(Route.get(Route.text("users")).post(Route.text("created")))

  const notAllowed = await Fetch.fromHandler(handler, { path: "/users", method: "DELETE" })
  test.expect(notAllowed.status).toBe(405)
  test.expect(notAllowed.headers.get("allow")).toBe("GET, POST")

  const options = await Fetch.fromHandler(handler, { path: "/users", method: "OPTIONS" })
  test.expect(options.status).toBe(204)
  test.expect(options.headers.get("allow")).toBe("GET, POST")
})

test.it("uses explicit OPTIONS handler when registered", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.text("users")).options(Route.json({ cors: true })),
  )
  const response = await Fetch.fromHandler(handler, { path: "/users", method: "OPTIONS" })

  test.expect(response.status).toBe(200)
  test.expect(await response.json()).toEqual({ cors: true })
})

test.it("supports POST method", async () => {
  const handler = RouteHttp.toWebHandler(Route.post(Route.text("created")))
  const response = await Fetch.fromHandler(handler, {
    path: "/users",
    method: "POST",
  })

  test.expect(response.status).toBe(200)
  test.expect(await response.text()).toBe("created")
})

test.it("selects json when Accept prefers application/json", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
  )
  const response = await Fetch.fromHandler(handler, {
    path: "/data",
    headers: { Accept: "application/json" },
  })

  test.expect(response.headers.get("Content-Type")).toBe("application/json")
  test.expect(await response.json()).toEqual({ type: "json" })
})

test.it("selects html when Accept prefers text/html", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
  )
  const response = await Fetch.fromHandler(handler, {
    path: "/data",
    headers: { Accept: "text/html" },
  })

  test.expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
  test.expect(await response.text()).toBe("<div>html</div>")
})

test.it("selects text/plain when Accept prefers it", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.text("plain text")).get(Route.json({ type: "json" })),
  )
  const response = await Fetch.fromHandler(handler, {
    path: "/data",
    headers: { Accept: "text/plain" },
  })

  test.expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")
  test.expect(await response.text()).toBe("plain text")
})

test.it("returns first candidate when no Accept header", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
  )
  const response = await Fetch.fromHandler(handler, { path: "/data" })

  test.expect(response.headers.get("Content-Type")).toBe("application/json")
})

test.it("handles Accept with quality values", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
  )
  const response = await Fetch.fromHandler(handler, {
    path: "/data",
    headers: { Accept: "text/html;q=0.9, application/json;q=1.0" },
  })

  test.expect(response.headers.get("Content-Type")).toBe("application/json")
})

test.it("handles Accept: */*", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
  )
  const response = await Fetch.fromHandler(handler, {
    path: "/data",
    headers: { Accept: "*/*" },
  })

  test.expect(response.headers.get("Content-Type")).toBe("application/json")
})

test.it("returns 406 when Accept doesn't match available formats", async () => {
  const handler = RouteHttp.toWebHandler(Route.get(Route.json({ type: "json" })))
  const response = await Fetch.fromHandler(handler, {
    path: "/data",
    headers: { Accept: "text/html" },
  })

  test.expect(response.status).toBe(406)
  test.expect(await response.json()).toEqual({ status: 406, message: "not acceptable" })
})

test.it("returns 406 when Accept doesn't match any of multiple formats", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
  )
  const response = await Fetch.fromHandler(handler, {
    path: "/data",
    headers: { Accept: "image/png" },
  })

  test.expect(response.status).toBe(406)
})

test.it("definition order determines priority when no Accept header", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.text("plain")).get(Route.html("<div>html</div>")),
  )
  const response = await Fetch.fromHandler(handler, { path: "/data" })

  test.expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")
})

test.it("sets Vary: Accept when multiple formats exist", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
  )
  const response = await Fetch.fromHandler(handler, {
    path: "/data",
    headers: { Accept: "application/json" },
  })

  test.expect(response.status).toBe(200)
  test.expect(response.headers.get("vary")).toBe("Accept")
})

test.it("does not set Vary: Accept when only one format exists", async () => {
  const handler = RouteHttp.toWebHandler(Route.get(Route.json({ type: "json" })))
  const response = await Fetch.fromHandler(handler, {
    path: "/data",
    headers: { Accept: "application/json" },
  })

  test.expect(response.status).toBe(200)
  test.expect(response.headers.get("vary")).toBeNull()
})

test.it("sets Vary: Accept when no Accept header but multiple formats", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.json({ type: "json" })).get(Route.text("plain")),
  )
  const response = await Fetch.fromHandler(handler, { path: "/data" })

  test.expect(response.status).toBe(200)
  test.expect(response.headers.get("vary")).toBe("Accept")
})

test.it("falls back to html when no Accept header and no json or text", async () => {
  const handler = RouteHttp.toWebHandler(Route.get(Route.html("<div>html</div>")))
  const response = await Fetch.fromHandler(handler, { path: "/data" })

  test.expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
})

test.it("Route.text matches any text/* Accept header", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(
      Route.text(function* () {
        return Entity.make("event: message\ndata: hello\n\n", {
          headers: { "content-type": "text/event-stream" },
        })
      }),
    ),
  )

  const response = await Fetch.fromHandler(handler, {
    path: "/events",
    headers: { Accept: "text/event-stream" },
  })

  test.expect(response.status).toBe(200)
  test.expect(response.headers.get("Content-Type")).toBe("text/event-stream")
  test.expect(await response.text()).toBe("event: message\ndata: hello\n\n")
})

test.it("Route.text matches text/markdown Accept header", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(
      Route.text(function* () {
        return Entity.make("# Hello", {
          headers: { "content-type": "text/markdown" },
        })
      }),
    ),
  )

  const response = await Fetch.fromHandler(handler, {
    path: "/doc",
    headers: { Accept: "text/markdown" },
  })

  test.expect(response.status).toBe(200)
  test.expect(response.headers.get("Content-Type")).toBe("text/markdown")
})

test.describe("walkHandles", () => {
  test.it("yields handlers for static routes", () => {
    const tree = RouteTree.make({
      "/users": Route.get(Route.text("users list")),
      "/admin": Route.get(Route.text("admin")),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))

    test.expect("/users" in handles).toBe(true)
    test.expect("/admin" in handles).toBe(true)
  })

  test.it("yields handlers for parameterized routes", () => {
    const tree = RouteTree.make({
      "/users/:id": Route.get(Route.text("user detail")),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))

    test.expect("/users/:id" in handles).toBe(true)
  })

  test.it("preserves optional param syntax", () => {
    const tree = RouteTree.make({
      "/files/:name?": Route.get(Route.text("files")),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))

    test.expect("/files/:name?" in handles).toBe(true)
  })

  test.it("preserves wildcard param syntax", () => {
    const tree = RouteTree.make({
      "/docs/:path*": Route.get(Route.text("docs")),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))

    test.expect("/docs/:path*" in handles).toBe(true)
  })
})

test.describe("middleware chain", () => {
  test.it("passes enriched context to handler", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(Route.filter({ context: { answer: 42 } })).get(
        Route.text(function* (ctx) {
          return `The answer is ${ctx.answer}`
        }),
      ),
    )
    const response = await Fetch.fromHandler(handler, { path: "/test" })

    test.expect(response.status).toBe(200)
    test.expect(await response.text()).toBe("The answer is 42")
  })

  test.it("composes multiple middlewares with cumulative context", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(Route.filter({ context: { a: 1 } }))
        .use(Route.filter({ context: { b: 2 } }))
        .get(
          Route.text(function* (ctx) {
            return `a=${ctx.a},b=${ctx.b}`
          }),
        ),
    )
    const response = await Fetch.fromHandler(handler, { path: "/test" })

    test.expect(await response.text()).toBe("a=1,b=2")
  })

  test.it("later middleware can access earlier context", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(Route.filter({ context: { x: 10 } }))
        .use(
          Route.filter(function* (ctx) {
            return { context: { doubled: ctx.x * 2 } }
          }),
        )
        .get(
          Route.text(function* (ctx) {
            return `doubled=${ctx.doubled}`
          }),
        ),
    )
    const response = await Fetch.fromHandler(handler, { path: "/test" })

    test.expect(await response.text()).toBe("doubled=20")
  })

  test.it("middleware error short-circuits chain", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<TestLogger.TestLogger>()
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.use(
          Route.filter(function* () {
            return yield* Effect.fail(new Error("middleware failed"))
          }),
        ).get(Route.text("should not reach")),
      )
      const response = yield* Effect.promise(() => Fetch.fromHandler(handler, { path: "/test" }))

      test.expect(response.status).toBe(500)
      test.expect(yield* Effect.promise(() => response.text())).toContain("middleware failed")

      const messages = yield* TestLogger.messages

      test.expect(messages.some((m) => m.includes("middleware failed"))).toBe(true)
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("applies middleware to all methods", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(Route.filter({ context: { shared: true } }))
        .get(
          Route.text(function* (ctx) {
            return `GET:${ctx.shared}`
          }),
        )
        .post(
          Route.text(function* (ctx) {
            return `POST:${ctx.shared}`
          }),
        ),
    )

    const getResponse = await Fetch.fromHandler(handler, {
      path: "/test",
      method: "GET",
    })

    test.expect(await getResponse.text()).toBe("GET:true")

    const postResponse = await Fetch.fromHandler(handler, {
      path: "/test",
      method: "POST",
    })

    test.expect(await postResponse.text()).toBe("POST:true")
  })

  test.it("method-specific middleware enriches context for that method", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.filter({ context: { methodSpecific: true } }),
        Route.text(function* (ctx) {
          return `methodSpecific=${ctx.methodSpecific}`
        }),
      ),
    )
    const response = await Fetch.fromHandler(handler, { path: "/test" })

    test.expect(await response.text()).toBe("methodSpecific=true")
  })

  test.it("wildcard and method-specific middlewares compose in order", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(Route.filter({ context: { a: 1 } })).get(
        Route.filter({ context: { b: 2 } }),
        Route.text(function* (ctx) {
          return `a=${ctx.a},b=${ctx.b}`
        }),
      ),
    )
    const response = await Fetch.fromHandler(handler, { path: "/test" })

    test.expect(await response.text()).toBe("a=1,b=2")
  })

  test.it("method-specific middleware only affects its method", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.filter({ context: { getOnly: true } }),
        Route.text(function* (ctx) {
          return `GET:${ctx.getOnly}`
        }),
      ).post(
        Route.text(function* (ctx) {
          return `POST:${(ctx as any).getOnly}`
        }),
      ),
    )

    const getResponse = await Fetch.fromHandler(handler, {
      path: "/test",
      method: "GET",
    })

    test.expect(await getResponse.text()).toBe("GET:true")

    const postResponse = await Fetch.fromHandler(handler, {
      path: "/test",
      method: "POST",
    })

    test.expect(await postResponse.text()).toBe("POST:undefined")
  })

  test.it("json middleware wraps json response content", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(
        Route.json(function* (_ctx, next) {
          const value = yield* next().json
          return { data: value }
        }),
      ).get(Route.json({ message: "hello", count: 42 })),
    )
    const response = await Fetch.fromHandler(handler, { path: "/test" })

    test.expect(response.status).toBe(200)
    test.expect(response.headers.get("Content-Type")).toBe("application/json")
    test.expect(await response.json()).toEqual({ data: { message: "hello", count: 42 } })
  })

  test.it("multiple json middlewares compose in order", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(
        Route.json(function* (_ctx, next) {
          const value = yield* next().json
          return { outer: value }
        }),
      )
        .use(
          Route.json(function* (_ctx, next) {
            const value = yield* next().json
            return { inner: value }
          }),
        )
        .get(Route.json({ original: true })),
    )
    const response = await Fetch.fromHandler(handler, { path: "/test" })

    test.expect(await response.json()).toEqual({ outer: { inner: { original: true } } })
  })

  test.it("json middleware passes through non-json responses", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(
        Route.json(function* (_ctx, next) {
          const value = yield* next().json
          return { wrapped: value }
        }),
      )
        .get(Route.json({ type: "json" }))
        .get(Route.text("plain text")),
    )

    const textResponse = await Fetch.fromHandler(handler, {
      path: "/test",
      headers: { Accept: "text/plain" },
    })

    test.expect(textResponse.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")
    test.expect(await textResponse.text()).toBe("plain text")

    const jsonResponse = await Fetch.fromHandler(handler, {
      path: "/test",
      headers: { Accept: "application/json" },
    })

    test.expect(await jsonResponse.json()).toEqual({ wrapped: { type: "json" } })
  })

  test.it("text middleware wraps text response content", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(
        Route.text(function* (_ctx, next) {
          const value = yield* next().text
          return `wrapped: ${value}`
        }),
      ).get(Route.text("hello")),
    )
    const response = await Fetch.fromHandler(handler, { path: "/test" })

    test.expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")
    test.expect(await response.text()).toBe("wrapped: hello")
  })

  test.it("html middleware wraps html response content", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(
        Route.html(function* (_ctx, next) {
          const value = yield* next().text
          return `<div>${value}</div>`
        }),
      ).get(Route.html("<span>content</span>")),
    )
    const response = await Fetch.fromHandler(handler, { path: "/test" })

    test.expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
    test.expect(await response.text()).toBe("<div><span>content</span></div>")
  })

  test.it("bytes middleware wraps bytes response content", async () => {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const handler = RouteHttp.toWebHandler(
      Route.use(
        Route.bytes(function* (_ctx, next) {
          const value = yield* next().bytes
          const text = decoder.decode(value)
          return encoder.encode(`wrapped:${text}`)
        }),
      ).get(Route.bytes(encoder.encode("data"))),
    )
    const response = await Fetch.fromHandler(handler, { path: "/test" })

    test.expect(response.headers.get("Content-Type")).toBe("application/octet-stream")
    test.expect(await response.text()).toBe("wrapped:data")
  })

  test.it("chains middlewares in order", async () => {
    const calls: Array<string> = []

    const handler = RouteHttp.toWebHandler(
      Route.use(
        // always called
        Route.filter({
          context: {
            name: "Johnny",
          },
        }),
        // called 1st
        // next is related handler with same format (here format="text" descriptor)
        Route.text(function* (_ctx, next) {
          calls.push("wildcard text 1")
          return "1st layout: " + (yield* next().text)
        }),
        // never called because it's unrelated (different format descriptor)
        Route.json(function* (_ctx, next) {
          calls.push("wildcard json")
          return { data: yield* next().json }
        }),
        // called 2nd
        // no other related handler in the same method,
        // continue traversing RouteHttp middleware chain
        Route.text(function* (_ctx, next) {
          calls.push("wildcard text 2")
          return "2nd layout: " + (yield* next().text)
        }),
      ).get(
        // never called because doesn't pass content negotiation check in RouteHttp middleware
        Route.json(function* (_ctx) {
          calls.push("method json")
          return { ok: true }
        }),
        // called 3rd
        Route.text(function* (_ctx, next) {
          calls.push("method text 1")
          return "Prefix: " + (yield* next().text)
        }),
        // called 4th - terminal, no next() call
        Route.text(function* (ctx) {
          calls.push("method text 2")
          return `Hello, ${ctx.name}`
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/test",
      headers: { Accept: "text/plain" },
    })

    test
      .expect(calls)
      .toEqual(["wildcard text 1", "wildcard text 2", "method text 1", "method text 2"])

    test.expect(response.status).toBe(200)
    test.expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")
    test.expect(await response.text()).toBe("1st layout: 2nd layout: Prefix: Hello, Johnny")
  })

  test.it("schema headers parsing works with HttpServerRequest service", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        RouteSchema.schemaHeaders(
          Schema.Struct({
            "x-test": Schema.String,
          }),
        ),
        Route.text(function* (ctx) {
          return `header=${ctx.headers["x-test"]}`
        }),
      ),
    )
    const response = await Fetch.fromHandler(handler, {
      path: "/test",
      headers: { "x-test": "test-value" },
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.text()).toBe("header=test-value")
  })

  test.it("merges headers", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(
        RouteSchema.schemaHeaders(
          Schema.Struct({
            "x-shared": Schema.String,
          }),
        ),
      ).get(
        RouteSchema.schemaHeaders(
          Schema.Struct({
            "x-get-only": Schema.String,
          }),
        ),
        Route.text(function* (ctx) {
          return `shared=${ctx.headers["x-shared"]},getOnly=${ctx.headers["x-get-only"]}`
        }),
      ),
    )
    const response = await Fetch.fromHandler(handler, {
      path: "/test",
      headers: {
        "x-shared": "shared-value",
        "x-get-only": "get-value",
      },
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.text()).toBe("shared=shared-value,getOnly=get-value")
  })
})

test.describe("toWebHandler type constraints", () => {
  test.it("accepts routes with method", () => {
    RouteHttp.toWebHandler(Route.get(Route.text("hello")))
  })

  test.it("accepts multiple routes with methods", () => {
    RouteHttp.toWebHandler(Route.get(Route.text("hello")).post(Route.text("world")))
  })

  test.it("rejects routes without method", () => {
    const noMethod = Route.empty.pipe(Route.text("hello"))
    // @ts-expect-error
    RouteHttp.toWebHandler(noMethod)
  })

  test.it("rejects mixed routes where one has method and one doesn't", () => {
    const withMethod = Route.get(Route.text("hello"))
    const withoutMethod = Route.empty.pipe(Route.text("hello"))
    const mixed = [...withMethod, ...withoutMethod] as const
    // @ts-expect-error
    RouteHttp.toWebHandler(mixed)
  })
})

test.describe("streaming responses", () => {
  test.it("streams text response", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.text(function* () {
          return Stream.make("Hello", " ", "World")
        }),
      ),
    )
    const response = await Fetch.fromHandler(handler, { path: "/stream" })

    test.expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")
    test.expect(await response.text()).toBe("Hello World")
  })

  test.it("streams html response", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.html(function* () {
          return Stream.make("<div>", "content", "</div>")
        }),
      ),
    )
    const response = await Fetch.fromHandler(handler, { path: "/stream" })

    test.expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
    test.expect(await response.text()).toBe("<div>content</div>")
  })

  test.it("streams bytes response", async () => {
    const encoder = new TextEncoder()
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.bytes(function* () {
          return Stream.make(encoder.encode("chunk1"), encoder.encode("chunk2"))
        }),
      ),
    )
    const response = await Fetch.fromHandler(handler, { path: "/stream" })

    test.expect(response.headers.get("Content-Type")).toBe("application/octet-stream")
    test.expect(await response.text()).toBe("chunk1chunk2")
  })

  test.it("handles stream errors gracefully", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.text(function* () {
          return Stream.make("start").pipe(Stream.concat(Stream.fail(new Error("stream error"))))
        }),
      ),
    )
    const response = await Fetch.fromHandler(handler, { path: "/error" })

    test.expect(response.status).toBe(200)

    await test.expect(response.text()).rejects.toThrow("stream error")
  })
})

test.describe("schema handlers", () => {
  test.it("parses headers, cookies, and search params together", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        RouteSchema.schemaHeaders(
          Schema.Struct({
            "x-api-key": Schema.String,
          }),
        ),
        RouteSchema.schemaCookies(
          Schema.Struct({
            session: Schema.String,
          }),
        ),
        RouteSchema.schemaSearchParams(
          Schema.Struct({
            page: Schema.NumberFromString,
            limit: Schema.optional(Schema.NumberFromString),
          }),
        ),
        Route.json(function* (ctx) {
          return {
            apiKey: ctx.headers["x-api-key"],
            session: ctx.cookies.session,
            page: ctx.searchParams.page,
            limit: ctx.searchParams.limit,
          }
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/test?page=2&limit=10",
      headers: {
        "x-api-key": "secret-key",
        cookie: "session=abc123",
      },
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.json()).toEqual({
      apiKey: "secret-key",
      session: "abc123",
      page: 2,
      limit: 10,
    })
  })

  test.it("parses JSON body with headers", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.post(
        RouteSchema.schemaHeaders(
          Schema.Struct({
            "content-type": Schema.String,
          }),
        ),
        RouteSchema.schemaBodyJson(
          Schema.Struct({
            name: Schema.String,
            age: Schema.Number,
          }),
        ),
        Route.json(function* (ctx) {
          return {
            contentType: ctx.headers["content-type"],
            name: ctx.body.name,
            age: ctx.body.age,
          }
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/users",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", age: 30 }),
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.json()).toEqual({
      contentType: "application/json",
      name: "Alice",
      age: 30,
    })
  })

  test.it("parses URL-encoded body", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.post(
        RouteSchema.schemaBodyUrlParams(
          Schema.Struct({
            username: Schema.String,
            password: Schema.String,
          }),
        ),
        Route.json(function* (ctx) {
          return {
            username: ctx.body.username,
            hasPassword: ctx.body.password.length > 0,
          }
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/login",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=alice&password=secret",
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.json()).toEqual({
      username: "alice",
      hasPassword: true,
    })
  })

  test.it("returns 400 on schema validation failure", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<TestLogger.TestLogger>()
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.get(
          RouteSchema.schemaSearchParams(
            Schema.Struct({
              count: Schema.NumberFromString,
            }),
          ),
          Route.text("ok"),
        ),
      )

      const response = yield* Effect.promise(() =>
        Fetch.fromHandler(handler, { path: "/test?count=not-a-number" }),
      )

      test.expect(response.status).toBe(400)

      const messages = yield* TestLogger.messages

      test.expect(messages.some((m) => m.includes("ParseError"))).toBe(true)
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("handles missing required fields", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<TestLogger.TestLogger>()
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.get(
          RouteSchema.schemaHeaders(
            Schema.Struct({
              "x-required": Schema.String,
            }),
          ),
          Route.text("ok"),
        ),
      )

      const response = yield* Effect.promise(() => Fetch.fromHandler(handler, { path: "/test" }))

      test.expect(response.status).toBe(400)

      const messages = yield* TestLogger.messages

      test.expect(messages.some((m) => m.includes("x-required"))).toBe(true)
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("parses multipart form data with file", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.post(
        RouteSchema.schemaBodyMultipart(
          Schema.Struct({
            title: Schema.String,
            file: Schema.Array(RouteSchema.File),
          }),
        ),
        Route.json(function* (ctx) {
          const file = ctx.body.file[0]
          return {
            title: ctx.body.title,
            fileName: file.name,
            contentType: file.contentType,
            size: file.content.length,
          }
        }),
      ),
    )

    const formData = new FormData()
    formData.append("title", "My Upload")
    formData.append("file", new Blob(["hello world"], { type: "text/plain" }), "test.txt")

    const response = await Fetch.fromHandler(handler, {
      path: "/upload",
      method: "POST",
      body: formData,
    })

    test.expect(response.status).toBe(200)

    const json = await response.json()

    test.expect(json.title).toBe("My Upload")
    test.expect(json.fileName).toBe("test.txt")
    test.expect(json.contentType).toContain("text/plain")
    test.expect(json.size).toBe(11)
  })

  test.it("handles multiple files with same field name", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.post(
        RouteSchema.schemaBodyMultipart(
          Schema.Struct({
            documents: Schema.Array(RouteSchema.File),
          }),
        ),
        Route.json(function* (ctx) {
          return {
            count: ctx.body.documents.length,
            names: ctx.body.documents.map((f) => f.name),
            sizes: ctx.body.documents.map((f) => f.content.length),
          }
        }),
      ),
    )

    const formData = new FormData()
    formData.append(
      "documents",
      new Blob(["first file content"], { type: "text/plain" }),
      "doc1.txt",
    )
    formData.append(
      "documents",
      new Blob(["second file content"], { type: "text/plain" }),
      "doc2.txt",
    )
    formData.append(
      "documents",
      new Blob(["third file content"], { type: "text/plain" }),
      "doc3.txt",
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/upload",
      method: "POST",
      body: formData,
    })

    test.expect(response.status).toBe(200)

    const json = await response.json()

    test.expect(json.count).toBe(3)
    test.expect(json.names).toEqual(["doc1.txt", "doc2.txt", "doc3.txt"])
    test.expect(json.sizes).toEqual([18, 19, 18])
  })

  test.it("handles single file upload", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.post(
        RouteSchema.schemaBodyMultipart(
          Schema.Struct({
            image: Schema.Array(RouteSchema.File),
          }),
        ),
        Route.json(function* (ctx) {
          const image = ctx.body.image[0]
          return {
            name: image.name,
            type: image.contentType,
            size: image.content.length,
          }
        }),
      ),
    )

    const formData = new FormData()
    formData.append("image", new Blob(["fake image data"], { type: "image/png" }), "avatar.png")

    const response = await Fetch.fromHandler(handler, {
      path: "/upload",
      method: "POST",
      body: formData,
    })

    test.expect(response.status).toBe(200)

    const json = await response.json()

    test.expect(json.name).toBe("avatar.png")
    test.expect(json.type).toContain("image/png")
    test.expect(json.size).toBe(15)
  })

  test.it("handles multiple string values for same field", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.post(
        RouteSchema.schemaBodyMultipart(
          Schema.Struct({
            tags: Schema.Array(Schema.String),
            title: Schema.String,
          }),
        ),
        Route.json(function* (ctx) {
          return {
            title: ctx.body.title,
            // Schema returns readonly array, but Json type expects mutable array
            tags: [...ctx.body.tags],
          }
        }),
      ),
    )

    const formData = new FormData()
    formData.append("title", "My Post")
    formData.append("tags", "javascript")
    formData.append("tags", "typescript")
    formData.append("tags", "effect")

    const response = await Fetch.fromHandler(handler, {
      path: "/upload",
      method: "POST",
      body: formData,
    })

    test.expect(response.status).toBe(200)

    const json = await response.json()

    test.expect(json.title).toBe("My Post")
    test.expect(json.tags).toEqual(["javascript", "typescript", "effect"])
  })

  test.it("schema validation: single value with Schema.String succeeds", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.post(
        RouteSchema.schemaBodyMultipart(
          Schema.Struct({
            name: Schema.String,
          }),
        ),
        Route.json(function* (ctx) {
          return { name: ctx.body.name }
        }),
      ),
    )

    const formData = new FormData()
    formData.append("name", "John")

    const response = await Fetch.fromHandler(handler, {
      path: "/test",
      method: "POST",
      body: formData,
    })

    test.expect(response.status).toBe(200)

    const json = await response.json()

    test.expect(json.name).toBe("John")
  })

  test.it("schema validation: multiple values with Schema.String fails with detailed error", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<TestLogger.TestLogger>()
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.post(
          RouteSchema.schemaBodyMultipart(
            Schema.Struct({
              name: Schema.String,
            }),
          ),
          Route.json(function* (ctx) {
            return { name: ctx.body.name }
          }),
        ),
      )

      const formData = new FormData()
      formData.append("name", "John")
      formData.append("name", "Jane")

      const response = yield* Effect.promise(() =>
        Fetch.fromHandler(handler, {
          path: "/test",
          method: "POST",
          body: formData,
        }),
      )

      test.expect(response.status).toBe(400)

      const body = yield* Effect.promise(() => response.json())

      test.expect(body.message).toContain("ParseError")
      test.expect(body.message).toContain('Expected string, actual ["John","Jane"]')

      const messages = yield* TestLogger.messages

      test.expect(messages.some((m) => m.includes("ParseError"))).toBe(true)
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("logs validation errors to console", () =>
    Effect.gen(function* () {
      const testLogger = yield* TestLogger.TestLogger
      const runtime = yield* Effect.runtime<TestLogger.TestLogger>()

      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.post(
          RouteSchema.schemaBodyMultipart(
            Schema.Struct({
              name: Schema.String,
            }),
          ),
          Route.json(function* (ctx) {
            return { name: ctx.body.name }
          }),
        ),
      )

      const formData = new FormData()
      formData.append("name", "John")
      formData.append("name", "Jane")

      yield* Effect.promise(() =>
        Fetch.fromHandler(handler, {
          path: "/test",
          method: "POST",
          body: formData,
        }),
      )

      const messages = yield* Ref.get(testLogger.messages)
      const errorLogs = messages.filter((msg) => msg.includes("[Error]"))

      test.expect(errorLogs.length).toBeGreaterThan(0)

      test.expect(errorLogs[0]).toContain("ParseError")
      test.expect(errorLogs[0]).toContain('Expected string, actual ["John","Jane"]')
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("composes shared middleware with method-specific schema", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(
        RouteSchema.schemaHeaders(
          Schema.Struct({
            "x-api-version": Schema.String,
          }),
        ),
      )
        .post(
          RouteSchema.schemaBodyJson(
            Schema.Struct({
              action: Schema.String,
            }),
          ),
          Route.json(function* (ctx) {
            return {
              version: ctx.headers["x-api-version"],
              action: ctx.body.action,
            }
          }),
        )
        .get(
          RouteSchema.schemaSearchParams(
            Schema.Struct({
              id: Schema.String,
            }),
          ),
          Route.json(function* (ctx) {
            return {
              version: ctx.headers["x-api-version"],
              id: ctx.searchParams.id,
            }
          }),
        ),
    )

    const postResponse = await Fetch.fromHandler(handler, {
      path: "/api",
      method: "POST",
      headers: {
        "x-api-version": "v2",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "create" }),
    })

    test.expect(await postResponse.json()).toEqual({ version: "v2", action: "create" })

    const getResponse = await Fetch.fromHandler(handler, {
      path: "/api?id=123",
      method: "GET",
      headers: { "x-api-version": "v2" },
    })

    test.expect(await getResponse.json()).toEqual({ version: "v2", id: "123" })
  })

  test.it("handles cookies with equals sign in value", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        RouteSchema.schemaCookies(
          Schema.Struct({
            token: Schema.String,
          }),
        ),
        Route.json(function* (ctx) {
          return { token: ctx.cookies.token }
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/test",
      headers: { cookie: "token=abc=123==" },
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.json()).toEqual({ token: "abc=123==" })
  })

  test.it("handles multiple search params with same key", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        RouteSchema.schemaSearchParams(
          Schema.Struct({
            tags: Schema.Array(Schema.String),
          }),
        ),
        Route.json(function* (ctx) {
          return { tags: [...ctx.searchParams.tags] }
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/test?tags=one&tags=two&tags=three",
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.json()).toEqual({ tags: ["one", "two", "three"] })
  })

  test.it("parses path params from RouteTree", async () => {
    const tree = RouteTree.make({
      "/folders/:folderId/files/:fileId": Route.get(
        RouteSchema.schemaPathParams(
          Schema.Struct({
            folderId: Schema.String,
            fileId: Schema.NumberFromString,
          }),
        ),
        Route.json(function* (ctx) {
          return {
            folderId: ctx.pathParams.folderId,
            fileId: ctx.pathParams.fileId,
          }
        }),
      ),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))
    const handler = handles["/folders/:folderId/files/:fileId"]

    const response = await Fetch.fromHandler(handler, {
      path: "/folders/abc123/files/42",
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.json()).toEqual({
      folderId: "abc123",
      fileId: 42,
    })
  })

  test.it("path params validation fails on invalid input", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<TestLogger.TestLogger>()
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.get(
          RouteSchema.schemaPathParams(
            Schema.Struct({
              userId: Schema.NumberFromString,
            }),
          ),
          Route.text("ok"),
        ),
      )

      const response = yield* Effect.promise(() =>
        Fetch.fromHandler(handler, { path: "/users/not-a-number" }),
      )

      test.expect(response.status).toBe(400)

      const messages = yield* TestLogger.messages

      test.expect(messages.some((m) => m.includes("ParseError"))).toBe(true)
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("combines path params with headers and body", async () => {
    const tree = RouteTree.make({
      "/projects/:projectId/tasks": Route.post(
        RouteSchema.schemaPathParams(
          Schema.Struct({
            projectId: Schema.String,
          }),
        ),
        RouteSchema.schemaHeaders(
          Schema.Struct({
            "x-api-key": Schema.String,
          }),
        ),
        RouteSchema.schemaBodyJson(
          Schema.Struct({
            title: Schema.String,
          }),
        ),
        Route.json(function* (ctx) {
          return {
            projectId: ctx.pathParams.projectId,
            apiKey: ctx.headers["x-api-key"],
            title: ctx.body.title,
          }
        }),
      ),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))
    const handler = handles["/projects/:projectId/tasks"]

    const response = await Fetch.fromHandler(handler, {
      path: "/projects/proj-999/tasks",
      method: "POST",
      headers: { "x-api-key": "secret" },
      body: { title: "New Task" },
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.json()).toEqual({
      projectId: "proj-999",
      apiKey: "secret",
      title: "New Task",
    })
  })
})

test.describe("request abort handling", () => {
  test.it("returns 499 and runs finalizers when request is aborted", () =>
    Effect.gen(function* () {
      let finalizerRan = false

      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.text(function* () {
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                finalizerRan = true
              }),
            )
            yield* Effect.sleep("10 seconds")
            return "should not reach"
          }),
        ),
      )

      const { request, abort } = Http.createAbortableRequest({ path: "/abort" })

      const responsePromise = handler(request)

      yield* Effect.sleep("10 millis")
      abort()

      const response = yield* Effect.promise(() => Promise.resolve(responsePromise))

      test.expect(response.status).toBe(499)
      test.expect(finalizerRan).toBe(true)
    }).pipe(Effect.runPromise),
  )

  test.it("uses clientAbortFiberId to identify client disconnects", () =>
    Effect.gen(function* () {
      let interruptedBy: string | undefined

      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.text(
            Effect.gen(function* () {
              yield* Effect.sleep("10 seconds")
              return "should not reach"
            }).pipe(
              Effect.onInterrupt((interruptors) =>
                Effect.sync(() => {
                  for (const id of interruptors) {
                    interruptedBy = String(id)
                  }
                }),
              ),
            ),
          ),
        ),
      )

      const { request, abort } = Http.createAbortableRequest({ path: "/abort" })

      const responsePromise = handler(request)

      yield* Effect.sleep("10 millis")
      abort()

      yield* Effect.promise(() => Promise.resolve(responsePromise))

      test.expect(interruptedBy).toContain("-499")
    }).pipe(Effect.runPromise),
  )

  test.it("interrupts streaming response when request is aborted", () =>
    Effect.gen(function* () {
      let finalizerRan = false

      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.text(function* () {
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                finalizerRan = true
              }),
            )
            return Stream.fromSchedule(Schedule.spaced("100 millis")).pipe(
              Stream.map((n) => `event ${n}\n`),
              Stream.take(100),
            )
          }),
        ),
      )

      const { request, abort } = Http.createAbortableRequest({ path: "/stream" })

      const response = yield* Effect.promise(() => Promise.resolve(handler(request)))

      test.expect(response.status).toBe(200)

      const reader = response.body!.getReader()
      const firstChunk = yield* Effect.promise(() => reader.read())

      test.expect(firstChunk.done).toBe(false)

      abort()

      yield* Effect.sleep("50 millis")

      test.expect(finalizerRan).toBe(true)
    }).pipe(Effect.runPromise),
  )
})

test.describe("RouteTree layer routes", () => {
  test.it("layer routes execute in order before path routes", async () => {
    const calls: Array<string> = []

    const tree = RouteTree.make({
      "*": Route.use(
        Route.filter(function* () {
          calls.push("layer1")
          return { context: {} }
        }),
      ).use(
        Route.filter(function* () {
          calls.push("layer2")
          return { context: {} }
        }),
      ),
      "/test": Route.get(
        Route.text(function* () {
          calls.push("handler")
          return "ok"
        }),
      ),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))
    const response = await Fetch.fromHandler(handles["/test"], { path: "/test" })

    test.expect(response.status).toBe(200)
    test.expect(calls).toEqual(["layer1", "layer2", "handler"])
  })

  test.it("layer routes apply to all paths in the tree", async () => {
    const calls: Array<string> = []

    const tree = RouteTree.make({
      "*": Route.use(
        Route.filter(function* () {
          calls.push("layer")
          return { context: {} }
        }),
      ),
      "/users": Route.get(
        Route.text(function* () {
          calls.push("users")
          return "users"
        }),
      ),
      "/admin": Route.get(
        Route.text(function* () {
          calls.push("admin")
          return "admin"
        }),
      ),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))

    calls.length = 0
    await Fetch.fromHandler(handles["/users"], { path: "/users" })

    test.expect(calls).toEqual(["layer", "users"])

    calls.length = 0
    await Fetch.fromHandler(handles["/admin"], { path: "/admin" })

    test.expect(calls).toEqual(["layer", "admin"])
  })

  test.it("layer execution does not leak between requests", async () => {
    let layerCallCount = 0

    const tree = RouteTree.make({
      "*": Route.use(
        Route.filter(function* () {
          layerCallCount++
          return { context: {} }
        }),
      ),
      "/test": Route.get(Route.text("ok")),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))

    layerCallCount = 0
    await Fetch.fromHandler(handles["/test"], { path: "/test" })

    test.expect(layerCallCount).toBe(1)

    await Fetch.fromHandler(handles["/test"], { path: "/test" })

    test.expect(layerCallCount).toBe(2)
  })

  test.it("nested tree inherits parent layer routes", async () => {
    const calls: Array<string> = []

    const apiTree = RouteTree.make({
      "/users": Route.get(
        Route.text(function* () {
          calls.push("users")
          return "users"
        }),
      ),
    })

    const tree = RouteTree.make({
      "*": Route.use(
        Route.filter(function* () {
          calls.push("root-layer")
          return { context: {} }
        }),
      ),
      "/api": apiTree,
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))
    await Fetch.fromHandler(handles["/api/users"], { path: "/api/users" })

    test.expect(calls).toEqual(["root-layer", "users"])
  })

  test.it("layer routes can short-circuit with error", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<TestLogger.TestLogger>()
      let handlerExecuted = false

      const tree = RouteTree.make({
        "*": Route.use(
          Route.filter(function* () {
            return yield* Effect.fail(new Error("layer rejected"))
          }),
        ),
        "/test": Route.get(
          Route.text(function* () {
            handlerExecuted = true
            return "should not reach"
          }),
        ),
      })

      const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))

      const response = yield* Effect.promise(() => Fetch.fromHandler(handles["/test"], { path: "/test" }))

      test.expect(response.status).toBe(500)

      test.expect(handlerExecuted).toBe(false)

      const text = yield* Effect.promise(() => response.text())

      test.expect(text).toContain("layer rejected")

      const messages = yield* TestLogger.messages

      test.expect(messages.some((m) => m.includes("layer rejected"))).toBe(true)
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("layer middleware wraps response content with json", async () => {
    const tree = RouteTree.make({
      "*": Route.use(
        Route.json(function* (_ctx, next) {
          const value = yield* next().json
          return { wrapped: value }
        }),
      ),
      "/data": Route.get(Route.json({ original: true })),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))
    const response = await Fetch.fromHandler(handles["/data"], { path: "/data" })

    test.expect(await response.json()).toEqual({ wrapped: { original: true } })
  })

  test.it("layer middleware wraps response content with text", async () => {
    const tree = RouteTree.make({
      "*": Route.use(
        Route.text(function* (_ctx, next) {
          const value = yield* next().text
          return `Layout: ${value}`
        }),
      ),
      "/page": Route.get(Route.text("Page Content")),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))
    const response = await Fetch.fromHandler(handles["/page"], { path: "/page" })

    test.expect(await response.text()).toBe("Layout: Page Content")
  })

  test.it("multiple layers execute in definition order", async () => {
    const calls: Array<string> = []

    const tree = RouteTree.make({
      "*": Route.use(
        Route.filter(function* () {
          calls.push("layer1")
          return { context: {} }
        }),
      ).use(
        Route.filter(function* () {
          calls.push("layer2")
          return { context: {} }
        }),
      ),
      "/test": Route.get(
        Route.text(function* () {
          calls.push("handler")
          return "ok"
        }),
      ),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))
    await Fetch.fromHandler(handles["/test"], { path: "/test" })

    test.expect(calls).toEqual(["layer1", "layer2", "handler"])
  })

  test.it("format negotiation excludes middleware formats", async () => {
    const tree = RouteTree.make({
      "*": Route.use(
        Route.json(function* (_ctx, next) {
          const value = yield* next().json
          return { wrapped: value }
        }),
      ),
      "/": Route.get(Route.html("<h1>Hello</h1>")),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))
    const response = await Fetch.fromHandler(handles["/"], { path: "/" })

    test.expect(response.status).toBe(200)
    test.expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
    test.expect(await response.text()).toBe("<h1>Hello</h1>")
  })
})

test.describe("Route.render (format=*)", () => {
  test.it("accepts any Accept header", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.render(function* () {
          return Stream.make("event: message\ndata: hello\n\n")
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/events",
      headers: { Accept: "text/event-stream" },
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.text()).toBe("event: message\ndata: hello\n\n")
  })

  test.it("works without Accept header", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.render(function* () {
          return "raw response"
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, { path: "/raw" })

    test.expect(response.status).toBe(200)
    test.expect(await response.text()).toBe("raw response")
  })

  test.it("does not participate in content negotiation", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.json({ type: "json" })).get(
        Route.render(function* () {
          return "fallback"
        }),
      ),
    )

    const jsonResponse = await Fetch.fromHandler(handler, {
      path: "/data",
      headers: { Accept: "application/json" },
    })

    test.expect(await jsonResponse.json()).toEqual({ type: "json" })

    const eventStreamResponse = await Fetch.fromHandler(handler, {
      path: "/data",
      headers: { Accept: "text/event-stream" },
    })

    test.expect(eventStreamResponse.status).toBe(200)
    test.expect(await eventStreamResponse.text()).toBe("fallback")
  })

  test.it(
    "is always called regardless of Accept header when only handle routes exist",
    async () => {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.render(function* () {
            return "any format"
          }),
        ),
      )

      const responses = await Promise.all([
        Fetch.fromHandler(handler, {
          path: "/",
          headers: { Accept: "text/event-stream" },
        }),
        Fetch.fromHandler(handler, { path: "/", headers: { Accept: "image/png" } }),
        Fetch.fromHandler(handler, { path: "/", headers: { Accept: "*/*" } }),
        Fetch.fromHandler(handler, { path: "/" }),
      ])

      for (const response of responses) {
        test.expect(response.status).toBe(200)
        test.expect(await response.text()).toBe("any format")
      }
    },
  )

  test.it("can return Entity with custom headers", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.render(function* () {
          return Entity.make(Stream.make("data: hello\n\n"), {
            headers: {
              "content-type": "text/event-stream",
              "cache-control": "no-cache",
            },
          })
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/events",
      headers: { Accept: "text/event-stream" },
    })

    test.expect(response.status).toBe(200)
    test.expect(response.headers.get("content-type")).toBe("text/event-stream")
    test.expect(response.headers.get("cache-control")).toBe("no-cache")
    test.expect(await response.text()).toBe("data: hello\n\n")
  })

  test.it("handle middleware wraps handle handler", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(
        Route.render(function* (_ctx, next) {
          const value = yield* next().text
          return `wrapped: ${value}`
        }),
      ).get(
        Route.render(function* () {
          return "inner"
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/",
      headers: { Accept: "text/event-stream" },
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.text()).toBe("wrapped: inner")
  })

  test.it("render middleware always runs even when specific format is selected", async () => {
    const calls: Array<string> = []

    const handler = RouteHttp.toWebHandler(
      Route.use(
        Route.render(function* (_ctx, next) {
          calls.push("render middleware")
          return next().stream
        }),
      ).get(
        Route.json(function* () {
          calls.push("json handler")
          return { type: "json" }
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/",
      headers: { Accept: "application/json" },
    })

    test.expect(response.status).toBe(200)
    test.expect(calls).toEqual(["render middleware", "json handler"])
    test.expect(await response.json()).toEqual({ type: "json" })
  })

  test.it("next() from render matches both render and selected format routes", async () => {
    const calls: Array<string> = []

    const handler = RouteHttp.toWebHandler(
      Route.use(
        Route.render(function* (_ctx, next) {
          calls.push("render middleware 1")
          return next().stream
        }),
        Route.render(function* (_ctx, next) {
          calls.push("render middleware 2")
          return next().stream
        }),
        Route.json(function* (_ctx, next) {
          calls.push("json middleware")
          return yield* next().json
        }),
      ).get(
        Route.json(function* () {
          calls.push("json handler")
          return { type: "json" }
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/",
      headers: { Accept: "application/json" },
    })

    test.expect(response.status).toBe(200)
    test
      .expect(calls)
      .toEqual(["render middleware 1", "render middleware 2", "json middleware", "json handler"])
  })

  test.it("render handler runs when no specific format matches", async () => {
    const calls: Array<string> = []

    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.json(function* () {
          calls.push("json")
          return { type: "json" }
        }),
        Route.render(function* () {
          calls.push("render")
          return "render output"
        }),
      ),
    )

    const eventStreamResponse = await Fetch.fromHandler(handler, {
      path: "/",
      headers: { Accept: "text/event-stream" },
    })

    test.expect(eventStreamResponse.status).toBe(200)
    test.expect(calls).toEqual(["render"])
    test.expect(await eventStreamResponse.text()).toBe("render output")
  })

  test.it("render used as fallback when Accept doesn't match other formats", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.json({ type: "json" }),
        Route.html("<h1>html</h1>"),
        Route.render(function* () {
          return "fallback for unknown accept"
        }),
      ),
    )

    const eventStreamResponse = await Fetch.fromHandler(handler, {
      path: "/",
      headers: { Accept: "text/event-stream" },
    })

    test.expect(eventStreamResponse.status).toBe(200)
    test.expect(await eventStreamResponse.text()).toBe("fallback for unknown accept")
  })

  test.it("handler context includes format=*", () => {
    Route.get(
      Route.render(function* (ctx) {
        test.expectTypeOf(ctx.format).toEqualTypeOf<"*">()

        return "ok"
      }),
    )
  })

  test.it("streams work correctly with render", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.render(function* () {
          return Stream.make("chunk1", "chunk2", "chunk3")
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/stream",
      headers: { Accept: "text/event-stream" },
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.text()).toBe("chunk1chunk2chunk3")
  })

  test.it("multiple render middlewares chain correctly", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(
        Route.render(function* (_ctx, next) {
          const value = yield* next().text
          return `outer(${value})`
        }),
        Route.render(function* (_ctx, next) {
          const value = yield* next().text
          return `inner(${value})`
        }),
      ).get(
        Route.render(function* () {
          return "content"
        }),
      ),
    )

    const response = await Fetch.fromHandler(handler, { path: "/" })

    test.expect(response.status).toBe(200)
    test.expect(await response.text()).toBe("outer(inner(content))")
  })

  test.it("render middleware can wrap text handler", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(
        Route.render(function* (_ctx, next) {
          const value = yield* next().text
          return `[${value}]`
        }),
      ).get(Route.text("hello")),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/",
      headers: { Accept: "text/plain" },
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.text()).toBe("[hello]")
  })

  test.it("render middleware can wrap html handler", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.use(
        Route.render(function* (_ctx, next) {
          const value = yield* next().text
          return `<!DOCTYPE html>${value}`
        }),
      ).get(Route.html("<body>content</body>")),
    )

    const response = await Fetch.fromHandler(handler, {
      path: "/",
      headers: { Accept: "text/html" },
    })

    test.expect(response.status).toBe(200)
    test.expect(await response.text()).toBe("<!DOCTYPE html><body>content</body>")
  })
})
