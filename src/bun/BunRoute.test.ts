import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import type { HTMLBundle } from "bun"
import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Route from "../Route.ts"
import * as Router from "../Router.ts"
import * as BunHttpServer from "./BunHttpServer.ts"
import * as BunRoute from "./BunRoute.ts"

t.describe(`${BunRoute.validateBunPattern.name}`, () => {
  t.test("allows exact paths", () => {
    const result = BunRoute.validateBunPattern("/users")
    t.expect(result._tag).toBe("None")
  })

  t.test("allows full-segment params", () => {
    const result = BunRoute.validateBunPattern("/users/[id]")
    t.expect(result._tag).toBe("None")
  })

  t.test("allows rest params", () => {
    const result = BunRoute.validateBunPattern("/docs/[...path]")
    t.expect(result._tag).toBe("None")
  })

  t.test("rejects prefixed params", () => {
    const result = BunRoute.validateBunPattern("/users/pk_[id]")
    t.expect(result._tag).toBe("Some")
    if (result._tag === "Some") {
      t.expect(result.value.reason).toBe("UnsupportedPattern")
      t.expect(result.value.pattern).toBe("/users/pk_[id]")
    }
  })

  t.test("rejects suffixed params", () => {
    const result = BunRoute.validateBunPattern("/users/[id]_details")
    t.expect(result._tag).toBe("Some")
    if (result._tag === "Some") {
      t.expect(result.value.reason).toBe("UnsupportedPattern")
    }
  })

  t.test("rejects dot suffix on params", () => {
    const result = BunRoute.validateBunPattern("/api/[id].json")
    t.expect(result._tag).toBe("Some")
    if (result._tag === "Some") {
      t.expect(result.value.reason).toBe("UnsupportedPattern")
    }
  })

  t.test("rejects tilde suffix on params", () => {
    const result = BunRoute.validateBunPattern("/api/[id]~test")
    t.expect(result._tag).toBe("Some")
    if (result._tag === "Some") {
      t.expect(result.value.reason).toBe("UnsupportedPattern")
    }
  })

  t.test("allows optional params (implemented via two patterns)", () => {
    const result = BunRoute.validateBunPattern("/users/[[id]]")
    t.expect(result._tag).toBe("None")
  })

  t.test("allows optional rest params (implemented via two patterns)", () => {
    const result = BunRoute.validateBunPattern("/docs/[[...path]]")
    t.expect(result._tag).toBe("None")
  })
})

