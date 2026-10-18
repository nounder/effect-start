import * as test from "bun:test"
import { BunFileSystem, BunServer } from "effect-start/bun"
import * as MainFiber from "effect-start/bun/internal/MainFiber"
import type * as RouteMap from "effect-start/internal/RouteMap"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as Start from "effect-start/Start"
import * as StaticRoute from "effect-start/StaticRoute"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServer from "effect/http/HttpServer"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Layer from "effect/Layer"
import * as NetAddress from "effect/net/NetAddress"
import * as Scope from "effect/Scope"
import * as NPath from "node:path"
import * as TestHttpClient from "../internal/TestHttpClient.ts"

const staticDir = NPath.resolve(import.meta.dir, "../../static")

const serverPort = (server: HttpServer.HttpServer["Service"]) =>
  NetAddress.isInetAddress(server.address) ? server.address.port : undefined
const serveOptions = (options: BunServer.BunServeOptions) => options

const withEnv = (env: Record<string, string | undefined>) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const original: Record<string, string | undefined> = {}
      for (const key of Object.keys(env)) {
        original[key] = process.env[key]
        if (env[key] === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = env[key]
        }
      }
      return original
    }),
    (original) =>
      Effect.sync(() => {
        for (const key of Object.keys(original)) {
          if (original[key] === undefined) {
            delete process.env[key]
          } else {
            process.env[key] = original[key]
          }
        }
      }),
  )

