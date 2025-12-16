import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
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

  t.expect(Object.keys(router.mounts)).toHaveLength(1)
  t.expect(router.mounts["/hello"]).toBeDefined()
  t.expect(router.mounts["/hello"].set).toHaveLength(1)

  const _check: Types.Equals<
    typeof router,
    Router.Router<never, never>
  > = true
})

t.it("chains multiple routes", () => {
  const router = Router
    .mount("/hello", Route.text("Hello"))
    .mount("/world", Route.text("World"))

  t.expect(Object.keys(router.mounts)).toHaveLength(2)
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

  t.expect(Object.keys(routerMultiple.mounts)).toHaveLength(2)

  const _checkMultiple: Types.Equals<
    typeof routerMultiple,
    Router.Router<AdamError | EveError, never>
  > = true
})

t.it("infers context & error types from HttpMiddleware", () => {
  const httpMiddleware = Route.http((app) =>
    Effect.gen(function*() {
      yield* Effect.fail(new AdamError())
      yield* Random.uuid()
      return yield* app
    })
  )

  const routerSingle = Router
    .use(httpMiddleware)
    .mount(
      "/",
      Route.text(function*() {
        yield* Effect.fail(new EveError())
        return "hello"
      }),
    )

  t.expect(Object.keys(routerSingle.mounts)).toHaveLength(1)

  type RouterError = Router.Router.Error<typeof routerSingle>
  type RouterRequirements = Router.Router.Requirements<typeof routerSingle>

  const _errorCheck: AdamError extends RouterError ? true : false = true
  const _errorCheck2: EveError extends RouterError ? true : false = true
  const _requirementsCheck: Random extends RouterRequirements ? true
    : false = true
})

t.it("Router.use with Route.http(HttpServerResponse) infers never types", () => {
  const httpMiddleware = Route.http(HttpServerResponse.text("static"))

  const router = Router
    .use(httpMiddleware)
    .mount("/", Route.text("hello"))

  t.expect(Object.keys(router.mounts)).toHaveLength(1)

  const _check: Types.Equals<
    typeof router,
    Router.Router<never, never>
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

  t.expect(Object.keys(routerMultiple.mounts)).toHaveLength(2)

  const _checkMultiple: Types.Equals<
    typeof routerMultiple,
    Router.Router<never, Greeting | Random>
  > = true
})

t.it("merges routes at same path", () => {
  const router = Router
    .mount("/api", Route.get(Route.json({ method: "get" })))
    .mount("/api", Route.post(Route.json({ method: "post" })))

  t.expect(Object.keys(router.mounts)).toHaveLength(1)
  t.expect(router.mounts["/api"]).toBeDefined()
})

t.it(
  "mounts routes with route-level middleware via RouteSet composition",
  async () => {
    const wrapperLayer = Route.html(function*(c) {
      const inner = yield* c.next()
      return `<wrap>${inner}</wrap>`
    })

    const router = Router
      .mount("/page", wrapperLayer.html(Effect.succeed("content")))
      .mount("/uuid", Route.text(Random.uuid()))

    const mountedRoute = router.mounts["/page"]
    t.expect(mountedRoute).toBeDefined()
    t.expect(mountedRoute.set).toHaveLength(1)

    const route = mountedRoute.set[0]
    const mockContext: Route.RouteContext = {
      url: new URL("http://localhost/page"),
      slots: {},
      next: () => Effect.void,
    }

    const result = await Effect.runPromise(
      route.handler(mockContext) as Effect.Effect<unknown>,
    )

    t.expect(result).toBe("<wrap>content</wrap>")
  },
)

t.it("HttpMiddleware applies to routes mounted after use()", async () => {
  const httpMiddleware = Route.http((app) => app)

  const router = Router
    .mount("/before", Route.html(Effect.succeed("before-content")))
    .use(httpMiddleware)
    .mount("/after", Route.html(Effect.succeed("after-content")))

  t.expect(Object.keys(router.mounts)).toHaveLength(2)
  t.expect(router.mounts["/before"]).toBeDefined()
  t.expect(router.mounts["/after"]).toBeDefined()
})

