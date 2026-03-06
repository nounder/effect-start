import * as test from "bun:test"
import * as Development from "effect-start/Development"
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

test.it("converts string to text/plain for Route.text", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(Route.get(Route.text("Hello World")))
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/text")

    test.expect(entity.status).toBe(200)
    test.expect(entity.headers["content-type"]).toBe("text/plain; charset=utf-8")
    test.expect(yield* entity.text).toBe("Hello World")
  }).pipe(Effect.runPromise),
)

test.it("converts string to text/html for Route.html", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(Route.get(Route.html("<h1>Hello</h1>")))
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/html")

    test.expect(entity.status).toBe(200)
    test.expect(entity.headers["content-type"]).toBe("text/html; charset=utf-8")
    test.expect(yield* entity.text).toBe("<h1>Hello</h1>")
  }).pipe(Effect.runPromise),
)

test.it("converts object to JSON for Route.json", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(Route.get(Route.json({ message: "hello", count: 42 })))
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/json")

    test.expect(entity.status).toBe(200)
    test.expect(entity.headers["content-type"]).toBe("application/json")
    test.expect(yield* entity.json).toEqual({ message: "hello", count: 42 })
  }).pipe(Effect.runPromise),
)

test.it("converts array to JSON for Route.json", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(Route.get(Route.json([1, 2, 3])))
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/array")

    test.expect(entity.status).toBe(200)
    test.expect(entity.headers["content-type"]).toBe("application/json")
    test.expect(yield* entity.json).toEqual([1, 2, 3])
  }).pipe(Effect.runPromise),
)

test.it("handles method-specific routes", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.text("get resource")).post(Route.text("post resource")),
    )
    const client = Fetch.fromHandler(handler)

    const getEntity = yield* client.get("http://localhost/resource")
    test.expect(yield* getEntity.text).toBe("get resource")

    const postEntity = yield* client.post("http://localhost/resource")
    test.expect(yield* postEntity.text).toBe("post resource")
  }).pipe(Effect.runPromise),
)

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
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/error")

    test.expect(entity.status).toBe(500)

    const text = yield* entity.text

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
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/defect")

    test.expect(entity.status).toBe(500)

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
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/error")

    test.expect(entity.status).toBe(500)

    const body = (yield* entity.json) as any

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

test.it("includes descriptor properties in handler context", () =>
  Effect.gen(function* () {
    let capturedMethod: string | undefined

    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.text(function* (ctx) {
          capturedMethod = ctx.method
          return "ok"
        }),
      ),
    )
    const client = Fetch.fromHandler(handler)
    yield* client.get("http://localhost/test")

    test.expect(capturedMethod).toBe("GET")
  }).pipe(Effect.runPromise),
)

test.it("includes request in handler context", () =>
  Effect.gen(function* () {
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
    const client = Fetch.fromHandler(handler)
    yield* client.get("http://localhost/test", {
      headers: { "x-custom": "value" },
    })

    test.expect(capturedRequest).toBeInstanceOf(Request)
    test.expect(capturedRequest?.headers.get("x-custom")).toBe("value")
  }).pipe(Effect.runPromise),
)

test.it("returns Allow header on 405 and OPTIONS responses", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.text("users")).post(Route.text("created")),
    )
    const client = Fetch.fromHandler(handler)

    const notAllowed = yield* client.fetch("http://localhost/users", { method: "DELETE" })
    test.expect(notAllowed.status).toBe(405)
    test.expect(notAllowed.headers["allow"]).toBe("GET, POST, HEAD")

    const options = yield* client.fetch("http://localhost/users", { method: "OPTIONS" })
    test.expect(options.status).toBe(204)
    test.expect(options.headers["allow"]).toBe("GET, POST, HEAD")
  }).pipe(Effect.runPromise),
)

test.it("uses explicit OPTIONS handler when registered", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.text("users")).options(Route.json({ cors: true })),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.fetch("http://localhost/users", { method: "OPTIONS" })

    test.expect(entity.status).toBe(200)
    test.expect(yield* entity.json).toEqual({ cors: true })
  }).pipe(Effect.runPromise),
)

test.it("HEAD request to GET route returns 200 with no body", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(Route.get(Route.text("Hello World")))
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.fetch("http://localhost/text", { method: "HEAD" })

    test.expect(entity.status).toBe(200)
    test.expect(entity.headers["content-type"]).toBe("text/plain; charset=utf-8")
    test.expect(yield* entity.text).toBe("")
  }).pipe(Effect.runPromise),
)

