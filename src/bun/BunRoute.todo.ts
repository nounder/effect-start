import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import type { HTMLBundle } from "bun"
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as assert from "node:assert"
import * as Route from "../Route.ts"
import * as Router from "../Router.ts"
import type { HttpMiddlewareFunction } from "../RouteSet_http.ts"
import * as BunHttpServer from "./BunHttpServer.ts"
import * as BunRoute from "./BunRoute.ts"
import * as BunRouter from "./BunRouter.ts"

test.describe(`${BunRoute.validateBunPattern.name}`, () => {
  test.it("allows exact paths", () => {
    const result = BunRoute.validateBunPattern("/users")
    test
      .expect(result._tag)
      .toBe("None")
  })

  test.it("allows full-segment params", () => {
    const result = BunRoute.validateBunPattern("/users/[id]")
    test
      .expect(result._tag)
      .toBe("None")
  })

  test.it("allows rest params", () => {
    const result = BunRoute.validateBunPattern("/docs/[...path]")
    test
      .expect(result._tag)
      .toBe("None")
  })

  test.it("rejects prefixed params", () => {
    const result = BunRoute.validateBunPattern("/users/pk_[id]")
    assert.strictEqual(result._tag, "Some")
    test
      .expect(result.value.reason)
      .toBe("UnsupportedPattern")
    test
      .expect(result.value.pattern)
      .toBe("/users/pk_[id]")
  })

  test.it("rejects suffixed params", () => {
    const result = BunRoute.validateBunPattern("/users/[id]_details")
    assert.strictEqual(result._tag, "Some")
    test
      .expect(result.value.reason)
      .toBe("UnsupportedPattern")
  })

  test.it("rejects dot suffix on params", () => {
    const result = BunRoute.validateBunPattern("/api/[id].json")
    assert.strictEqual(result._tag, "Some")
    test
      .expect(result.value.reason)
      .toBe("UnsupportedPattern")
  })

  test.it("rejects tilde suffix on params", () => {
    const result = BunRoute.validateBunPattern("/api/[id]~test")
    assert.strictEqual(result._tag, "Some")
    test
      .expect(result.value.reason)
      .toBe("UnsupportedPattern")
  })

  test.it("allows optional params (implemented via two patterns)", () => {
    const result = BunRoute.validateBunPattern("/users/[[id]]")
    test
      .expect(result._tag)
      .toBe("None")
  })

  test.it("allows optional rest params (implemented via two patterns)", () => {
    const result = BunRoute.validateBunPattern("/docs/[[...path]]")
    test
      .expect(result._tag)
      .toBe("None")
  })
})

test.describe(`${BunRouter.routesFrom.name}`, () => {
  test.it("fails with RouterError for unsupported patterns", async () => {
    const result = await Effect.runPromise(
      BunRouter
        .routesFrom(
          Router.mount("/users/pk_[id]", Route.text("user")),
        )
        .pipe(
          Effect.either,
          Effect.provide(BunHttpServer.layer({ port: 0 })),
        ),
    )

    assert.strictEqual(result._tag, "Left")
    test
      .expect(result.left._tag)
      .toBe("RouterError")
    test
      .expect(result.left.reason)
      .toBe("UnsupportedPattern")
  })

  test.it("converts text route to fetch handler", async () => {
    const fetch = await makeFetch(
      Router.mount("/hello", Route.text("Hello World")),
    )

    const response = await fetch("/hello")

    test
      .expect(response.status)
      .toBe(200)
    test
      .expect(await response.text())
      .toBe("Hello World")
  })

  test.it("converts json route to fetch handler", async () => {
    const fetch = await makeFetch(
      Router.mount("/api/data", Route.json({ message: "ok", count: 42 })),
    )

    const response = await fetch("/api/data")

    test
      .expect(response.status)
      .toBe(200)
    test
      .expect(await response.json())
      .toEqual({ message: "ok", count: 42 })
  })

  test.it("converts html route to fetch handler", async () => {
    const fetch = await makeFetch(
      Router.mount("/page", Route.html(Effect.succeed("<h1>Title</h1>"))),
    )

    const response = await fetch("/page")

    test
      .expect(response.status)
      .toBe(200)
    test
      .expect(await response.text())
      .toBe("<h1>Title</h1>")
  })

  test.it("handles method-specific routes", async () => {
    const fetch = await makeFetch(
      Router.mount(
        "/users",
        Route.get(Route.json({ users: [] })).post(
          Route.json({ created: true }),
        ),
      ),
    )

    const getResponse = await fetch("/users")
    test
      .expect(await getResponse.json())
      .toEqual({ users: [] })

    const postResponse = await fetch("/users", { method: "POST" })
    test
      .expect(await postResponse.json())
      .toEqual({ created: true })
  })

  test.it("converts path syntax to Bun format", async () => {
    const routes = await makeBunRoutes(
      Router
        .mount("/users/[id]", Route.text("user"))
        .mount("/docs/[...path]", Route.text("docs")),
    )

    test
      .expect(routes["/users/:id"])
      .toBeDefined()
    test
      .expect(routes["/docs/*"])
      .toBeDefined()
    test
      .expect(routes["/users/[id]"])
      .toBeUndefined()
    test
      .expect(routes["/docs/[...path]"])
      .toBeUndefined()
  })

  test.it("groups multiple methods under same path", async () => {
    const fetch = await makeFetch(
      Router.mount(
        "/resource",
        Route
          .get(Route.text("get"))
          .post(Route.text("post"))
          .del(Route.text("delete")),
      ),
    )

    const getRes = await fetch("/resource")
    const postRes = await fetch("/resource", { method: "POST" })
    const delRes = await fetch("/resource", { method: "DELETE" })

    test
      .expect(await getRes.text())
      .toBe("get")
    test
      .expect(await postRes.text())
      .toBe("post")
    test
      .expect(await delRes.text())
      .toBe("delete")
  })
})

