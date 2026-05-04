/** @jsxImportSource effect-start */
import * as test from "bun:test"
import type * as Engine from "effect-start/datastar"
import * as Development from "effect-start/Development"
import * as Effect from "effect/Effect"
import * as Entity from "effect-start/Entity"
import * as Fetch from "effect-start/Fetch"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as Schema from "effect/Schema"

test.describe("Route.html with JSX", () => {
  test.it("renders JSX to HTML string", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(Route.get(Route.html(<div>Hello World</div>)))
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/")

      test.expect(entity.status).toBe(200)
      test.expect(entity.headers["content-type"]).toBe("text/html; charset=utf-8")
      test.expect(yield* entity.text).toBe("<div>Hello World</div>")
    }).pipe(Effect.runPromise),
  )

  test.it("renders nested JSX elements", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.html(
            <div class="container">
              <h1>Title</h1>
              <p>Paragraph</p>
            </div>,
          ),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/")

      test
        .expect(yield* entity.text)
        .toBe('<div class="container"><h1>Title</h1><p>Paragraph</p></div>')
    }).pipe(Effect.runPromise),
  )

  test.it("renders JSX from Effect", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(Route.html(Effect.succeed(<span>From Effect</span>))),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/")

      test.expect(yield* entity.text).toBe("<span>From Effect</span>")
    }).pipe(Effect.runPromise),
  )

  test.it("renders JSX from generator function", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.html(
            Effect.gen(function* () {
              const name = yield* Effect.succeed("World")
              return <div>Hello {name}</div>
            }),
          ),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/")

      test.expect(yield* entity.text).toBe("<div>Hello World</div>")
    }).pipe(Effect.runPromise),
  )

  test.it("renders JSX from handler function", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(Route.html((context) => Effect.succeed(<div>Request received</div>))),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/")

      test.expect(yield* entity.text).toBe("<div>Request received</div>")
    }).pipe(Effect.runPromise),
  )

  test.it("renders JSX with dynamic content", () =>
    Effect.gen(function* () {
      const items = ["Apple", "Banana", "Cherry"]

      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.html(
            <ul>
              {items.map((item) => (
                <li>{item}</li>
              ))}
            </ul>,
          ),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/")

      test.expect(yield* entity.text).toBe("<ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>")
    }).pipe(Effect.runPromise),
  )

  test.it("handles Entity with JSX body", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(Route.html(Entity.make(<div>With Entity</div>, { status: 201 }))),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/")

      test.expect(entity.status).toBe(201)
      test.expect(yield* entity.text).toBe("<div>With Entity</div>")
    }).pipe(Effect.runPromise),
  )

  test.it("renders data-* attributes with object values as JSON", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.html(
            <div
              data-signals={{
                draft: "",
                pendingDraft: "",
                username: "User123",
              }}
            >
              Content
            </div>,
          ),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/")

      test
        .expect(yield* entity.text)
        .toBe(
          `<div data-signals='{"draft":"","pendingDraft":"","username":"User123"}'>Content</div>`,
        )
    }).pipe(Effect.runPromise),
  )

  test.it("data-on-click function argument is typed as DataEvent", () => {
    const node = (
      <button
        data-on:click={(e) => {
          test.expectTypeOf(e).toMatchTypeOf<Engine.DataEvent>()
          test.expectTypeOf(e.window).toMatchTypeOf<Window & typeof globalThis>()
        }}
      />
    )

    test.expect(node).toBeDefined()
  })

  test.it("renders script with function child as IIFE", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          Route.html(
            <script>
              {(e) => {
                console.log("Hello from", e.window.document.title)
              }}
            </script>,
          ),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/")
      const text = yield* entity.text

      test.expect(text).toContain("<script>(")
      test.expect(text).toContain("e.window.document.title")
    }).pipe(Effect.runPromise),
  )

  test.it("renders plain strings", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(Route.get(Route.html("<h1>Hello</h1>")))
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/")

      test.expect(entity.status).toBe(200)
      test.expect(entity.headers["content-type"]).toBe("text/html; charset=utf-8")
      test.expect(yield* entity.text).toBe("<h1>Hello</h1>")
    }).pipe(Effect.runPromise),
  )
})