test.it("HEAD is included in Allow header when GET routes exist", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.text("users")).post(Route.text("created")),
    )
    const client = Fetch.fromHandler(handler)

    const notAllowed = yield* client.fetch("http://localhost/users", { method: "DELETE" })
    test.expect(notAllowed.headers["allow"]).toContain("HEAD")

    const options = yield* client.fetch("http://localhost/users", { method: "OPTIONS" })
    test.expect(options.headers["allow"]).toContain("HEAD")
  }).pipe(Effect.runPromise),
)

test.it("explicit HEAD route takes precedence over GET fallback", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.text("from GET")).head(Route.text("from HEAD")),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.fetch("http://localhost/text", { method: "HEAD" })

    test.expect(entity.status).toBe(200)
  }).pipe(Effect.runPromise),
)

test.it("supports POST method", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(Route.post(Route.text("created")))
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.post("http://localhost/users")

    test.expect(entity.status).toBe(200)
    test.expect(yield* entity.text).toBe("created")
  }).pipe(Effect.runPromise),
)

test.it("selects json when Accept prefers application/json", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/data", {
      headers: { Accept: "application/json" },
    })

    test.expect(entity.headers["content-type"]).toBe("application/json")
    test.expect(yield* entity.json).toEqual({ type: "json" })
  }).pipe(Effect.runPromise),
)

test.it("selects html when Accept prefers text/html", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/data", {
      headers: { Accept: "text/html" },
    })

    test.expect(entity.headers["content-type"]).toBe("text/html; charset=utf-8")
    test.expect(yield* entity.text).toBe("<div>html</div>")
  }).pipe(Effect.runPromise),
)

test.it("selects text/plain when Accept prefers it", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.text("plain text")).get(Route.json({ type: "json" })),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/data", {
      headers: { Accept: "text/plain" },
    })

    test.expect(entity.headers["content-type"]).toBe("text/plain; charset=utf-8")
    test.expect(yield* entity.text).toBe("plain text")
  }).pipe(Effect.runPromise),
)

test.it("returns first candidate when no Accept header", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/data")

    test.expect(entity.headers["content-type"]).toBe("application/json")
  }).pipe(Effect.runPromise),
)

test.it("handles Accept with quality values", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/data", {
      headers: { Accept: "text/html;q=0.9, application/json;q=1.0" },
    })

    test.expect(entity.headers["content-type"]).toBe("application/json")
  }).pipe(Effect.runPromise),
)

test.it("handles Accept: */*", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/data", {
      headers: { Accept: "*/*" },
    })

    test.expect(entity.headers["content-type"]).toBe("application/json")
  }).pipe(Effect.runPromise),
)

test.it("returns 406 when Accept doesn't match available formats", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(Route.get(Route.json({ type: "json" })))
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/data", {
      headers: { Accept: "text/html" },
    })

    test.expect(entity.status).toBe(406)
    test.expect(yield* entity.json).toEqual({ status: 406, message: "not acceptable" })
  }).pipe(Effect.runPromise),
)

test.it("returns 406 when Accept doesn't match any of multiple formats", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/data", {
      headers: { Accept: "image/png" },
    })

    test.expect(entity.status).toBe(406)
  }).pipe(Effect.runPromise),
)

test.it("definition order determines priority when no Accept header", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.text("plain")).get(Route.html("<div>html</div>")),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/data")

    test.expect(entity.headers["content-type"]).toBe("text/plain; charset=utf-8")
  }).pipe(Effect.runPromise),
)

test.it("sets Vary: Accept when multiple formats exist", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/data", {
      headers: { Accept: "application/json" },
    })

    test.expect(entity.status).toBe(200)
    test.expect(entity.headers["vary"]).toBe("Accept")
  }).pipe(Effect.runPromise),
)

test.it("does not set Vary: Accept when only one format exists", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(Route.get(Route.json({ type: "json" })))
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/data", {
      headers: { Accept: "application/json" },
    })

    test.expect(entity.status).toBe(200)
    test.expect(entity.headers["vary"]).toBeUndefined()
  }).pipe(Effect.runPromise),
)