t.describe(`${BunRoute.routesFromRouter.name}`, () => {
  t.test("fails with RouterError for unsupported patterns", async () => {
    const result = await Effect.runPromise(
      BunRoute
        .routesFromRouter(
          Router.mount("/users/pk_[id]", Route.text("user")),
        )
        .pipe(
          Effect.either,
          Effect.provide(BunHttpServer.layer({ port: 0 })),
        ),
    )

    t.expect(result._tag).toBe("Left")
    if (result._tag === "Left") {
      t.expect(result.left._tag).toBe("RouterError")
      t.expect(result.left.reason).toBe("UnsupportedPattern")
    }
  })

  t.it(
    "converts text route to fetch handler",
    () =>
      Effect.runPromise(
        Effect
          .gen(function*() {
            const bunServer = yield* BunHttpServer.BunServer
            return 23
          })
          .pipe(
            Effect.provide(
              Layer.mergeAll(
                BunHttpServer.layer({
                  port: 0,
                }),
              ),
            ),
          ),
      ),
  )

  t.test("converts text route to fetch handler", async () => {
    const fetch = await makeFetch(
      Router.mount("/hello", Route.text("Hello World")),
    )

    const response = await fetch("/hello")

    t.expect(response.status).toBe(200)
    t.expect(await response.text()).toBe("Hello World")
  })

  t.test("converts json route to fetch handler", async () => {
    const fetch = await makeFetch(
      Router.mount("/api/data", Route.json({ message: "ok", count: 42 })),
    )

    const response = await fetch("/api/data")

    t.expect(response.status).toBe(200)
    t.expect(await response.json()).toEqual({ message: "ok", count: 42 })
  })

  t.test("converts html route to fetch handler", async () => {
    const fetch = await makeFetch(
      Router.mount("/page", Route.html(Effect.succeed("<h1>Title</h1>"))),
    )

    const response = await fetch("/page")

    t.expect(response.status).toBe(200)
    t.expect(await response.text()).toBe("<h1>Title</h1>")
  })

  t.test("handles method-specific routes", async () => {
    const fetch = await makeFetch(
      Router.mount(
        "/users",
        Route.get(Route.json({ users: [] })).post(
          Route.json({ created: true }),
        ),
      ),
    )

    const getResponse = await fetch("/users")
    t.expect(await getResponse.json()).toEqual({ users: [] })

    const postResponse = await fetch("/users", { method: "POST" })
    t.expect(await postResponse.json()).toEqual({ created: true })
  })

  t.test("converts path syntax to Bun format", async () => {
    const routes = await makeBunRoutes(
      Router
        .mount("/users/[id]", Route.text("user"))
        .mount("/docs/[...path]", Route.text("docs")),
    )

    t.expect(routes["/users/:id"]).toBeDefined()
    t.expect(routes["/docs/*"]).toBeDefined()
    t.expect(routes["/users/[id]"]).toBeUndefined()
    t.expect(routes["/docs/[...path]"]).toBeUndefined()
  })

  t.test("creates proxy and internal routes for BunRoute", async () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const bunRoute = BunRoute.html(() => Promise.resolve(mockBundle))

    const routes = await makeBunRoutes(
      Router.mount("/app", bunRoute),
    )

    const internalPath = Object.keys(routes).find((k) =>
      k.includes(".BunRoute-")
    )

    t.expect(internalPath).toBeDefined()
    t.expect(routes[internalPath!]).toBe(mockBundle)
    t.expect(typeof routes["/app"]).toBe("function")
  })

  t.test("handles mixed BunRoute and regular routes", async () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const bunRoute = BunRoute.html(() => Promise.resolve(mockBundle))

    const routes = await makeBunRoutes(
      Router
        .mount("/app", bunRoute)
        .mount("/api/health", Route.json({ ok: true })),
    )

    const internalPath = Object.keys(routes).find((k) =>
      k.includes(".BunRoute-")
    )

    t.expect(internalPath).toBeDefined()
    t.expect(routes[internalPath!]).toBe(mockBundle)
    t.expect(typeof routes["/app"]).toBe("function")
    t.expect(routes["/api/health"]).toBeDefined()
    t.expect(typeof routes["/api/health"]).toBe("object")
  })

  t.test("groups multiple methods under same path", async () => {
    const fetch = await makeFetch(
      Router.mount(
        "/resource",
        Route
          .get(Route.text("get"))
          .post(Route.text("post"))
          .delete(Route.text("delete")),
      ),
    )

    const getRes = await fetch("/resource")
    const postRes = await fetch("/resource", { method: "POST" })
    const delRes = await fetch("/resource", { method: "DELETE" })

    t.expect(await getRes.text()).toBe("get")
    t.expect(await postRes.text()).toBe("post")
    t.expect(await delRes.text()).toBe("delete")
  })
})

