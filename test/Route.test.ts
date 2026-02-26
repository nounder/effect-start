import * as test from "bun:test"
import * as Development from "effect-start/Development"
import * as Effect from "effect/Effect"
import * as EntityRuntime from "effect-start/Entity"
import * as Fetch from "effect-start/Fetch"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"

test.describe(Route.redirect, () => {
  test.it("composes with Route.get", () =>
    Effect.gen(function* () {
      const routes = Route.get(Route.redirect("/dashboard"))
      const handler = RouteHttp.toWebHandler(routes)

      const response = yield* Effect.promise(() => Fetch.fromHandler(handler, { path: "/test" }))

      test.expect(response.status).toBe(302)
      test.expect(response.headers.get("location")).toBe("/dashboard")
    }).pipe(Effect.runPromise),
  )

  test.it("supports custom status", () =>
    Effect.gen(function* () {
      const routes = Route.get(Route.redirect("/new-url", { status: 301 }))
      const handler = RouteHttp.toWebHandler(routes)

      const response = yield* Effect.promise(() => Fetch.fromHandler(handler, { path: "/test" }))

      test.expect(response.status).toBe(301)
      test.expect(response.headers.get("location")).toBe("/new-url")
    }).pipe(Effect.runPromise),
  )

  test.it("accepts URL object", () =>
    Effect.gen(function* () {
      const routes = Route.get(Route.redirect(new URL("https://example.com/path")))
      const handler = RouteHttp.toWebHandler(routes)

      const response = yield* Effect.promise(() => Fetch.fromHandler(handler, { path: "/test" }))

      test.expect(response.headers.get("location")).toBe("https://example.com/path")
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

      const response = yield* Effect.promise(() =>
        Fetch.fromHandler(handler, { path: "/test", method: "POST" }),
      )

      test.expect(response.status).toBe(302)
      test.expect(response.headers.get("location")).toBe("/posts/123")
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

      const response = yield* Effect.promise(() => Fetch.fromHandler(handler, { path: "/test" }))

      test.expect(response.status).toBe(200)
      test.expect(yield* Effect.promise(() => response.text())).toBe("lazy loaded")
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

      const response = yield* Effect.promise(() => Fetch.fromHandler(handler, { path: "/test" }))

      test.expect(yield* Effect.promise(() => response.json())).toEqual({ value: true })
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

      const response = yield* Effect.promise(() => Fetch.fromHandler(handler, { path: "/test" }))

      test.expect(response.status).toBe(200)
      test.expect(yield* Effect.promise(() => response.text())).toBe("true:true")
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
        return EntityRuntime.make("next")
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
        return EntityRuntime.make("next")
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