test.it("sets Vary: Accept when no Accept header but multiple formats", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.json({ type: "json" })).get(Route.text("plain")),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/data")

    test.expect(entity.status).toBe(200)
    test.expect(entity.headers["vary"]).toBe("Accept")
  }).pipe(Effect.runPromise),
)

test.it("falls back to html when no Accept header and no json or text", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(Route.get(Route.html("<div>html</div>")))
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/data")

    test.expect(entity.headers["content-type"]).toBe("text/html; charset=utf-8")
  }).pipe(Effect.runPromise),
)

test.it("Route.text matches any text/* Accept header", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.text(function* () {
          return Entity.make("event: message\ndata: hello\n\n", {
            headers: { "content-type": "text/event-stream" },
          })
        }),
      ),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/events", {
      headers: { Accept: "text/event-stream" },
    })

    test.expect(entity.status).toBe(200)
    test.expect(entity.headers["content-type"]).toBe("text/event-stream")
    test.expect(yield* entity.text).toBe("event: message\ndata: hello\n\n")
  }).pipe(Effect.runPromise),
)

test.it("Route.text matches text/markdown Accept header", () =>
  Effect.gen(function* () {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.text(function* () {
          return Entity.make("# Hello", {
            headers: { "content-type": "text/markdown" },
          })
        }),
      ),
    )
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/doc", {
      headers: { Accept: "text/markdown" },
    })

    test.expect(entity.status).toBe(200)
    test.expect(entity.headers["content-type"]).toBe("text/markdown")
  }).pipe(Effect.runPromise),
)

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

test.describe(Route.devOnly, () => {
  test.it("halts the route chain outside dev", () =>
    Effect.gen(function* () {
      const calls: Array<string> = []
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.devOnly,
          Route.text(function* () {
            calls.push("public")
            return "public"
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(404)
      test.expect(calls).toEqual([])
    }).pipe(Effect.runPromise),
  )

  test.it("falls through in dev", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<Development.Development>()
      const calls: Array<string> = []
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.get(
          Route.devOnly,
          Route.text(function* () {
            calls.push("public")
            return "public"
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("public")
      test.expect(calls).toEqual(["public"])
    }).pipe(Effect.provide(Development.layerTest), Effect.runPromise),
  )

  test.it("propagates through use() to all methods in dev", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<Development.Development>()
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.use(
          Route.filter(function* () {
            return { context: { shared: true as const } }
          }),
        )
          .use(Route.devOnly)
          .get(
            Route.text(function* (ctx) {
              return `${ctx.shared}:get`
            }),
          )
          .post(
            Route.text(function* (ctx) {
              return `${ctx.shared}:post`
            }),
          ),
      )
      const client = Fetch.fromHandler(handler)

      const getEntity = yield* client.get("http://localhost/test")

      test.expect(getEntity.status).toBe(200)
      test.expect(yield* getEntity.text).toBe("true:get")

      const postEntity = yield* client.post("http://localhost/test")

      test.expect(postEntity.status).toBe(200)
      test.expect(yield* postEntity.text).toBe("true:post")
    }).pipe(Effect.provide(Development.layerTest), Effect.runPromise),
  )

  test.it("walkHandles excludes development routes from web handlers", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<Development.Development>()
      const tree = RouteTree.make({
        "/development-only": Route.use(Route.devOnly),
        "/mixed": Route.get(Route.devOnly, Route.text("public")),
      })

      const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))

      test.expect(handles).not.toHaveProperty("/development-only")
      test.expect(handles).toHaveProperty("/mixed")

      const client = Fetch.fromHandler(handles["/mixed"])
      const entity = yield* client.get("http://localhost/mixed")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("public")
    }).pipe(Effect.provide(Development.layerTest), Effect.runPromise),
  )

  test.it(
    "walkHandles with Route.tree wildcard development layer excludes routes outside dev",
    () => {
      const tree = Route.tree({
        "*": Route.use(Route.devOnly),
        "/public": Route.get(Route.text("public")),
      })
      const handles = Object.fromEntries(RouteHttp.walkHandles(tree))

      test.expect(handles).not.toHaveProperty("/public")
    },
  )

  test.it("walkHandles with Route.tree wildcard development layer keeps routes in dev", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<Development.Development>()
      const tree = Route.tree({
        "*": Route.use(Route.devOnly),
        "/public": Route.get(Route.text("public")),
      })

      const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))

      test.expect(handles).toHaveProperty("/public")

      const client = Fetch.fromHandler(handles["/public"])
      const entity = yield* client.get("http://localhost/public")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("public")
    }).pipe(Effect.provide(Development.layerTest), Effect.runPromise),
  )
})