t.describe("fetch handler Response", () => {
  t.test("returns Response instance", async () => {
    const fetch = await makeFetch(
      Router.mount("/test", Route.text("test")),
    )

    const response = await fetch("/test")

    t.expect(response).toBeInstanceOf(Response)
  })

  t.test("text response has correct content-type", async () => {
    const fetch = await makeFetch(
      Router.mount("/text", Route.text("hello")),
    )

    const response = await fetch("/text")

    t.expect(response.headers.get("content-type")).toContain("text/plain")
  })

  t.test("json response has correct content-type", async () => {
    const fetch = await makeFetch(
      Router.mount("/json", Route.json({ data: 1 })),
    )

    const response = await fetch("/json")

    t.expect(response.headers.get("content-type")).toContain("application/json")
  })

  t.test("html response has correct content-type", async () => {
    const fetch = await makeFetch(
      Router.mount("/html", Route.html(Effect.succeed("<p>hi</p>"))),
    )

    const response = await fetch("/html")

    t.expect(response.headers.get("content-type")).toContain("text/html")
  })

  t.test("response body is readable", async () => {
    const fetch = await makeFetch(
      Router.mount("/body", Route.text("readable body")),
    )

    const response = await fetch("/body")

    t.expect(response.bodyUsed).toBe(false)
    const text = await response.text()
    t.expect(text).toBe("readable body")
    t.expect(response.bodyUsed).toBe(true)
  })

  t.test("response ok is true for 200 status", async () => {
    const fetch = await makeFetch(
      Router.mount("/ok", Route.text("ok")),
    )

    const response = await fetch("/ok")

    t.expect(response.ok).toBe(true)
    t.expect(response.status).toBe(200)
  })
})

t.describe("Route.layer httpMiddleware", () => {
  t.test("applies middleware headers to child routes", async () => {
    const addHeader = HttpMiddleware.make((app) =>
      Effect.gen(function*() {
        const response = yield* app
        return HttpServerResponse.setHeader(response, "X-Layer-Applied", "true")
      })
    ) as Route.HttpMiddlewareFunction

    const router = Router
      .use(Route.layer(Route.http(addHeader)))
      .mount("/child", Route.text("child content"))

    const fetch = await makeFetch(router)
    const response = await fetch("/child")

    t.expect(response.headers.get("X-Layer-Applied")).toBe("true")
    t.expect(await response.text()).toBe("child content")
  })

  t.test("middleware only applies to children, not siblings", async () => {
    const addHeader = HttpMiddleware.make((app) =>
      Effect.gen(function*() {
        const response = yield* app
        return HttpServerResponse.setHeader(response, "X-Layer-Applied", "true")
      })
    ) as Route.HttpMiddlewareFunction

    const router = Router
      .mount("/outside", Route.text("outside content"))
      .use(Route.layer(Route.http(addHeader)))
      .mount("/inside", Route.text("inside content"))

    const fetch = await makeFetch(router)

    const insideResponse = await fetch("/inside")
    t.expect(insideResponse.headers.get("X-Layer-Applied")).toBe("true")

    const outsideResponse = await fetch("/outside")
    t.expect(outsideResponse.headers.get("X-Layer-Applied")).toBeNull()
  })

  t.test("multiple middleware are applied in order", async () => {
    const addHeader1 = HttpMiddleware.make((app) =>
      Effect.gen(function*() {
        const response = yield* app
        return HttpServerResponse.setHeader(response, "X-First", "1")
      })
    ) as Route.HttpMiddlewareFunction

    const addHeader2 = HttpMiddleware.make((app) =>
      Effect.gen(function*() {
        const response = yield* app
        return HttpServerResponse.setHeader(response, "X-Second", "2")
      })
    ) as Route.HttpMiddlewareFunction

    const router = Router
      .use(Route.layer(Route.http(addHeader1), Route.http(addHeader2)))
      .mount("/test", Route.text("test"))

    const fetch = await makeFetch(router)
    const response = await fetch("/test")

    t.expect(response.headers.get("X-First")).toBe("1")
    t.expect(response.headers.get("X-Second")).toBe("2")
  })

  t.test("nested layers apply all middleware", async () => {
    const outerHeader = HttpMiddleware.make((app) =>
      Effect.gen(function*() {
        const response = yield* app
        return HttpServerResponse.setHeader(response, "X-Outer", "outer")
      })
    ) as Route.HttpMiddlewareFunction

    const innerHeader = HttpMiddleware.make((app) =>
      Effect.gen(function*() {
        const response = yield* app
        return HttpServerResponse.setHeader(response, "X-Inner", "inner")
      })
    ) as Route.HttpMiddlewareFunction

    const router = Router
      .use(Route.layer(Route.http(outerHeader)))
      .use(Route.layer(Route.http(innerHeader)))
      .mount("/nested", Route.text("nested"))

    const fetch = await makeFetch(router)
    const response = await fetch("/nested")

    t.expect(response.headers.get("X-Outer")).toBe("outer")
    t.expect(response.headers.get("X-Inner")).toBe("inner")
  })
})

