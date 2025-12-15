import * as t from "bun:test"
import * as Effect from "effect/Effect"
import type * as Types from "effect/Types"
import * as Route from "./Route.ts"
import * as Router from "./Router.ts"

class Greeting extends Effect.Tag("Greeting")<Greeting, {
  greet(): string
}>() {}

class Random extends Effect.Tag("Random")<Random, {
  number(): number
  uuid(): string
}>() {}

class AdamError {
  readonly _tag = "AdamError"
}

class EveError {
  readonly _tag = "EveError"
}

t.it("creates router with single route", () => {
  const router = Router.mount(
    "/hello",
    Route.text("Hello World"),
  )

  t.expect(router.entries).toHaveLength(1)
  t.expect(router.entries[0].path).toBe("/hello")
  t.expect(router.entries[0].route.set).toHaveLength(1)

  t.expect(router.mounts["/hello"]).toBeDefined()

  const _check: Types.Equals<
    typeof router,
    Router.Router<never, never>
  > = true
})

t.it("chains multiple routes", () => {
  const router = Router
    .mount("/hello", Route.text("Hello"))
    .mount("/world", Route.text("World"))

  t.expect(router.entries).toHaveLength(2)
  t.expect(router.entries[0].path).toBe("/hello")
  t.expect(router.entries[1].path).toBe("/world")

  t.expect(router.mounts["/hello"]).toBeDefined()
  t.expect(router.mounts["/world"]).toBeDefined()

  const _check: Types.Equals<
    typeof router,
    Router.Router<never, never>
  > = true
})

t.it("infers and unions error types from routes", () => {
  const routerSingle = Router.mount(
    "/fail",
    Route.text(Effect.fail(new AdamError())),
  )

  const _checkSingle: Types.Equals<
    typeof routerSingle,
    Router.Router<AdamError, never>
  > = true

  const routerMultiple = Router
    .mount("/adam", Route.text(Effect.fail(new AdamError())))
    .mount("/eve", Route.text(Effect.fail(new EveError())))

  t.expect(routerMultiple.entries).toHaveLength(2)

  const _checkMultiple: Types.Equals<
    typeof routerMultiple,
    Router.Router<AdamError | EveError, never>
  > = true
})

t.it("infers context &  error types from layers", () => {
  const routerSingle = Router
    .use(Route.text(function*(c) {
      yield* Effect.fail(new AdamError())

      return yield* Random.uuid()
    }))
    .mount(
      "/",
      Route.text(function*() {
        yield* Effect.fail(new EveError())
        return "hello"
      }),
    )

  const _check: Types.Equals<
    typeof routerSingle,
    Router.Router<AdamError | EveError, Random>
  > = true
})

t.it("infers and unions context types from routes", () => {
  const routerSingle = Router
    .mount("/uuid", Route.text(Random.uuid()))

  const _checkSingle: Types.Equals<
    typeof routerSingle,
    Router.Router<never, Random>
  > = true

  const routerMultiple = Router
    .mount("/hello", Route.text(Greeting.greet()))
    .mount("/uuid", Route.text(Random.uuid()))

  t.expect(routerMultiple.entries).toHaveLength(2)

  const _checkMultiple: Types.Equals<
    typeof routerMultiple,
    Router.Router<never, Greeting | Random>
  > = true
})

t.it("merges routes at same path", () => {
  const router = Router
    .mount("/api", Route.get(Route.json({ method: "get" })))
    .mount("/api", Route.post(Route.json({ method: "post" })))

  t.expect(router.entries).toHaveLength(1)
  t.expect(router.entries[0].path).toBe("/api")

  t.expect(router.mounts["/api"]).toBeDefined()
})

t.it("mounts routes with middleware", async () => {
  const layerRoutes = Route.html(function*(c) {
    const inner = yield* c.next()
    return `<wrap>${inner}</wrap>`
  })

  const router = Router
    .use(layerRoutes)
    .mount("/page", Route.html(Effect.succeed("content")))
    .mount("/uuid", Route.text(Random.uuid()))

  const mountedRoute = router.mounts["/page"]
  t.expect(mountedRoute).toBeDefined()
  t.expect(mountedRoute.set).toHaveLength(1)

  const route = mountedRoute.set[0]
  const mockContext: Route.RouteContext = {
    request: {} as any,
    url: new URL("http://localhost/page"),
    slots: {},
    next: () => Effect.void,
  }

  const result = await Effect.runPromise(
    route.handler(mockContext) as Effect.Effect<unknown>,
  )

  t.expect(result).toBe("<wrap>content</wrap>")
})

t.it("middleware only applies to routes mounted after use()", async () => {
  const layerRoutes = Route.html(function*(c) {
    const inner = yield* c.next()
    return `<wrap>${inner}</wrap>`
  })

  const router = Router
    .mount("/before", Route.html(Effect.succeed("before-content")))
    .use(layerRoutes)
    .mount("/after", Route.html(Effect.succeed("after-content")))

  const mockContext = (path: string): Route.RouteContext => ({
    request: {} as any,
    url: new URL(`http://localhost${path}`),
    slots: {},
    next: () => Effect.void,
  })

  const beforeRoute = router.mounts["/before"].set[0]
  const afterRoute = router.mounts["/after"].set[0]

  const beforeResult = await Effect.runPromise(
    beforeRoute.handler(mockContext("/before")) as Effect.Effect<unknown>,
  )
  const afterResult = await Effect.runPromise(
    afterRoute.handler(mockContext("/after")) as Effect.Effect<unknown>,
  )

  t.expect(beforeResult).toBe("before-content")
  t.expect(afterResult).toBe("<wrap>after-content</wrap>")
})

t.it("multiple layers are applied in order", async () => {
  const outerLayer = Route.html(function*(c) {
    const inner = yield* c.next()
    return `<outer>${inner}</outer>`
  })

  const innerLayer = Route.html(function*(c) {
    const inner = yield* c.next()
    return `<inner>${inner}</inner>`
  })

  const router = Router
    .use(outerLayer)
    .use(innerLayer)
    .mount("/page", Route.html(Effect.succeed("content")))

  const mountedRoute = router.mounts["/page"]
  const route = mountedRoute.set[0]

  const mockContext: Route.RouteContext = {
    request: {} as any,
    url: new URL("http://localhost/page"),
    slots: {},
    next: () => Effect.succeed("unused"),
  }

  const result = await Effect.runPromise(
    route.handler(mockContext) as Effect.Effect<unknown>,
  )

  t.expect(result).toBe("<outer><inner>content</inner></outer>")
})

t.it("layer only applies to matching media", async () => {
  const htmlLayer = Route.html(function*(c) {
    const inner = yield* c.next()
    return `<wrap>${inner}</wrap>`
  })

  const router = Router
    .use(htmlLayer)
    .mount("/api", Route.json({ data: "value" }))
    .mount("/page", Route.html(Effect.succeed("content")))

  const mockContext = (path: string): Route.RouteContext => ({
    request: {} as any,
    url: new URL(`http://localhost${path}`),
    slots: {},
    next: () => Effect.succeed("unused"),
  })

  const jsonRoute = router.mounts["/api"].set[0]
  const jsonResult = await Effect.runPromise(
    jsonRoute.handler(mockContext("/api")) as Effect.Effect<unknown>,
  )
  t.expect(jsonResult).toEqual({ data: "value" })

  const htmlRoute = router.mounts["/page"].set[0]
  const htmlResult = await Effect.runPromise(
    htmlRoute.handler(mockContext("/page")) as Effect.Effect<unknown>,
  )
  t.expect(htmlResult).toBe("<wrap>content</wrap>")
})