test.describe("middleware chain", () => {
  test.it("passes enriched context to handler", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.use(Route.filter({ context: { answer: 42 } })).get(
          Route.text(function* (ctx) {
            return `The answer is ${ctx.answer}`
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("The answer is 42")
    }).pipe(Effect.runPromise),
  )

  test.it("composes multiple middlewares with cumulative context", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.use(Route.filter({ context: { a: 1 } }))
          .use(Route.filter({ context: { b: 2 } }))
          .get(
            Route.text(function* (ctx) {
              return `a=${ctx.a},b=${ctx.b}`
            }),
          ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(yield* entity.text).toBe("a=1,b=2")
    }).pipe(Effect.runPromise),
  )

  test.it("later middleware can access earlier context", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(yield* entity.text).toBe("doubled=20")
    }).pipe(Effect.runPromise),
  )

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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(500)
      test.expect(yield* entity.text).toContain("middleware failed")

      const messages = yield* TestLogger.messages

      test.expect(messages.some((m) => m.includes("middleware failed"))).toBe(true)
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("applies middleware to all methods", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)

      const getEntity = yield* client.get("http://localhost/test")
      test.expect(yield* getEntity.text).toBe("GET:true")

      const postEntity = yield* client.post("http://localhost/test")
      test.expect(yield* postEntity.text).toBe("POST:true")
    }).pipe(Effect.runPromise),
  )

  test.it("method-specific middleware enriches context for that method", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.filter({ context: { methodSpecific: true } }),
          Route.text(function* (ctx) {
            return `methodSpecific=${ctx.methodSpecific}`
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(yield* entity.text).toBe("methodSpecific=true")
    }).pipe(Effect.runPromise),
  )

  test.it("wildcard and method-specific middlewares compose in order", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.use(Route.filter({ context: { a: 1 } })).get(
          Route.filter({ context: { b: 2 } }),
          Route.text(function* (ctx) {
            return `a=${ctx.a},b=${ctx.b}`
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(yield* entity.text).toBe("a=1,b=2")
    }).pipe(Effect.runPromise),
  )

  test.it("method-specific middleware only affects its method", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)

      const getEntity = yield* client.get("http://localhost/test")
      test.expect(yield* getEntity.text).toBe("GET:true")

      const postEntity = yield* client.post("http://localhost/test")
      test.expect(yield* postEntity.text).toBe("POST:undefined")
    }).pipe(Effect.runPromise),
  )

  test.it("json middleware wraps json response content", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.use(
          Route.json(function* (_ctx, next) {
            const value = yield* next().json
            return { data: value }
          }),
        ).get(Route.json({ message: "hello", count: 42 })),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(200)
      test.expect(entity.headers["content-type"]).toBe("application/json")
      test.expect(yield* entity.json).toEqual({ data: { message: "hello", count: 42 } })
    }).pipe(Effect.runPromise),
  )

  test.it("multiple json middlewares compose in order", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(yield* entity.json).toEqual({ outer: { inner: { original: true } } })
    }).pipe(Effect.runPromise),
  )

  test.it("json middleware passes through non-json responses", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)

      const textEntity = yield* client.get("http://localhost/test", {
        headers: { Accept: "text/plain" },
      })

      test.expect(textEntity.headers["content-type"]).toBe("text/plain; charset=utf-8")
      test.expect(yield* textEntity.text).toBe("plain text")

      const jsonEntity = yield* client.get("http://localhost/test", {
        headers: { Accept: "application/json" },
      })

      test.expect(yield* jsonEntity.json).toEqual({ wrapped: { type: "json" } })
    }).pipe(Effect.runPromise),
  )

  test.it("text middleware wraps text response content", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.use(
          Route.text(function* (_ctx, next) {
            const value = yield* next().text
            return `wrapped: ${value}`
          }),
        ).get(Route.text("hello")),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.headers["content-type"]).toBe("text/plain; charset=utf-8")
      test.expect(yield* entity.text).toBe("wrapped: hello")
    }).pipe(Effect.runPromise),
  )

  test.it("html middleware wraps html response content", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.use(
          Route.html(function* (_ctx, next) {
            const value = yield* next().text
            return `<div>${value}</div>`
          }),
        ).get(Route.html("<span>content</span>")),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.headers["content-type"]).toBe("text/html; charset=utf-8")
      test.expect(yield* entity.text).toBe("<div><span>content</span></div>")
    }).pipe(Effect.runPromise),
  )

  test.it("bytes middleware wraps bytes response content", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.headers["content-type"]).toBe("application/octet-stream")
      test.expect(yield* entity.text).toBe("wrapped:data")
    }).pipe(Effect.runPromise),
  )

  test.it("chains middlewares in order", () =>
    Effect.gen(function* () {
      const calls: Array<string> = []

      const handler = RouteHttp.toWebHandler(
        Route.use(
          Route.filter({
            context: {
              name: "Johnny",
            },
          }),
          Route.text(function* (_ctx, next) {
            calls.push("wildcard text 1")
            return "1st layout: " + (yield* next().text)
          }),
          Route.json(function* (_ctx, next) {
            calls.push("wildcard json")
            return { data: yield* next().json }
          }),
          Route.text(function* (_ctx, next) {
            calls.push("wildcard text 2")
            return "2nd layout: " + (yield* next().text)
          }),
        ).get(
          Route.json(function* (_ctx) {
            calls.push("method json")
            return { ok: true }
          }),
          Route.text(function* (_ctx, next) {
            calls.push("method text 1")
            return "Prefix: " + (yield* next().text)
          }),
          Route.text(function* (ctx) {
            calls.push("method text 2")
            return `Hello, ${ctx.name}`
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test", {
        headers: { Accept: "text/plain" },
      })

      test
        .expect(calls)
        .toEqual(["wildcard text 1", "wildcard text 2", "method text 1", "method text 2"])

      test.expect(entity.status).toBe(200)
      test.expect(entity.headers["content-type"]).toBe("text/plain; charset=utf-8")
      test.expect(yield* entity.text).toBe("1st layout: 2nd layout: Prefix: Hello, Johnny")
    }).pipe(Effect.runPromise),
  )

  test.it("schema headers parsing works with HttpServerRequest service", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test", {
        headers: { "x-test": "test-value" },
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("header=test-value")
    }).pipe(Effect.runPromise),
  )

  test.it("merges headers", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test", {
        headers: {
          "x-shared": "shared-value",
          "x-get-only": "get-value",
        },
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("shared=shared-value,getOnly=get-value")
    }).pipe(Effect.runPromise),
  )
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
  test.it("streams text response", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.text(function* () {
            return Stream.make("Hello", " ", "World")
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/stream")

      test.expect(entity.headers["content-type"]).toBe("text/plain; charset=utf-8")
      test.expect(yield* entity.text).toBe("Hello World")
    }).pipe(Effect.runPromise),
  )

  test.it("streams html response", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.html(function* () {
            return Stream.make("<div>", "content", "</div>")
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/stream")

      test.expect(entity.headers["content-type"]).toBe("text/html; charset=utf-8")
      test.expect(yield* entity.text).toBe("<div>content</div>")
    }).pipe(Effect.runPromise),
  )

  test.it("streams bytes response", () =>
    Effect.gen(function* () {
      const encoder = new TextEncoder()
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.bytes(function* () {
            return Stream.make(encoder.encode("chunk1"), encoder.encode("chunk2"))
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/stream")

      test.expect(entity.headers["content-type"]).toBe("application/octet-stream")
      test.expect(yield* entity.text).toBe("chunk1chunk2")
    }).pipe(Effect.runPromise),
  )

  test.it("handles stream errors gracefully", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.text(function* () {
            return Stream.make("start").pipe(Stream.concat(Stream.fail(new Error("stream error"))))
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/error")

      test.expect(entity.status).toBe(200)

      const exit = yield* entity.text.pipe(Effect.exit)
      test.expect(exit._tag).toBe("Failure")
    }).pipe(Effect.runPromise),
  )
})