test.describe(Route.redirect, () => {
  test.it("composes with Route.get", () =>
    Effect.gen(function* () {
      const routes = Route.get(Route.redirect("/dashboard"))
      const handler = RouteHttp.toWebHandler(routes)
      const client = Fetch.fromHandler(handler)

      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(302)
      test.expect(entity.headers["location"]).toBe("/dashboard")
    }).pipe(Effect.runPromise),
  )

  test.it("supports custom status", () =>
    Effect.gen(function* () {
      const routes = Route.get(Route.redirect("/new-url", { status: 301 }))
      const handler = RouteHttp.toWebHandler(routes)
      const client = Fetch.fromHandler(handler)

      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(301)
      test.expect(entity.headers["location"]).toBe("/new-url")
    }).pipe(Effect.runPromise),
  )

  test.it("accepts URL object", () =>
    Effect.gen(function* () {
      const routes = Route.get(Route.redirect(new URL("https://example.com/path")))
      const handler = RouteHttp.toWebHandler(routes)
      const client = Fetch.fromHandler(handler)

      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.headers["location"]).toBe("https://example.com/path")
    }).pipe(Effect.runPromise),
  )

  test.it("works as return value from render handler", () =>
    Effect.gen(function* () {
      const routes = Route.post(
        Route.render(function* () {
          return Route.redirect("/posts/123")
        }),
      )
      const handler = RouteHttp.toWebHandler(routes)
      const client = Fetch.fromHandler(handler)

      const entity = yield* client.post("http://localhost/test")

      test.expect(entity.status).toBe(302)
      test.expect(entity.headers["location"]).toBe("/posts/123")
    }).pipe(Effect.runPromise),
  )

  test.it("composes under a wildcard format layout", () =>
    Effect.gen(function* () {
      const routes = Route.use(Route.html(<div />)).get(Route.redirect("/time"))
      const handler = RouteHttp.toWebHandler(routes)
      const client = Fetch.fromHandler(handler)

      const entity = yield* client.get("http://localhost/")

      test.expect(entity.status).toBe(302)
      test.expect(entity.headers["location"]).toBe("/time")
    }).pipe(Effect.runPromise),
  )
})

test.describe(Route.lazy, () => {
  test.it("loads module lazily and caches result", () =>
    Effect.gen(function* () {
      let loadCount = 0

      const lazyRoutes = Route.lazy(() => {
        loadCount++
        return Promise.resolve({
          default: Route.get(Route.text("lazy loaded")),
        })
      })

      test.expect(loadCount).toBe(0)

      const routes1 = yield* lazyRoutes

      test.expect(loadCount).toBe(1)
      test.expect(Route.items(routes1)).toHaveLength(1)

      const routes2 = yield* lazyRoutes

      test.expect(loadCount).toBe(1)
      test.expect(routes1).toBe(routes2)
    }).pipe(Effect.runPromise),
  )

  test.it("works with RouteHttp.toWebHandler", () =>
    Effect.gen(function* () {
      const lazyRoutes = Route.lazy(() =>
        Promise.resolve({
          default: Route.get(Route.text("lazy loaded")),
        }),
      )

      const routes = yield* lazyRoutes
      const handler = RouteHttp.toWebHandler(routes)

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("lazy loaded")
    }).pipe(Effect.runPromise),
  )

  test.it("preserves route types", () =>
    Effect.gen(function* () {
      const lazyRoutes = Route.lazy(() =>
        Promise.resolve({
          default: Route.use(Route.filter({ context: { injected: true } })).get(
            Route.json(function* (ctx) {
              return { value: ctx.injected }
            }),
          ),
        }),
      )

      const routes = yield* lazyRoutes
      const handler = RouteHttp.toWebHandler(routes)

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(yield* entity.json).toEqual({ value: true })
    }).pipe(Effect.runPromise),
  )
})

