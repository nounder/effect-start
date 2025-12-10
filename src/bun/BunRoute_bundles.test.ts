import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Route from "../Route.ts"
import * as Router from "../Router.ts"
import * as TestHttpClient from "../TestHttpClient.ts"
import * as BunHttpServer from "./BunHttpServer.ts"
import * as BunRoute from "./BunRoute.ts"

t.describe("BunRoute proxy with Bun.serve", () => {
  t.test("BunRoute proxy returns same content as direct bundle access", async () => {
    const bunRoute = BunRoute.html(() => import("../../static/TestPage.html"))

    const router = Router.mount("/test", bunRoute)

    await Effect.runPromise(
      Effect
        .gen(function*() {
          const bunServer = yield* BunHttpServer.BunHttpServer

          const routes = yield* BunRoute.routesFromRouter(router)
          bunServer.addRoutes(routes)

          const internalPath = Object.keys(routes).find((k) =>
            k.includes(".BunRoute-")
          )
          t.expect(internalPath).toBeDefined()

          const proxyHandler = routes["/test"]
          t.expect(typeof proxyHandler).toBe("function")

          const internalBundle = routes[internalPath!]
          t.expect(internalBundle).toHaveProperty("index")

          const baseUrl =
            `http://${bunServer.server.hostname}:${bunServer.server.port}`
          const client = TestHttpClient.make<never, never>(
            (req) => fetch(req),
            {
              baseUrl,
            },
          )

          const directResponse = yield* client.get(internalPath!)
          const proxyResponse = yield* client.get("/test")

          t.expect(proxyResponse.status).toBe(directResponse.status)

          const directText = yield* directResponse.text
          const proxyText = yield* proxyResponse.text

          t.expect(proxyText).toBe(directText)
          t.expect(proxyText).toContain("Test Page Content")
        })
        .pipe(
          Effect.scoped,
          Effect.provide(BunHttpServer.layer({ port: 0 })),
        ),
    )
  })

  t.test("multiple BunRoutes each get unique internal paths", async () => {
    const bunRoute1 = BunRoute.html(() => import("../../static/TestPage.html"))
    const bunRoute2 = BunRoute.html(() =>
      import("../../static/AnotherPage.html")
    )

    const router = Router
      .mount("/page1", bunRoute1)
      .mount("/page2", bunRoute2)

    await Effect.runPromise(
      Effect
        .gen(function*() {
          const bunServer = yield* BunHttpServer.BunHttpServer
          const routes = yield* BunRoute.routesFromRouter(router)
          bunServer.addRoutes(routes)

          const internalPaths = Object.keys(routes).filter((k) =>
            k.includes(".BunRoute-")
          )
          t.expect(internalPaths).toHaveLength(2)

          const nonces = internalPaths.map((p) => {
            const match = p.match(/\.BunRoute-([a-z0-9]+)/)
            return match?.[1]
          })
          t.expect(nonces[0]).not.toBe(nonces[1])

          const baseUrl =
            `http://${bunServer.server.hostname}:${bunServer.server.port}`
          const client = TestHttpClient.make<never, never>(
            (req) => fetch(req),
            {
              baseUrl,
            },
          )

          const response1 = yield* client.get("/page1")
          const response2 = yield* client.get("/page2")

          const text1 = yield* response1.text
          const text2 = yield* response2.text

          t.expect(text1).toContain("Test Page Content")
          t.expect(text2).toContain("Another Page Content")
        })
        .pipe(
          Effect.scoped,
          Effect.provide(BunHttpServer.layer({ port: 0 })),
        ),
    )
  })

  t.test("proxy preserves request headers", async () => {
    const bunRoute = BunRoute.html(() => import("../../static/TestPage.html"))

    const router = Router.mount("/headers-test", bunRoute)

    await Effect.runPromise(
      Effect
        .gen(function*() {
          const bunServer = yield* BunHttpServer.BunHttpServer

          const routes = yield* BunRoute.routesFromRouter(router)
          bunServer.addRoutes(routes)

          const baseUrl =
            `http://${bunServer.server.hostname}:${bunServer.server.port}`
          const client = TestHttpClient.make<never, never>(
            (req) => fetch(req),
            {
              baseUrl,
            },
          )

          const response = yield* client.get("/headers-test", {
            headers: {
              "Accept": "text/html",
              "X-Custom-Header": "test-value",
            },
          })

          t.expect(response.status).toBe(200)
          const text = yield* response.text
          t.expect(text).toContain("Test Page Content")
        })
        .pipe(
          Effect.scoped,
          Effect.provide(BunHttpServer.layer({ port: 0 })),
        ),
    )
  })

  t.test("mixed BunRoute and regular routes work together", async () => {
    const bunRoute = BunRoute.html(() => import("../../static/TestPage.html"))

    const router = Router
      .mount("/html", bunRoute)
      .mount("/api", Route.text("Hello from text route"))

    await Effect.runPromise(
      Effect
        .gen(function*() {
          const bunServer = yield* BunHttpServer.BunHttpServer
          const routes = yield* BunRoute.routesFromRouter(router)
          bunServer.addRoutes(routes)

          const baseUrl =
            `http://${bunServer.server.hostname}:${bunServer.server.port}`
          const client = TestHttpClient.make<never, never>(
            (req) => fetch(req),
            {
              baseUrl,
            },
          )

          const htmlResponse = yield* client.get("/html")
          const apiResponse = yield* client.get("/api")

          const htmlText = yield* htmlResponse.text
          const apiText = yield* apiResponse.text

          t.expect(htmlText).toContain("Test Page Content")
          t.expect(apiText).toBe("Hello from text route")
        })
        .pipe(
          Effect.scoped,
          Effect.provide(BunHttpServer.layer({ port: 0 })),
        ),
    )
  })

  t.test("nonce is different across separate BunRoute instances", async () => {
    const bunRoute1 = BunRoute.html(() => import("../../static/TestPage.html"))
    const bunRoute2 = BunRoute.html(() => import("../../static/TestPage.html"))

    const router = Router
      .mount("/test1", bunRoute1)
      .mount("/test2", bunRoute2)

    await Effect.runPromise(
      Effect
        .gen(function*() {
          const routes = yield* BunRoute.routesFromRouter(router)

          const internalPaths = Object.keys(routes).filter((k) =>
            k.includes(".BunRoute-")
          )

          t.expect(internalPaths).toHaveLength(2)
          t.expect(internalPaths[0]).not.toBe(internalPaths[1])
        })
        .pipe(
          Effect.scoped,
          Effect.provide(BunHttpServer.layer({ port: 0 })),
        ),
    )
  })
})