test.describe("schema handlers", () => {
  test.it("parses headers, cookies, and search params together", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test?page=2&limit=10", {
        headers: {
          "x-api-key": "secret-key",
          cookie: "session=abc123",
        },
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.json).toEqual({
        apiKey: "secret-key",
        session: "abc123",
        page: 2,
        limit: 10,
      })
    }).pipe(Effect.runPromise),
  )

  test.it("parses JSON body with headers", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.post("http://localhost/users", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Alice", age: 30 }),
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.json).toEqual({
        contentType: "application/json",
        name: "Alice",
        age: 30,
      })
    }).pipe(Effect.runPromise),
  )

  test.it("parses URL-encoded body", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.post("http://localhost/login", {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "username=alice&password=secret",
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.json).toEqual({
        username: "alice",
        hasPassword: true,
      })
    }).pipe(Effect.runPromise),
  )

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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test?count=not-a-number")

      test.expect(entity.status).toBe(400)

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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(400)

      const messages = yield* TestLogger.messages

      test.expect(messages.some((m) => m.includes("x-required"))).toBe(true)
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("parses multipart form data with file", () =>
    Effect.gen(function* () {
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

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.post("http://localhost/upload", {
        body: formData,
      })

      test.expect(entity.status).toBe(200)

      const json = (yield* entity.json) as any

      test.expect(json.title).toBe("My Upload")
      test.expect(json.fileName).toBe("test.txt")
      test.expect(json.contentType).toContain("text/plain")
      test.expect(json.size).toBe(11)
    }).pipe(Effect.runPromise),
  )

  test.it("handles multiple files with same field name", () =>
    Effect.gen(function* () {
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

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.post("http://localhost/upload", {
        body: formData,
      })

      test.expect(entity.status).toBe(200)

      const json = (yield* entity.json) as any

      test.expect(json.count).toBe(3)
      test.expect(json.names).toEqual(["doc1.txt", "doc2.txt", "doc3.txt"])
      test.expect(json.sizes).toEqual([18, 19, 18])
    }).pipe(Effect.runPromise),
  )

  test.it("handles single file upload", () =>
    Effect.gen(function* () {
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

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.post("http://localhost/upload", {
        body: formData,
      })

      test.expect(entity.status).toBe(200)

      const json = (yield* entity.json) as any

      test.expect(json.name).toBe("avatar.png")
      test.expect(json.type).toContain("image/png")
      test.expect(json.size).toBe(15)
    }).pipe(Effect.runPromise),
  )

  test.it("handles multiple string values for same field", () =>
    Effect.gen(function* () {
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

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.post("http://localhost/upload", {
        body: formData,
      })

      test.expect(entity.status).toBe(200)

      const json = (yield* entity.json) as any

      test.expect(json.title).toBe("My Post")
      test.expect(json.tags).toEqual(["javascript", "typescript", "effect"])
    }).pipe(Effect.runPromise),
  )

  test.it("schema validation: single value with Schema.String succeeds", () =>
    Effect.gen(function* () {
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

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.post("http://localhost/test", {
        body: formData,
      })

      test.expect(entity.status).toBe(200)

      const json = (yield* entity.json) as any

      test.expect(json.name).toBe("John")
    }).pipe(Effect.runPromise),
  )

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

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.post("http://localhost/test", {
        body: formData,
      })

      test.expect(entity.status).toBe(400)

      const body = (yield* entity.json) as any

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

      const client = Fetch.fromHandler(handler)
      yield* client.post("http://localhost/test", {
        body: formData,
      })

      const messages = yield* Ref.get(testLogger.messages)
      const errorLogs = messages.filter((msg) => msg.includes("[Error]"))

      test.expect(errorLogs.length).toBeGreaterThan(0)

      test.expect(errorLogs[0]).toContain("ParseError")
      test.expect(errorLogs[0]).toContain('Expected string, actual ["John","Jane"]')
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("composes shared middleware with method-specific schema", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)

      const postEntity = yield* client.post("http://localhost/api", {
        headers: {
          "x-api-version": "v2",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "create" }),
      })

      test.expect(yield* postEntity.json).toEqual({ version: "v2", action: "create" })

      const getEntity = yield* client.get("http://localhost/api?id=123", {
        headers: { "x-api-version": "v2" },
      })

      test.expect(yield* getEntity.json).toEqual({ version: "v2", id: "123" })
    }).pipe(Effect.runPromise),
  )

  test.it("handles cookies with equals sign in value", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test", {
        headers: { cookie: "token=abc=123==" },
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.json).toEqual({ token: "abc=123==" })
    }).pipe(Effect.runPromise),
  )

  test.it("handles multiple search params with same key", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test?tags=one&tags=two&tags=three")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.json).toEqual({ tags: ["one", "two", "three"] })
    }).pipe(Effect.runPromise),
  )

  test.it("parses path params from RouteTree", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/folders/abc123/files/42")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.json).toEqual({
        folderId: "abc123",
        fileId: 42,
      })
    }).pipe(Effect.runPromise),
  )

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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/users/not-a-number")

      test.expect(entity.status).toBe(400)

      const messages = yield* TestLogger.messages

      test.expect(messages.some((m) => m.includes("ParseError"))).toBe(true)
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("combines path params with headers and body", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.post("http://localhost/projects/proj-999/tasks", {
        headers: { "x-api-key": "secret" },
        body: JSON.stringify({ title: "New Task" }),
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.json).toEqual({
        projectId: "proj-999",
        apiKey: "secret",
        title: "New Task",
      })
    }).pipe(Effect.runPromise),
  )
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
  test.it("layer routes execute in order before path routes", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handles["/test"])
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(200)
      test.expect(calls).toEqual(["layer1", "layer2", "handler"])
    }).pipe(Effect.runPromise),
  )

  test.it("layer routes apply to all paths in the tree", () =>
    Effect.gen(function* () {
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

      const usersClient = Fetch.fromHandler(handles["/users"])
      const adminClient = Fetch.fromHandler(handles["/admin"])

      calls.length = 0
      yield* usersClient.get("http://localhost/users")

      test.expect(calls).toEqual(["layer", "users"])

      calls.length = 0
      yield* adminClient.get("http://localhost/admin")

      test.expect(calls).toEqual(["layer", "admin"])
    }).pipe(Effect.runPromise),
  )

  test.it("layer execution does not leak between requests", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handles["/test"])

      layerCallCount = 0
      yield* client.get("http://localhost/test")

      test.expect(layerCallCount).toBe(1)

      yield* client.get("http://localhost/test")

      test.expect(layerCallCount).toBe(2)
    }).pipe(Effect.runPromise),
  )

  test.it("nested tree inherits parent layer routes", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handles["/api/users"])
      yield* client.get("http://localhost/api/users")

      test.expect(calls).toEqual(["root-layer", "users"])
    }).pipe(Effect.runPromise),
  )

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
      const client = Fetch.fromHandler(handles["/test"])
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(500)

      test.expect(handlerExecuted).toBe(false)

      const text = yield* entity.text

      test.expect(text).toContain("layer rejected")

      const messages = yield* TestLogger.messages

      test.expect(messages.some((m) => m.includes("layer rejected"))).toBe(true)
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("layer middleware wraps response content with json", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handles["/data"])
      const entity = yield* client.get("http://localhost/data")

      test.expect(yield* entity.json).toEqual({ wrapped: { original: true } })
    }).pipe(Effect.runPromise),
  )

  test.it("layer middleware wraps response content with text", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handles["/page"])
      const entity = yield* client.get("http://localhost/page")

      test.expect(yield* entity.text).toBe("Layout: Page Content")
    }).pipe(Effect.runPromise),
  )

  test.it("multiple layers execute in definition order", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handles["/test"])
      yield* client.get("http://localhost/test")

      test.expect(calls).toEqual(["layer1", "layer2", "handler"])
    }).pipe(Effect.runPromise),
  )

  test.it("format negotiation excludes middleware formats", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handles["/"])
      const entity = yield* client.get("http://localhost/")

      test.expect(entity.status).toBe(200)
      test.expect(entity.headers["content-type"]).toBe("text/html; charset=utf-8")
      test.expect(yield* entity.text).toBe("<h1>Hello</h1>")
    }).pipe(Effect.runPromise),
  )
})

