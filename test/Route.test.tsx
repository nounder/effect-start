/** @jsxImportSource effect-start */
import * as test from "bun:test"
import type * as Engine from "effect-start/datastar"
import * as Development from "effect-start/Development"
import * as Effect from "effect/Effect"
import * as Entity from "effect-start/Entity"
import * as Fetch from "effect-start/Fetch"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"

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
        .toBe(`<div data-signals='{"draft":"","pendingDraft":"","username":"User123"}'>Content</div>`)
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
              {(window) => {
                console.log("Hello from", window.document.title)
              }}
            </script>,
          ),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/")
      const text = yield* entity.text

      test.expect(text).toContain("<script>(")
      test.expect(text).toContain(")(window)</script>")
      test.expect(text).toContain("window.document.title")
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
      const routes = Route.get(Route.devOnly, Route.text("public"))
      const developmentRoute = Route.items(routes)[0]
      const context: Parameters<typeof developmentRoute.handler>[0] = {
        dev: true,
        method: "GET",
      }
      let nextCalled = false

      const entity = yield* developmentRoute.handler(context, () => {
        nextCalled = true
        return Entity.make("next")
      })

      test.expect(entity.status).toBe(404)
      test.expect(nextCalled).toBe(false)
    }).pipe(Effect.runPromise),
  )

  test.it("development handler falls through in dev with dev context", () =>
    Effect.gen(function* () {
      const routes = Route.get(Route.devOnly, Route.text("public"))
      const developmentRoute = Route.items(routes)[0]
      const context: Parameters<typeof developmentRoute.handler>[0] = {
        dev: true,
        method: "GET",
      }
      let nextCalled = false
      let receivedContext: Record<string, unknown> | undefined

      const entity = yield* developmentRoute.handler(context, (context) => {
        nextCalled = true
        receivedContext = context
        return Entity.make("next")
      })

      test.expect(entity.body).toBe("next")
      test.expect(nextCalled).toBe(true)
      test.expect(receivedContext).toMatchObject({
        method: "GET",
        dev: true,
      })
    }).pipe(Effect.provide(Development.layerTest), Effect.runPromise),
  )
})
