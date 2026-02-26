import * as test from "bun:test"
import * as Development from "effect-start/Development"
import * as Effect from "effect/Effect"
import type * as Entity from "effect-start/Entity"
import * as EntityRuntime from "effect-start/Entity"
import * as Fetch from "effect-start/Fetch"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"

test.describe(Route.redirect, () => {
  test.it("creates redirect with default 302 status", () => {
    const entity = Route.redirect("/login")

    test.expect(entity.status).toBe(302)
    test.expect(entity.headers.location).toBe("/login")
    test.expect(entity.body).toBe("")
  })

  test.it("creates redirect with custom status", () => {
    const entity = Route.redirect("/new-url", { status: 301 })

    test.expect(entity.status).toBe(301)
    test.expect(entity.headers.location).toBe("/new-url")
  })

  test.it("accepts URL object", () => {
    const entity = Route.redirect(new URL("https://example.com/path"))

    test.expect(entity.headers.location).toBe("https://example.com/path")
  })

  test.it("returns Entity<string>", () => {
    const entity = Route.redirect("/login")

    test.expectTypeOf(entity).toEqualTypeOf<Entity.Entity<"">>()
  })
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