t.describe("BunRoute placeholder replacement", () => {
  t.test("%yield% is replaced with nested route content via layer", async () => {
    const layoutBundle = BunRoute.html(() =>
      import("../../static/LayoutSlots.html")
    )

    const router = Router
      .use(Route.layer(layoutBundle))
      .mount("/page", Route.html(Effect.succeed("<p>Child Content</p>")))

    await Effect.runPromise(
      Effect
        .gen(function*() {
          const bunServer = yield* BunHttpServer.BunServer
          const routes = yield* BunRoute.routesFromRouter(router)
          bunServer.addRoutes(routes)

          const baseUrl =
            `http://${bunServer.server.hostname}:${bunServer.server.port}`
          const response = yield* Effect.promise(() => fetch(`${baseUrl}/page`))

          const html = yield* Effect.promise(() => response.text())

          t.expect(html).toContain("<body>")
          t.expect(html).toContain("<p>Child Content</p>")
          t.expect(html).not.toContain("%yield%")
          t.expect(html).not.toContain("%slots.")
        })
        .pipe(
          Effect.scoped,
          Effect.provide(BunHttpServer.layer({ port: 0 })),
        ),
    )
  })

  t.test("%yield% and %slots% are replaced with empty when no nested content", async () => {
    const layoutBundle = BunRoute.html(() =>
      import("../../static/LayoutSlots.html")
    )

    const router = Router.mount("/layout", layoutBundle)

    await Effect.runPromise(
      Effect
        .gen(function*() {
          const bunServer = yield* BunHttpServer.BunServer
          const routes = yield* BunRoute.routesFromRouter(router)
          bunServer.addRoutes(routes)

          const baseUrl =
            `http://${bunServer.server.hostname}:${bunServer.server.port}`
          const response = yield* Effect.promise(() =>
            fetch(`${baseUrl}/layout`)
          )

          const html = yield* Effect.promise(() => response.text())

          t.expect(html).toContain("<title></title>")
          t.expect(html).toContain("<body>")
          t.expect(html).not.toContain("%yield%")
          t.expect(html).not.toContain("%slots.")
        })
        .pipe(
          Effect.scoped,
          Effect.provide(BunHttpServer.layer({ port: 0 })),
        ),
    )
  })
})

type FetchFn = (path: string, init?: { method?: string }) => Promise<Response>

type HandlerFn = (
  req: Request,
  server: unknown,
) => Response | Promise<Response>

async function makeBunRoutes(
  router: Router.RouterBuilder.Any,
): Promise<BunRoute.BunRoutes> {
  return Effect.runPromise(
    BunRoute.routesFromRouter(router).pipe(
      Effect.provide(BunHttpServer.layer({ port: 0 })),
    ),
  )
}

async function makeFetch(router: Router.RouterBuilder.Any): Promise<FetchFn> {
  const routes = await makeBunRoutes(router)
  const mockServer = {} as import("bun").Server<unknown>

  return async (path, init) => {
    const method = init?.method ?? "GET"
    const handler = routes[path]

    if (!handler) {
      throw new Error(`No handler for path: ${path}`)
    }

    if (typeof handler === "function") {
      return handler(new Request(`http://localhost${path}`, init), mockServer)
    }

    const methodHandler = (handler as Record<string, HandlerFn>)[method]
    if (!methodHandler) {
      throw new Error(`No handler for ${method} ${path}`)
    }

    return methodHandler(
      new Request(`http://localhost${path}`, init),
      mockServer,
    )
  }
}