t.it(
  "multiple route-level layers are applied in order via RouteSet composition",
  async () => {
    const outerLayer = Route.html(function*(c) {
      const inner = yield* c.next()
      return `<outer>${inner}</outer>`
    })

    const router = Router
      .mount(
        "/page",
        outerLayer
          .html(function*(c) {
            const inner = yield* c.next()
            return `<inner>${inner}</inner>`
          })
          .html(Effect.succeed("content")),
      )

    const mountedRoute = router.mounts["/page"]
    const route = mountedRoute.set[0]

    const mockContext: Route.RouteContext = {
      url: new URL("http://localhost/page"),
      slots: {},
      next: () => Effect.succeed("unused"),
    }

    const result = await Effect.runPromise(
      route.handler(mockContext) as Effect.Effect<unknown>,
    )

    t.expect(result).toBe("<outer><inner>content</inner></outer>")
  },
)

t.it(
  "route-level layer only applies to matching media via RouteSet composition",
  async () => {
    const htmlLayer = Route.html(function*(c) {
      const inner = yield* c.next()
      return `<wrap>${inner}</wrap>`
    })

    const router = Router
      .mount("/api", Route.json({ data: "value" }))
      .mount("/page", htmlLayer.html(Effect.succeed("content")))

    const mockContext = (path: string): Route.RouteContext => ({
      url: new URL(`http://localhost${path}`),
      slots: {},
      next: () => Effect.succeed("unused"),
    })

    const jsonRoute = router.mounts["/api"].set[0]
    const jsonResult = await Effect.runPromise(
      jsonRoute.handler(
        mockContext("/api"),
      ) as Effect.Effect<unknown>,
    )
    t.expect(jsonResult).toEqual({ data: "value" })

    const htmlRoute = router.mounts["/page"].set[0]
    const htmlResult = await Effect.runPromise(
      htmlRoute.handler(mockContext("/page")) as Effect.Effect<
        unknown
      >,
    )
    t.expect(htmlResult).toBe("<wrap>content</wrap>")
  },
)

t.describe("Router.get", () => {
  t.it("returns route matching method and path", () => {
    const router = Router
      .mount("/hello", Route.text("Hello"))
      .mount("/world", Route.json({ message: "World" }))

    const route = Router.get(router, "GET", "/hello")

    t.expect(route).toBeDefined()
    t.expect(route?.method).toBe("GET")
    t.expect(route?.media).toBe("text/plain")
  })

  t.it("returns undefined for non-existent path", () => {
    const router = Router.mount("/hello", Route.text("Hello"))

    const route = Router.get(router, "GET", "/notfound")

    t.expect(route).toBeUndefined()
  })

  t.it("returns undefined for non-matching method", () => {
    const router = Router.mount("/hello", Route.get(Route.text("Hello")))

    const route = Router.get(router, "POST", "/hello")

    t.expect(route).toBeUndefined()
  })

  t.it("matches with media filter", () => {
    const router = Router.mount(
      "/content",
      Route.merge(
        Route.text("plain"),
        Route.html("<div>html</div>"),
      ),
    )

    const textRoute = Router.get(router, "GET", "/content", "text/plain")
    const htmlRoute = Router.get(router, "GET", "/content", "text/html")

    t.expect(textRoute?.media).toBe("text/plain")
    t.expect(htmlRoute?.media).toBe("text/html")
  })

  t.it("wildcard method matches any route", () => {
    const router = Router.mount("/api", Route.post(Route.json({ ok: true })))

    const route = Router.get(router, "*", "/api")

    t.expect(route).toBeDefined()
    t.expect(route?.method).toBe("POST")
  })

  t.it("wildcard media matches any route", () => {
    const router = Router.mount("/page", Route.html("<div>page</div>"))

    const route = Router.get(router, "GET", "/page", "*/*")

    t.expect(route).toBeDefined()
    t.expect(route?.media).toBe("text/html")
  })

  t.it(
    "wildcard media uses content negotiation priority (json > text > html)",
    () => {
      const routes = Route.merge(
        Route.merge(Route.html("<div>html</div>"), Route.text("plain")),
        Route.json({ data: "json" }),
      )
      const router = Router.mount("/content", routes)

      // With wildcard, should return json (highest priority)
      const route = Router.get(router, "GET", "/content", "*/*")

      t.expect(route).toBeDefined()
      t.expect(route?.media).toBe("application/json")
    },
  )

  t.it("wildcard media returns text when json not available", () => {
    const routes = Route.merge(
      Route.html("<div>html</div>"),
      Route.text("plain"),
    )
    const router = Router.mount("/content", routes)

    const route = Router.get(router, "GET", "/content", "*/*")

    t.expect(route).toBeDefined()
    t.expect(route?.media).toBe("text/plain")
  })
})