test.describe("fetch handler Response", () => {
  test.it("returns Response instance", async () => {
    const fetch = await makeFetch(
      Router.mount("/test", Route.text("test")),
    )

    const response = await fetch("/test")

    test
      .expect(response)
      .toBeInstanceOf(Response)
  })

  test.it("text response has correct content-type", async () => {
    const fetch = await makeFetch(
      Router.mount("/text", Route.text("hello")),
    )

    const response = await fetch("/text")

    test
      .expect(response.headers.get("content-type"))
      .toContain("text/plain")
  })

  test.it("json response has correct content-type", async () => {
    const fetch = await makeFetch(
      Router.mount("/json", Route.json({ data: 1 })),
    )

    const response = await fetch("/json")

    test
      .expect(response.headers.get("content-type"))
      .toContain("application/json")
  })

  test.it("html response has correct content-type", async () => {
    const fetch = await makeFetch(
      Router.mount("/html", Route.html(Effect.succeed("<p>hi</p>"))),
    )

    const response = await fetch("/html")

    test
      .expect(response.headers.get("content-type"))
      .toContain("text/html")
  })

  test.it("response body is readable", async () => {
    const fetch = await makeFetch(
      Router.mount("/body", Route.text("readable body")),
    )

    const response = await fetch("/body")

    test
      .expect(response.bodyUsed)
      .toBe(false)
    const text = await response.text()
    test
      .expect(text)
      .toBe("readable body")
    test
      .expect(response.bodyUsed)
      .toBe(true)
  })

  test.it("response ok is true for 200 status", async () => {
    const fetch = await makeFetch(
      Router.mount("/ok", Route.text("ok")),
    )

    const response = await fetch("/ok")

    test
      .expect(response.ok)
      .toBe(true)
    test
      .expect(response.status)
      .toBe(200)
  })
})

