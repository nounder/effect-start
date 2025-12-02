import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Route from "./Route.ts"
import * as Router from "./Router.ts"

t.describe("Router", () => {
  t.describe("mount", () => {
    t.test("creates router with single route", () => {
      const router = Router.mount("/hello", Route.text("Hello World"))

      t.expect(router.entries).toHaveLength(1)
      t.expect(router.entries[0].path).toBe("/hello")
      t.expect(router.entries[0].route.set).toHaveLength(1)
    })

    t.test("chains multiple routes", () => {
      const router = Router
        .mount("/hello", Route.text("Hello"))
        .mount("/world", Route.text("World"))

      t.expect(router.entries).toHaveLength(2)
      t.expect(router.entries[0].path).toBe("/hello")
      t.expect(router.entries[1].path).toBe("/world")
    })

    t.test("merges routes at same path", () => {
      const router = Router
        .mount("/api", Route.get(Route.json({ method: "get" })))
        .mount("/api", Route.post(Route.json({ method: "post" })))

      t.expect(router.entries).toHaveLength(1)
      t.expect(router.entries[0].path).toBe("/api")
    })
  })

  t.describe("mounts", () => {
    t.test("exposes mounted routes as Record", () => {
      const router = Router
        .mount("/hello", Route.text("Hello"))
        .mount("/world", Route.text("World"))

      t.expect(router.mounts["/hello"]).toBeDefined()
      t.expect(router.mounts["/world"]).toBeDefined()
      t.expect(router.mounts["/hello"].set).toHaveLength(1)
    })

    t.test("mounts contain routes with layers applied", async () => {
      const layer = Route.layer(
        Route.html(function*(c) {
          const inner = yield* c.next()
          return `<wrap>${inner}</wrap>`
        }),
      )

      const router = Router
        .use(layer)
        .mount("/page", Route.html(Effect.succeed("content")))

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
  })

  t.describe("use", () => {
    t.test("adds global layer", () => {
      const layer = Route.layer(
        Route.html(function*(c) {
          const inner = yield* c.next()
          return `<html><body>${inner}</body></html>`
        }),
      )

      const router = Router.use(layer)

      t.expect(router.globalLayers).toHaveLength(1)
      t.expect(router.entries).toHaveLength(0)
    })

    t.test("applies layer to subsequently mounted routes", () => {
      const layer = Route.layer(
        Route.html(function*(c) {
          const inner = yield* c.next()
          return `<html><body>${inner}</body></html>`
        }),
      )

      const router = Router
        .use(layer)
        .mount("/", Route.text("Hello world!"))

      t.expect(router.globalLayers).toHaveLength(1)
      t.expect(router.entries).toHaveLength(1)
      t.expect(router.entries[0].layers).toHaveLength(1)
    })

    t.test("layer added after mount applies to existing routes", async () => {
      const layer = Route.layer(
        Route.html(function*(c) {
          const inner = yield* c.next()
          return `<wrap>${inner}</wrap>`
        }),
      )

      const router = Router
        .mount("/before", Route.html(Effect.succeed("before-content")))
        .use(layer)
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

      t.expect(beforeResult).toBe("<wrap>before-content</wrap>")
      t.expect(afterResult).toBe("<wrap>after-content</wrap>")
    })
  })

  t.describe("layer application - runtime behavior", () => {
    t.test("layer handler wraps route handler", async () => {
      const layer = Route.layer(
        Route.html(function*(c) {
          const inner = yield* c.next()
          return `<wrap>${inner}</wrap>`
        }),
      )

      const router = Router
        .use(layer)
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

      t.expect(result).toBe("<wrap>content</wrap>")
    })

    t.test("multiple layers are applied in order", async () => {
      const outerLayer = Route.layer(
        Route.html(function*(c) {
          const inner = yield* c.next()
          return `<outer>${inner}</outer>`
        }),
      )

      const innerLayer = Route.layer(
        Route.html(function*(c) {
          const inner = yield* c.next()
          return `<inner>${inner}</inner>`
        }),
      )

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

    t.test("layer only applies to matching media type", async () => {
      const htmlLayer = Route.layer(
        Route.html(function*(c) {
          const inner = yield* c.next()
          return `<wrap>${inner}</wrap>`
        }),
      )

      const router = Router
        .use(htmlLayer)
        .mount("/api", Route.json({ data: "value" }))

      const mountedRoute = router.mounts["/api"]
      const route = mountedRoute.set[0]

      const mockContext: Route.RouteContext = {
        request: {} as any,
        url: new URL("http://localhost/api"),
        slots: {},
        next: () => Effect.succeed("unused"),
      }

      const result = await Effect.runPromise(
        route.handler(mockContext) as Effect.Effect<unknown>,
      )

      t.expect(result).toEqual({ data: "value" })
    })

    t.test("route without layer is not wrapped", async () => {
      const router = Router.mount("/hello", Route.text("Hello"))

      const mountedRoute = router.mounts["/hello"]
      const route = mountedRoute.set[0]

      const mockContext: Route.RouteContext = {
        request: {} as any,
        url: new URL("http://localhost/hello"),
        slots: {},
        next: () => Effect.succeed("unused"),
      }

      const result = await Effect.runPromise(
        route.handler(mockContext) as Effect.Effect<unknown>,
      )

      t.expect(result).toBe("Hello")
    })
  })

  t.describe("type inference", () => {
    t.test("infers never for routes without requirements", () => {
      const router = Router.mount("/hello", Route.text("Hello"))

      type RouterError = Router.RouterBuilder.Error<typeof router>
      type RouterContext = Router.RouterBuilder.Context<typeof router>

      const _checkError: RouterError = undefined as never
      const _checkContext: RouterContext = undefined as never

      t.expect(true).toBe(true)
    })

    t.test("infers error type from route handler", () => {
      class MyError {
        readonly _tag = "MyError"
      }

      const router = Router.mount(
        "/fail",
        Route.text(Effect.fail(new MyError())),
      )

      type RouterError = Router.RouterBuilder.Error<typeof router>

      const _checkError: MyError extends RouterError ? true : false = true

      t.expect(true).toBe(true)
    })

    t.test("infers context type from route handler", () => {
      class MyService extends Effect.Tag("MyService")<
        MyService,
        { getValue(): string }
      >() {}

      const router = Router.mount(
        "/service",
        Route.text(
          Effect.gen(function*() {
            const svc = yield* MyService
            return svc.getValue()
          }),
        ),
      )

      type RouterContext = Router.RouterBuilder.Context<typeof router>

      const _checkContext: MyService extends RouterContext ? true : false = true

      t.expect(true).toBe(true)
    })

    t.test("unions error types from multiple routes", () => {
      class ErrorA {
        readonly _tag = "ErrorA"
      }
      class ErrorB {
        readonly _tag = "ErrorB"
      }

      const router = Router
        .mount("/a", Route.text(Effect.fail(new ErrorA())))
        .mount("/b", Route.text(Effect.fail(new ErrorB())))

      type RouterError = Router.RouterBuilder.Error<typeof router>

      const _checkA: ErrorA extends RouterError ? true : false = true
      const _checkB: ErrorB extends RouterError ? true : false = true

      t.expect(true).toBe(true)
    })

    t.test("unions context types from multiple routes", () => {
      class ServiceA extends Effect.Tag("ServiceA")<
        ServiceA,
        { getA(): string }
      >() {}
      class ServiceB extends Effect.Tag("ServiceB")<
        ServiceB,
        { getB(): string }
      >() {}

      const router = Router
        .mount(
          "/a",
          Route.text(
            Effect.gen(function*() {
              const svc = yield* ServiceA
              return svc.getA()
            }),
          ),
        )
        .mount(
          "/b",
          Route.text(
            Effect.gen(function*() {
              const svc = yield* ServiceB
              return svc.getB()
            }),
          ),
        )

      type RouterContext = Router.RouterBuilder.Context<typeof router>

      const _checkA: ServiceA extends RouterContext ? true : false = true
      const _checkB: ServiceB extends RouterContext ? true : false = true

      t.expect(true).toBe(true)
    })
  })

  t.describe("fromManifest", () => {
    t.test("loads routes from manifest", async () => {
      const manifest: Router.RouterManifest = {
        routes: [
          {
            path: "/test",
            load: () => Promise.resolve({ default: Route.text("Test") }),
          },
        ],
      }

      const router = await Effect.runPromise(Router.fromManifest(manifest))

      t.expect(router.entries).toHaveLength(1)
      t.expect(router.entries[0].path).toBe("/test")
    })

    t.test("loads layers from manifest", async () => {
      const layer = Route.layer(
        Route.html(function*(c) {
          const inner = yield* c.next()
          return `<wrap>${inner}</wrap>`
        }),
      )

      const manifest: Router.RouterManifest = {
        routes: [
          {
            path: "/test",
            load: () => Promise.resolve({ default: Route.text("Test") }),
            layers: [() => Promise.resolve({ default: layer })],
          },
        ],
      }

      const router = await Effect.runPromise(Router.fromManifest(manifest))

      t.expect(router.entries).toHaveLength(1)
      t.expect(router.entries[0].layers).toHaveLength(1)
    })
  })
})