test.describe("RouteHttp.layer with BunServer", () => {
  test.it("applies global middleware registered after the server starts", () =>
    Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const router = yield* HttpRouter.HttpRouter
        const address = HttpServer.formatAddress(server.address)
        const client = TestHttpClient.fromHandler(fetch)
        const before = yield* client.get(address)

        test
          .expect(before.headers["x-global"])
          .toBeUndefined()

        yield* router.addGlobalMiddleware((next) =>
          Effect.map(next, (response) => HttpServerResponse.setHeader(response, "x-global", "late"))
        )
        const after = yield* client.get(address)

        test
          .expect(after.status)
          .toBe(200)
        test
          .expect(after.headers["x-global"])
          .toBe("late")
      })
      .pipe(
        Effect.provide(Start.build(
          RouteHttp.layer(),
          BunServer.layer(serveOptions({ hostname: "localhost", port: 0 })),
          Route.layer({ "/": Route.get(Route.text("ok")) }),
        )),
        Effect.scoped,
        Effect.runPromise,
      ))

  test.test("user-provided BunServer serves routes", () => {
    const routes = Route.map({
      "/": Route.get(Route.text("custom-server")),
    })

    const appLayer = Start.build(
      RouteHttp.layer(),
      BunServer.layer(serveOptions({ port: 0 })),
      Route.layer(routes),
    )

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${serverPort(bunServer)}/`))
        const body = yield* Effect.promise(() => response.text())

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(body)
          .toBe("custom-server")
      })
      .pipe(
        Effect.provide(appLayer),
        Effect.scoped,
        Effect.runPromise,
      )
  })
})

const fetchText = (url: string) =>
  Effect.tryPromise({
    try: () => fetch(url).then((response) => response.text()),
    catch: (cause) => cause,
  })

const serveText = (
  server: HttpServer.HttpServer["Service"],
  scope: Scope.Scope,
  text: string,
) =>
  Effect
    .gen(function*() {
      const router = yield* RouteHttp.toHttpRouter(Route.map({ "/*": Route.get(Route.text(text)) }))
      yield* server.serve(Effect.suspend(() => router.asHttpEffect()))
    })
    .pipe(Scope.provide(scope))

test.describe("BunServer route hot replacement", () => {
  test.it("serves the newest handler without changing the listener", () =>
    Effect
      .gen(function*() {
        const ownerScope = yield* Effect.scope
        const server = yield* BunServer.make({ hostname: "localhost", port: 0 })
        const firstScope = yield* Scope.fork(ownerScope)
        const secondScope = yield* Scope.fork(ownerScope)
        const address = HttpServer.formatAddress(server.address)

        yield* serveText(server, firstScope, "first")

        test
          .expect(yield* fetchText(address))
          .toBe("first")

        yield* serveText(server, secondScope, "second")

        test
          .expect(yield* fetchText(address))
          .toBe("second")
        test
          .expect(HttpServer.formatAddress(server.address))
          .toBe(address)
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.it("closing an older route scope keeps the newest handler", () =>
    Effect
      .gen(function*() {
        const ownerScope = yield* Effect.scope
        const server = yield* BunServer.make({ hostname: "localhost", port: 0 })
        const firstScope = yield* Scope.fork(ownerScope)
        const secondScope = yield* Scope.fork(ownerScope)
        const address = HttpServer.formatAddress(server.address)

        yield* serveText(server, firstScope, "first")
        yield* serveText(server, secondScope, "second")
        yield* Scope.close(firstScope, Exit.void)

        test
          .expect(yield* fetchText(address))
          .toBe("second")
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.it("closing the newest route scope restores the previous handler", () =>
    Effect
      .gen(function*() {
        const ownerScope = yield* Effect.scope
        const server = yield* BunServer.make({ hostname: "localhost", port: 0 })
        const firstScope = yield* Scope.fork(ownerScope)
        const secondScope = yield* Scope.fork(ownerScope)
        const address = HttpServer.formatAddress(server.address)

        yield* serveText(server, firstScope, "first")
        yield* serveText(server, secondScope, "second")
        yield* Scope.close(secondScope, Exit.void)

        test
          .expect(yield* fetchText(address))
          .toBe("first")
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.it("accepts the new main fiber's handler and ignores the old finalizer", () =>
    Effect
      .gen(function*() {
        const ownerScope = yield* Effect.scope
        const oldMain = yield* Effect.forkChild(Effect.never)
        MainFiber.set(oldMain)
        const server = yield* BunServer.make({ hostname: "localhost", port: 0 })
        const oldScope = yield* Scope.fork(ownerScope)
        const newScope = yield* Scope.fork(ownerScope)
        const address = HttpServer.formatAddress(server.address)

        yield* serveText(server, oldScope, "old")

        const newMain = yield* Effect.forkChild(Effect.never)
        MainFiber.set(newMain)
        yield* serveText(server, newScope, "new")

        test
          .expect(yield* fetchText(address))
          .toBe("new")

        yield* Scope.close(oldScope, Exit.void)

        test
          .expect(yield* fetchText(address))
          .toBe("new")

        yield* Scope.close(newScope, Exit.void)

        test
          .expect(Exit.isFailure(yield* Effect.exit(fetchText(address))))
          .toBe(true)

        yield* Fiber.interruptAll([oldMain, newMain])
      })
      .pipe(
        Effect.scoped,
        Effect.ensuring(Effect.sync(() => {
          const current = MainFiber.get()
          if (current !== undefined) MainFiber.clear(current)
        })),
        Effect.runPromise,
      ))

  test.it("does not restore an old generation when the new generation closes first", () =>
    Effect
      .gen(function*() {
        const ownerScope = yield* Effect.scope
        const oldMain = yield* Effect.forkChild(Effect.never)
        MainFiber.set(oldMain)
        const server = yield* BunServer.make({ hostname: "localhost", port: 0 })
        const oldScope = yield* Scope.fork(ownerScope)
        const newScope = yield* Scope.fork(ownerScope)
        const address = HttpServer.formatAddress(server.address)

        yield* serveText(server, oldScope, "old")

        const newMain = yield* Effect.forkChild(Effect.never)
        MainFiber.set(newMain)
        yield* serveText(server, newScope, "new")
        yield* Scope.close(newScope, Exit.void)

        test
          .expect(Exit.isFailure(yield* Effect.exit(fetchText(address))))
          .toBe(true)

        yield* Scope.close(oldScope, Exit.void)
        yield* Fiber.interruptAll([oldMain, newMain])
      })
      .pipe(
        Effect.scoped,
        Effect.ensuring(Effect.sync(() => {
          const current = MainFiber.get()
          if (current !== undefined) MainFiber.clear(current)
        })),
        Effect.runPromise,
      ))
})

test.test("exposes canonical addresses for wildcard binds", () =>
  Effect
    .gen(function*() {
      const ipv4Server = yield* BunServer.make({ hostname: "0.0.0.0", port: 0 })
      const ipv6Server = yield* BunServer.make({ hostname: "::", port: 0 })

      test
        .expect(ipv4Server.address)
        .toMatchObject({ _tag: "InetAddressV4", address: NetAddress.ipv4Unspecified })
      test
        .expect(ipv6Server.address)
        .toMatchObject({ _tag: "InetAddressV6", address: NetAddress.ipv6Unspecified })
    })
    .pipe(
      Effect.scoped,
      Effect.runPromise,
    ))

test.describe("smart port selection", () => {
  test.test.skipIf(process.stdout.isTTY)(
    "uses random port when PORT not set, isTTY=false, CLAUDECODE set",
    () =>
      Effect
        .gen(function*() {
          yield* withEnv({ CLAUDECODE: "1" })
          const bunServer = yield* BunServer.make({})

          test
            .expect(serverPort(bunServer))
            .not
            .toBe(3000)
        })
        .pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})),
          Effect.scoped,
          Effect.runPromise,
        ),
  )

  test.test("uses explicit PORT even when CLAUDECODE is set", () =>
    Effect
      .gen(function*() {
        yield* withEnv({ CLAUDECODE: "1" })
        const bunServer = yield* BunServer.make({})

        test
          .expect(serverPort(bunServer))
          .toBe(5678)
      })
      .pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ PORT: "5678" })),
        Effect.scoped,
        Effect.runPromise,
      ))
})

const testLayer = <const Input extends RouteMap.RouteMapInput>(routes: Input) =>
  RouteHttp.layer().pipe(
    Layer.provideMerge(BunServer.layer(serveOptions({ port: 0 }))),
    Layer.provide(Route.layer(routes)),
  )

test.describe("routes", () => {
  test.test("serves static text route", () => {
    const routes = Route.map({
      "/": Route.get(Route.text("Hello, World!")),
    })

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${serverPort(bunServer)}/`))
        const text = yield* Effect.promise(() => response.text())

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(text)
          .toBe("Hello, World!")
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("serves JSON route", () => {
    const routes = Route.map({
      "/api/data": Route.get(Route.json({ message: "success", value: 42 })),
    })

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${serverPort(bunServer)}/api/data`))
        const json = yield* Effect.promise(() => response.json())

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(response.headers.get("Content-Type"))
          .toBe(
            "application/json",
          )
        test
          .expect(json)
          .toEqual({ message: "success", value: 42 })
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("returns 404 for unknown routes", () => {
    const routes = Route.map({
      "/": Route.get(Route.text("Home")),
    })

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${serverPort(bunServer)}/unknown`))

        test
          .expect(response.status)
          .toBe(404)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("handles content negotiation", () => {
    const routes = Route.map({
      "/data": Route.get(
        Route.json({ type: "json" }),
        Route.html("<div>html</div>"),
      ),
    })

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const baseUrl = `http://localhost:${serverPort(bunServer)}`

        const jsonResponse = yield* Effect.promise(() =>
          fetch(`${baseUrl}/data`, {
            headers: { Accept: "application/json" },
          })
        )
        const jsonBody = yield* Effect.promise(() => jsonResponse.json())

        const htmlResponse = yield* Effect.promise(() =>
          fetch(`${baseUrl}/data`, {
            headers: { Accept: "text/html" },
          })
        )
        const htmlBody = yield* Effect.promise(() => htmlResponse.text())

        test
          .expect(jsonResponse.headers.get("Content-Type"))
          .toBe(
            "application/json",
          )
        test
          .expect(jsonBody)
          .toEqual({ type: "json" })
        test
          .expect(htmlResponse.headers.get("Content-Type"))
          .toBe(
            "text/html; charset=utf-8",
          )
        test
          .expect(htmlBody)
          .toBe("<div>html</div>")
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("returns 406 for unacceptable content type", () => {
    const routes = Route.map({
      "/data": Route.get(Route.json({ type: "json" })),
    })

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() =>
          fetch(`http://localhost:${serverPort(bunServer)}/data`, {
            headers: { Accept: "image/png" },
          })
        )

        test
          .expect(response.status)
          .toBe(406)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("handles parameterized routes", () => {
    const routes = Route.map({
      "/users/:id": Route.get(Route.text("user")),
    })

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${serverPort(bunServer)}/users/123`))
        const text = yield* Effect.promise(() => response.text())

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(text)
          .toBe("user")
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })
})

test.describe("Start.serve composition", () => {
  test.test("layerStart reuses an application-provided server", () =>
    Effect
      .gen(function*() {
        const server = yield* BunServer.make({ hostname: "localhost", port: 0 })
        const context = yield* Layer.build(
          RouteHttp.layer().pipe(
            Layer.provideMerge(BunServer.layerStart({ port: 0 })),
            Layer.provide(Layer.succeed(HttpServer.HttpServer, server)),
            Layer.provide(Route.layer({
              "/hello": Route.get(Route.text("world")),
            })),
          ),
        )
        const client = TestHttpClient.fromHandler((request) => fetch(request))
        const response = yield* client.get(HttpServer.formatAddress(server.address) + "/hello")

        test
          .expect(Context.get(context, HttpServer.HttpServer))
          .toBe(server)
        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(yield* response.text)
          .toBe("world")
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.test("Start.pack composes routing with a Bun server", () => {
    const appLayer = Start.pack(
      Route.layer(
        Route.map({
          "/hello": Route.get(Route.text("world")),
        }),
      ),
      RouteHttp.layer(),
      BunServer.layer(serveOptions({ port: 0 })),
    )

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${serverPort(bunServer)}/hello`))
        const text = yield* Effect.promise(() => response.text())

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(text)
          .toBe("world")
      })
      .pipe(
        Effect.provide(appLayer),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("routes resolve when RouteHttp.layer requires Route.Routes", () => {
    const appLayer = Route.layer(
      Route.map({
        "/hello": Route.get(Route.text("world")),
      }),
    )

    const serverLayer = RouteHttp.layer().pipe(Layer.provideMerge(BunServer.layer(serveOptions({ port: 0 }))))
    const composed = Layer.provide(
      BunServer.withLogAddress(serverLayer),
      appLayer,
    )

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${serverPort(bunServer)}/hello`))
        const text = yield* Effect.promise(() => response.text())

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(text)
          .toBe("world")
      })
      .pipe(
        Effect.provide(composed),
        Effect.scoped,
        Effect.runPromise,
      )
  })
})

test.describe("static file routes", () => {
  test.test("serves static files with correct content-type through HttpRouter", () => {
    const gifPath = NPath.join(staticDir, "pixel.gif")
    const svgPath = NPath.join(staticDir, "icon.svg")

    return Effect
      .gen(function*() {
        const context = yield* Layer.build(
          testLayer({
            "/pixel.gif": StaticRoute.from({ path: gifPath, directoryIndex: false }),
            "/icon.svg": StaticRoute.from({ path: svgPath, directoryIndex: false }),
          })
            .pipe(Layer.provide(BunFileSystem.layer)),
        )
        const bunServer = Context.get(context, HttpServer.HttpServer)

        const base = `http://localhost:${serverPort(bunServer)}`

        const gifResponse = yield* Effect.promise(() => fetch(`${base}/pixel.gif`))

        test
          .expect(gifResponse.status)
          .toBe(200)
        test
          .expect(gifResponse.headers.get("content-type"))
          .toBe("image/gif")

        const svgResponse = yield* Effect.promise(() => fetch(`${base}/icon.svg`))

        test
          .expect(svgResponse.status)
          .toBe(200)
        test
          .expect(svgResponse.headers.get("content-type"))
          .toBe(
            "image/svg+xml",
          )
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("HEAD request returns headers without body for static routes", () => {
    const gifPath = NPath.join(staticDir, "pixel.gif")

    return Effect
      .gen(function*() {
        const context = yield* Layer.build(
          testLayer({
            "/pixel.gif": StaticRoute.from({ path: gifPath, directoryIndex: false }),
          })
            .pipe(Layer.provide(BunFileSystem.layer)),
        )
        const bunServer = Context.get(context, HttpServer.HttpServer)

        const base = `http://localhost:${serverPort(bunServer)}`

        const headResponse = yield* Effect.promise(() => fetch(`${base}/pixel.gif`, { method: "HEAD" }))

        test
          .expect(headResponse.status)
          .toBe(200)
        test
          .expect(headResponse.headers.get("content-type"))
          .toBe("image/gif")
        test
          .expect(Number(headResponse.headers.get("content-length")))
          .toBeGreaterThan(0)

        const body = yield* Effect.promise(() => headResponse.text())

        test
          .expect(body)
          .toBe("")
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      )
  })
})

test.it("serves normalized catch-alls through HttpRouter", () =>
  Effect
    .gen(function*() {
      const routes = Route.map({
        "/docs/*": Route.get(Route.json(function*() {
          return yield* HttpRouter.params
        })),
        "/Files/*": Route.get(Route.json(function*() {
          return yield* HttpRouter.params
        })),
        "/café/:id": Route.get(Route.json(function*() {
          return yield* HttpRouter.params
        })),
      })
      const context = yield* Layer.build(
        RouteHttp.layer().pipe(
          Layer.provideMerge(BunServer.layer({ hostname: "localhost", port: 0 })),
          Layer.provide(Route.layer(routes)),
        ),
      )
      const address = HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address)
      const client = TestHttpClient.fromHandler((request) => fetch(request))

      test
        .expect(yield* (yield* client.get(address + "/docs/a%20b/c")).json)
        .toEqual({ "*": "a b/c" })

      for (const path of ["/Files", "/Files/"]) {
        test
          .expect(yield* (yield* client.get(address + path)).json)
          .toEqual({})
      }

      test
        .expect((yield* client.get(address + "/Files/%GG")).status)
        .toBe(404)
      test
        .expect((yield* client.get(address + "/café/%E0%A4%A")).status)
        .toBe(404)
      test
        .expect(yield* (yield* client.get(address + "/caf%C3%A9/%2520")).json)
        .toEqual({ id: "%20" })

      const router = Context.get(context, HttpRouter.HttpRouter)
      yield* router.add("GET", "/external", HttpServerResponse.text("external"))

      test
        .expect(yield* (yield* client.get(address + "/external")).text)
        .toBe("external")
      test
        .expect((yield* client.get(address + "/missing")).status)
        .toBe(404)
    })
    .pipe(
      Effect.scoped,
      Effect.runPromise,
    ))