test.describe("Route.layer httpMiddleware", () => {
  test.it("applies middleware headers to child routes", async () => {
    const addHeader = HttpMiddleware.make((app) =>
      Effect.gen(function*() {
        const response = yield* app
        return HttpServerResponse.setHeader(response, "X-Layer-Applied", "true")
      })
    ) as HttpMiddlewareFunction

    const router = Router
      .use(Route.http(addHeader))
      .mount("/child", Route.text("child content"))

    const fetch = await makeFetch(router)
    const response = await fetch("/child")

    test
      .expect(response.headers.get("X-Layer-Applied"))
      .toBe("true")
    test
      .expect(await response.text())
      .toBe("child content")
  })

  test.it("middleware only applies to children, not siblings", async () => {
    const addHeader = HttpMiddleware.make((app) =>
      Effect.gen(function*() {
        const response = yield* app
        return HttpServerResponse.setHeader(response, "X-Layer-Applied", "true")
      })
    ) as HttpMiddlewareFunction

    const router = Router
      .mount("/outside", Route.text("outside content"))
      .use(Route.http(addHeader))
      .mount("/inside", Route.text("inside content"))

    const fetch = await makeFetch(router)

    const insideResponse = await fetch("/inside")
    test
      .expect(insideResponse.headers.get("X-Layer-Applied"))
      .toBe("true")

    const outsideResponse = await fetch("/outside")
    test
      .expect(outsideResponse.headers.get("X-Layer-Applied"))
      .toBeNull()
  })

  test.it("multiple middleware are applied in order", async () => {
    const addHeader1 = HttpMiddleware.make((app) =>
      Effect.gen(function*() {
        const response = yield* app
        return HttpServerResponse.setHeader(response, "X-First", "1")
      })
    ) as HttpMiddlewareFunction

    const addHeader2 = HttpMiddleware.make((app) =>
      Effect.gen(function*() {
        const response = yield* app
        return HttpServerResponse.setHeader(response, "X-Second", "2")
      })
    ) as HttpMiddlewareFunction

    const router = Router
      .use(Route.http(addHeader1).http(addHeader2))
      .mount("/test", Route.text("test"))

    const fetch = await makeFetch(router)
    const response = await fetch("/test")

    test
      .expect(response.headers.get("X-First"))
      .toBe("1")
    test
      .expect(response.headers.get("X-Second"))
      .toBe("2")
  })

  test.it("nested layers apply all middleware", async () => {
    const outerHeader = HttpMiddleware.make((app) =>
      Effect.gen(function*() {
        const response = yield* app
        return HttpServerResponse.setHeader(response, "X-Outer", "outer")
      })
    ) as HttpMiddlewareFunction

    const innerHeader = HttpMiddleware.make((app) =>
      Effect.gen(function*() {
        const response = yield* app
        return HttpServerResponse.setHeader(response, "X-Inner", "inner")
      })
    ) as HttpMiddlewareFunction

    const router = Router
      .use(Route.http(outerHeader))
      .use(Route.http(innerHeader))
      .mount("/nested", Route.text("nested"))

    const fetch = await makeFetch(router)
    const response = await fetch("/nested")

    test
      .expect(response.headers.get("X-Outer"))
      .toBe("outer")
    test
      .expect(response.headers.get("X-Inner"))
      .toBe("inner")
  })
})

test.describe(`${BunRoute.bundle.name}`, () => {
  test.it("creates a BunHandler with required properties", () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const handler = BunRoute.bundle(() => Promise.resolve(mockBundle))

    test
      .expect(BunRoute.isBunHandler(handler))
      .toBe(true)
    test
      .expect(typeof handler.internalPathPrefix)
      .toBe("string")
    test
      .expect(handler.internalPathPrefix)
      .toMatch(/^\/\.BunRoute-/)
    test
      .expect(typeof handler.load)
      .toBe("function")
  })

  test.it("load resolves HTMLBundle from default export", async () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const handler = BunRoute.bundle(() =>
      Promise.resolve({ default: mockBundle })
    )

    const bundle = await handler.load()
    test
      .expect(bundle)
      .toBe(mockBundle)
  })

  test.it("load resolves HTMLBundle from direct export", async () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const handler = BunRoute.bundle(() => Promise.resolve(mockBundle))

    const bundle = await handler.load()
    test
      .expect(bundle)
      .toBe(mockBundle)
  })

  test.it("Route.html(bundle(...)) creates proxy and internal routes", async () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const handler = BunRoute.bundle(() => Promise.resolve(mockBundle))

    const routes = await makeBunRoutes(
      Router.mount("/app", Route.html(handler)),
    )

    const internalPath = Object.keys(routes).find((k) =>
      k.includes(".BunRoute-")
    )

    test
      .expect(internalPath)
      .toBeDefined()
    test
      .expect(routes[internalPath!])
      .toBe(mockBundle)
    test
      .expect(typeof routes["/app"])
      .toBe("object")
  })
})

type FetchFn = (path: string, init?: { method?: string }) => Promise<Response>

type HandlerFn = (
  req: Request,
  server: unknown,
) => Response | Promise<Response>

async function makeBunRoutes(
  router: Router.Router.Any,
): Promise<BunRoute.BunRoutes> {
  return Effect.runPromise(
    BunRouter.routesFrom(router).pipe(
      Effect.provide(BunHttpServer.layer({ port: 0 })),
    ),
  )
}

async function makeFetch(router: Router.Router.Any): Promise<FetchFn> {
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