test.describe("Route.render (format=*)", () => {
  test.it("accepts any Accept header", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.render(function* () {
            return Stream.make("event: message\ndata: hello\n\n")
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/events", {
        headers: { Accept: "text/event-stream" },
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("event: message\ndata: hello\n\n")
    }).pipe(Effect.runPromise),
  )

  test.it("works without Accept header", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.render(function* () {
            return "raw response"
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/raw")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("raw response")
    }).pipe(Effect.runPromise),
  )

  test.it("does not participate in content negotiation", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(Route.json({ type: "json" })).get(
          Route.render(function* () {
            return "fallback"
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)

      const jsonEntity = yield* client.get("http://localhost/data", {
        headers: { Accept: "application/json" },
      })

      test.expect(yield* jsonEntity.json).toEqual({ type: "json" })

      const eventStreamEntity = yield* client.get("http://localhost/data", {
        headers: { Accept: "text/event-stream" },
      })

      test.expect(eventStreamEntity.status).toBe(200)
      test.expect(yield* eventStreamEntity.text).toBe("fallback")
    }).pipe(Effect.runPromise),
  )

  test.it("is always called regardless of Accept header when only handle routes exist", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.render(function* () {
            return "any format"
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)

      const entities = [
        yield* client.get("http://localhost/", {
          headers: { Accept: "text/event-stream" },
        }),
        yield* client.get("http://localhost/", { headers: { Accept: "image/png" } }),
        yield* client.get("http://localhost/", { headers: { Accept: "*/*" } }),
        yield* client.get("http://localhost/"),
      ]

      for (const entity of entities) {
        test.expect(entity.status).toBe(200)
        test.expect(yield* entity.text).toBe("any format")
      }
    }).pipe(Effect.runPromise),
  )

  test.it("can return Entity with custom headers", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/events", {
        headers: { Accept: "text/event-stream" },
      })

      test.expect(entity.status).toBe(200)
      test.expect(entity.headers).toMatchObject({
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      })
      test.expect(yield* entity.text).toBe("data: hello\n\n")
    }).pipe(Effect.runPromise),
  )

  test.it("handle middleware wraps handle handler", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/", {
        headers: { Accept: "text/event-stream" },
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("wrapped: inner")
    }).pipe(Effect.runPromise),
  )

  test.it("render middleware always runs even when specific format is selected", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/", {
        headers: { Accept: "application/json" },
      })

      test.expect(entity.status).toBe(200)
      test.expect(calls).toEqual(["render middleware", "json handler"])
      test.expect(yield* entity.json).toEqual({ type: "json" })
    }).pipe(Effect.runPromise),
  )

  test.it("next() from render matches both render and selected format routes", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/", {
        headers: { Accept: "application/json" },
      })

      test.expect(entity.status).toBe(200)
      test
        .expect(calls)
        .toEqual(["render middleware 1", "render middleware 2", "json middleware", "json handler"])
    }).pipe(Effect.runPromise),
  )

  test.it("render handler runs when no specific format matches", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const eventStreamEntity = yield* client.get("http://localhost/", {
        headers: { Accept: "text/event-stream" },
      })

      test.expect(eventStreamEntity.status).toBe(200)
      test.expect(calls).toEqual(["render"])
      test.expect(yield* eventStreamEntity.text).toBe("render output")
    }).pipe(Effect.runPromise),
  )

  test.it("render used as fallback when Accept doesn't match other formats", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.json({ type: "json" }),
          Route.html("<h1>html</h1>"),
          Route.render(function* () {
            return "fallback for unknown accept"
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const eventStreamEntity = yield* client.get("http://localhost/", {
        headers: { Accept: "text/event-stream" },
      })

      test.expect(eventStreamEntity.status).toBe(200)
      test.expect(yield* eventStreamEntity.text).toBe("fallback for unknown accept")
    }).pipe(Effect.runPromise),
  )

  test.it("handler context includes format=*", () => {
    Route.get(
      Route.render(function* (ctx) {
        test.expectTypeOf(ctx.format).toEqualTypeOf<"*">()

        return "ok"
      }),
    )
  })

  test.it("streams work correctly with render", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.render(function* () {
            return Stream.make("chunk1", "chunk2", "chunk3")
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/stream", {
        headers: { Accept: "text/event-stream" },
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("chunk1chunk2chunk3")
    }).pipe(Effect.runPromise),
  )

  test.it("multiple render middlewares chain correctly", () =>
    Effect.gen(function* () {
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
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("outer(inner(content))")
    }).pipe(Effect.runPromise),
  )

  test.it("render middleware can wrap text handler", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.use(
          Route.render(function* (_ctx, next) {
            const value = yield* next().text
            return `[${value}]`
          }),
        ).get(Route.text("hello")),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/", {
        headers: { Accept: "text/plain" },
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("[hello]")
    }).pipe(Effect.runPromise),
  )

  test.it("render middleware can wrap html handler", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.use(
          Route.render(function* (_ctx, next) {
            const value = yield* next().text
            return `<!DOCTYPE html>${value}`
          }),
        ).get(Route.html("<body>content</body>")),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/", {
        headers: { Accept: "text/html" },
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("<!DOCTYPE html><body>content</body>")
    }).pipe(Effect.runPromise),
  )
})