test.describe(Route.devOnly, () => {
  test.it("marks development route descriptors with dev=true", () => {
    const routes = Route.get(Route.devOnly, Route.text("public"))
    const routeItems = Route.items(routes)
    const descriptors = Route.descriptor(routeItems)

    test.expect(descriptors[0]).toMatchObject({
      method: "GET",
      dev: true,
    })
  })

  test.it("provides dev context to subsequent routes", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<Development.Development>()
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.get(
          Route.devOnly,
          Route.filter(function* (ctx) {
            return { context: { fromFilter: ctx.dev } }
          }),
          Route.text(function* (ctx) {
            test.expectTypeOf(ctx).toMatchObjectType<{
              dev: true
              fromFilter: true
            }>()

            return `${ctx.dev}:${ctx.fromFilter}`
          }),
        ),
      )

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("true:true")
    }).pipe(Effect.provide(Development.layerTest), Effect.runPromise),
  )

  test.it("development handler halts outside dev", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(Route.devOnly, Route.text("public")),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(404)
    }).pipe(Effect.runPromise),
  )

  test.it("development handler falls through in dev with dev context", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<Development.Development>()
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.get(
          Route.devOnly,
          Route.text(function* (ctx) {
            return `dev=${ctx.dev}`
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("dev=true")
    }).pipe(Effect.provide(Development.layerTest), Effect.runPromise),
  )
})

test.describe("Route generator handler must not allow returning an Effect", () => {
  test.it("returning an Effect from html generator is a type error", () => {
    Route.get(
      Route.html(function* () {
        return Effect.succeed(<div>oops</div>)
      }),
    )
  })

  test.it("returning an Effect from text generator is a type error", () => {
    Route.get(
      Route.text(function* () {
        return Effect.succeed("oops")
      }),
    )
  })

  test.it("yielding then returning the value is ok", () => {
    Route.get(
      Route.html(function* () {
        const name = yield* Effect.succeed("World")
        return <div>Hello {name}</div>
      }),
    )
  })
})

test.describe("Route.use is not available after method-specific builders", () => {
  test.it("use() after get() is a type error", () => {
    const result = Route.get(Route.html("hello"))
    // @ts-expect-error - use() should not be available after get()
    result.use
  })

  test.it("use() after post() is a type error", () => {
    const result = Route.post(Route.render("hello"))
    // @ts-expect-error - use() should not be available after post()
    result.use
  })

  test.it("use() after get().post() is a type error", () => {
    const result = Route.get(Route.html("hello")).post(Route.render("ok"))
    // @ts-expect-error - use() should not be available after post()
    result.use
  })

  test.it("use() after use() is allowed", () => {
    const result = Route.use(Route.render((_ctx, next) => next()))
    test.expect(result.use).toBeDefined()
  })

  test.it("get() after use() is allowed", () => {
    const result = Route.use(Route.render((_ctx, next) => next())).get(
      Route.html("hello"),
    )
    test.expect(result).toBeDefined()
  })
})

