import * as test from "bun:test"
import * as Effect from "effect/Effect"
import type * as Entity from "./Entity.ts"
import * as Http from "./Http.ts"
import * as Route from "./Route.ts"
import * as RouteHttp from "./RouteHttp.ts"

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

      const response = yield* Effect.promise(() => Http.fetch(handler, { path: "/test" }))

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

      const response = yield* Effect.promise(() => Http.fetch(handler, { path: "/test" }))

      test.expect(yield* Effect.promise(() => response.json())).toEqual({ value: true })
    }).pipe(Effect.runPromise),
  )
})