test.describe("Route.link", () => {
  test.it("static path", () => {
    test.expect(Route.link("/hello")).toBe("/hello")
  })

  test.it("single param", () => {
    test.expect(Route.link("/users/:id", { id: 23 })).toBe("/users/23")
  })

  test.it("multiple params", () => {
    test.expect(Route.link("/users/:userId/posts/:postId", { userId: "abc", postId: 42 })).toBe(
      "/users/abc/posts/42",
    )
  })

  test.it("optional param provided", () => {
    test.expect(Route.link("/users/:id?", { id: 5 })).toBe("/users/5")
  })

  test.it("optional param omitted", () => {
    test.expect(Route.link("/users/:id?")).toBe("/users")
  })

  test.it("encodes param values", () => {
    test.expect(Route.link("/search/:query", { query: "hello world" })).toBe(
      "/search/hello%20world",
    )
  })

  test.it("no params arg needed for static path", () => {
    const result: string = Route.link("/about")
    test.expect(result).toBe("/about")
  })

  test.it("root path", () => {
    test.expect(Route.link("/")).toBe("/")
  })

  test.it("type: requires params for required param", () => {
    // @ts-expect-error - missing required params
    Route.link("/users/:id")
  })

  test.it("type: does not require params for static path", () => {
    Route.link("/about")
  })

  test.it("type: allows omitting params for all-optional", () => {
    Route.link("/users/:id?")
  })

  test.it("extra params become search params", () => {
    const routes = Route.get(
      Route.schemaPathParams(Schema.Struct({ id: Schema.String })),
      Route.schemaSearchParams(Schema.Struct({ tab: Schema.String, page: Schema.String })),
      Route.html(""),
    )

    type R = { "/users/:id": [() => Promise<{ default: typeof routes }>] }

    test.expect(Route.link<R>("/users/:id", { id: "5", tab: "posts", page: "2" })).toBe(
      "/users/5?tab=posts&page=2",
    )
  })

  test.it("search params are encoded", () => {
    const routes = Route.get(
      Route.schemaSearchParams(Schema.Struct({ q: Schema.String })),
      Route.html(""),
    )

    type R = { "/search": [() => Promise<{ default: typeof routes }>] }

    test.expect(Route.link<R>("/search", { q: "hello world" })).toBe("/search?q=hello+world")
  })

  test.it("null/undefined search params are omitted", () => {
    const routes = Route.get(
      Route.schemaPathParams(Schema.Struct({ id: Schema.String })),
      Route.schemaSearchParams(Schema.Struct({ tab: Schema.String })),
      Route.html(""),
    )

    type R = { "/users/:id": [() => Promise<{ default: typeof routes }>] }

    test.expect(Route.link<R>("/users/:id", { id: "1", tab: undefined })).toBe("/users/1")
  })

  test.it("type: search params are optional", () => {
    const routes = Route.get(
      Route.schemaSearchParams(Schema.Struct({ tab: Schema.String })),
      Route.html(""),
    )

    type R = { "/foo": [() => Promise<{ default: typeof routes }>] }

    Route.link<R>("/foo")
    Route.link<R>("/foo", { tab: "bar" })
  })

  test.it("type: path params preserve schema types", () => {
    const routes = Route.get(
      Route.schemaPathParams(Schema.Struct({ owner: Schema.String, repo: Schema.String })),
      Route.html(""),
    )

    type R = { "/:owner/:repo": [() => Promise<{ default: typeof routes }>] }

    Route.link<R>("/:owner/:repo", { owner: "a", repo: "b" })

    // @ts-expect-error - owner should be string, not number
    Route.link<R>("/:owner/:repo", { owner: 123, repo: "b" })
  })

  test.it("type: search params preserve schema types", () => {
    const routes = Route.get(
      Route.schemaPathParams(Schema.Struct({ owner: Schema.String, repo: Schema.String })),
      Route.schemaSearchParams(Schema.Struct({ state: Schema.String })),
      Route.html(""),
    )

    type R = { "/:owner/:repo/issues": [() => Promise<{ default: typeof routes }>] }

    Route.link<R>("/:owner/:repo/issues", { owner: "a", repo: "b", state: "open" })

    // @ts-expect-error - state should be string, not number
    Route.link<R>("/:owner/:repo/issues", { owner: "a", repo: "b", state: 123 })
  })

  test.it("type: optional search params from schema", () => {
    const routes = Route.get(
      Route.schemaSearchParams(Schema.Struct({ tab: Schema.optional(Schema.String) })),
      Route.html(""),
    )

    type R = { "/foo": [() => Promise<{ default: typeof routes }>] }

    Route.link<R>("/foo")
    Route.link<R>("/foo", { tab: "bar" })
    Route.link<R>("/foo", { tab: undefined })

    // @ts-expect-error - tab should be string, not number
    Route.link<R>("/foo", { tab: 123 })
  })
})
