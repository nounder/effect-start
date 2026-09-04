import * as test from "bun:test"
import { BunRoute, BunServer } from "effect-start/bun"
import * as Route from "effect-start/Route"
import * as Start from "effect-start/Start"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as HttpServer from "effect/unstable/http/HttpServer"
import * as NFs from "node:fs"
import * as NOs from "node:os"
import * as NPath from "node:path"
import * as BunHttpServer from "effect-start/bun/internal/BunHttpServer"
import * as MainFiber from "effect-start/bun/internal/MainFiber"
import type * as RouteMap from "effect-start/internal/RouteMap"
import * as RouteHttp from "effect-start/RouteHttp"

const staticDir = NPath.resolve(import.meta.dir, "../../static")

const serverPort = (server: HttpServer.HttpServer["Service"]) =>
  server.address._tag === "TcpAddress" ? server.address.port : undefined
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

test.describe("layerRoutes port precedence", () => {
  test.test("user-provided BunServer serves routes", () => {
    const routes = Route.map({
      "/": Route.get(Route.text("custom-server")),
    })

    const appLayer = Start.build(
      BunServer.layerRoutes(serveOptions({ port: 0 })),
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
  server
    .serve(
      RouteHttp.tracedHandler<never>(Route.get(Route.text(text))),
    )
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

  test.it("preserves native routes while replacing canonical handlers", () =>
    Effect
      .gen(function*() {
        const ownerScope = yield* Effect.scope
        const server = yield* BunServer.make({
          hostname: "localhost",
          port: 0,
          routes: { "/native": new Response("native") },
        })
        const firstScope = yield* Scope.fork(ownerScope)
        const secondScope = yield* Scope.fork(ownerScope)
        const address = HttpServer.formatAddress(server.address)

        yield* serveText(server, firstScope, "first")

        test
          .expect(yield* fetchText(`${address}/native`))
          .toBe("native")
        test
          .expect(yield* fetchText(`${address}/fallback`))
          .toBe("first")

        yield* serveText(server, secondScope, "second")

        test
          .expect(yield* fetchText(`${address}/native`))
          .toBe("native")
        test
          .expect(yield* fetchText(`${address}/fallback`))
          .toBe("second")

        yield* Scope.close(secondScope, Exit.void)

        test
          .expect(yield* fetchText(`${address}/native`))
          .toBe("native")
        test
          .expect(yield* fetchText(`${address}/fallback`))
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

  test.it("ignores native route replacement from a stale generation", () =>
    Effect
      .gen(function*() {
        const staleGeneration = yield* Effect.forkChild(Effect.never)
        const currentGeneration = yield* Effect.forkChild(Effect.never)
        MainFiber.set(currentGeneration)
        const managed = yield* BunHttpServer.make({ hostname: "localhost", port: 0 })
        const address = HttpServer.formatAddress(managed.service.address)

        managed.replaceRoutes({
          "/fresh": () => new Response("fresh"),
        }, currentGeneration)
        managed.replaceRoutes({
          "/stale": () => new Response("stale"),
        }, staleGeneration)

        test
          .expect(yield* fetchText(`${address}/fresh`))
          .toBe("fresh")
        test
          .expect(yield* fetchText(`${address}/stale`))
          .toBe("not found")
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
        .toMatchObject({ _tag: "TcpAddress", hostname: "0.0.0.0" })
      test
        .expect(ipv6Server.address)
        .toMatchObject({ _tag: "TcpAddress", hostname: "::" })
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
  BunServer.layerRoutes(serveOptions({ port: 0 })).pipe(Layer.provide(Route.layer(routes)))

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
  test.test("layerStart reuses an application-provided server", () => {
    const appLayer = Layer.merge(
      Route.layer(
        Route.map({
          "/hello": Route.get(Route.text("world")),
        }),
      ),
      BunServer.layer(serveOptions({
        port: 0,
        routes: { "/native": new Response("provided") },
      })),
    )
    const serverLayer = BunServer.layerStart(serveOptions({ port: 0 })).pipe(
      Layer.provide(appLayer),
    )

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const address = `http://localhost:${serverPort(bunServer)}`
        const native = yield* Effect.promise(() => fetch(`${address}/native`).then((response) => response.text()))
        const fallback = yield* Effect.promise(() => fetch(`${address}/hello`).then((response) => response.text()))

        test
          .expect(native)
          .toBe("provided")
        test
          .expect(fallback)
          .toBe("world")
      })
      .pipe(
        Effect.provide(serverLayer),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("Start.pack keeps routes when BunServer.layerRoutes is provided", () => {
    const appLayer = Start.pack(
      Route.layer(
        Route.map({
          "/hello": Route.get(Route.text("world")),
        }),
      ),
      BunServer.layerRoutes(serveOptions({ port: 0 })),
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

  test.test("routes resolve when server layer requires Route.Routes", () => {
    const appLayer = Route.layer(
      Route.map({
        "/hello": Route.get(Route.text("world")),
      }),
    )

    const serverLayer = BunServer.layerRoutes(serveOptions({ port: 0 }))
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

test.describe("prebuilt htmlBundle", () => {
  const prebuiltBundle: Bun.HTMLBundle = {
    index: `${staticDir}/LayoutSlots.html`,
    files: [
      {
        input: "LayoutSlots.html",
        path: `${staticDir}/LayoutSlots.html`,
        loader: "html",
        isEntry: true,
        headers: {
          etag: "test-etag-html",
          "content-type": "text/html;charset=utf-8",
        },
      },
      {
        input: "test-asset.css",
        path: `${staticDir}/test-asset.css`,
        loader: "css",
        isEntry: true,
        headers: {
          etag: "test-etag-css",
          "content-type": "text/css;charset=utf-8",
        },
      },
    ],
  }

  test.test("serves HTML when loader returns sync prebuilt bundle", () => {
    const routes = Route.map({
      "/": Route.get(
        BunRoute.htmlBundle(() => prebuiltBundle),
        Route.html("<p>Prebuilt Content</p>"),
      ),
    })

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${serverPort(bunServer)}/`))
        const html = yield* Effect.promise(() => response.text())

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(html)
          .toContain("<p>Prebuilt Content</p>")
        test
          .expect(html)
          .not
          .toContain("%children%")
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.runPromise,
      )
  })

  test.test("serves CSS assets at top-level routes", () => {
    const routes = Route.map({
      "/": Route.get(
        BunRoute.htmlBundle(() => prebuiltBundle),
        Route.html("<p>content</p>"),
      ),
    })

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${serverPort(bunServer)}/test-asset.css`))
        const css = yield* Effect.promise(() => response.text())

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(css)
          .toContain("color: red")
        test
          .expect(response.headers.get("content-type"))
          .toBe(
            "text/css;charset=utf-8",
          )
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.runPromise,
      )
  })

  test.test("serves prebuilt HTML with correct content-type", () => {
    const routes = Route.map({
      "/": Route.get(
        BunRoute.htmlBundle(() => prebuiltBundle),
        Route.html("<p>typed</p>"),
      ),
    })

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${serverPort(bunServer)}/`))

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(response.headers.get("content-type"))
          .toContain("text/html")
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.runPromise,
      )
  })

  test.test("keeps native HTML routes when the WebSocket fallback is installed", () => {
    const routes = Route.map({
      "/": Route.get(
        BunRoute.htmlBundle(() => prebuiltBundle),
        Route.html("<p>native-with-websocket</p>"),
      ),
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* write("connected")
      })),
    })

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const base = `http://localhost:${serverPort(bunServer)}`
        const response = yield* Effect.promise(() => fetch(`${base}/`))

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(yield* Effect.promise(() => response.text()))
          .toContain("native-with-websocket")

        const message = yield* Effect.callback<string>((resume) => {
          const socket = new WebSocket(`${base.replace(/^http/, "ws")}/ws`)
          socket.addEventListener("message", (event) => {
            socket.close()
            resume(Effect.succeed(String(event.data)))
          }, { once: true })
          socket.addEventListener("error", (cause) => resume(Effect.die(cause)), { once: true })
          return Effect.sync(() => socket.close())
        })

        test
          .expect(message)
          .toBe("connected")
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })
})

test.describe("prebuilt htmlBundle rewrites relative asset paths", () => {
  let tmpDir: string
  let bundle: Bun.HTMLBundle

  test.beforeAll(async () => {
    tmpDir = NFs.mkdtempSync(NPath.join(NOs.tmpdir(), "effect-start-test-"))
    const srcDir = NPath.join(tmpDir, "src")
    const outDir = NPath.join(tmpDir, "out")
    NFs.mkdirSync(srcDir)

    NFs.writeFileSync(
      NPath.join(srcDir, "index.html"),
      `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="./style.css">
  </head>
  <body>%children%</body>
</html>`,
    )
    NFs.writeFileSync(NPath.join(srcDir, "style.css"), "body { color: blue; }")
    NFs.writeFileSync(
      NPath.join(srcDir, "server.ts"),
      `import html from "./index.html"\nexport default html`,
    )

    const result = await Bun.build({
      entrypoints: [NPath.join(srcDir, "server.ts")],
      outdir: outDir,
      target: "bun",
    })
    if (!result.success) throw new Error("Bun.build failed")

    const mod = await import(NPath.join(outDir, "server.js"))
    const raw = mod.default as Bun.HTMLBundle

    // Bun.build produces relative paths (e.g. ./index.html, ./chunk-xxx.css).
    // registerPrebuiltBundle resolves them against Bun.main, which in tests is
    // the test runner — not the output directory. Resolve them to absolute paths.
    bundle = {
      index: NPath.resolve(outDir, raw.index),
      files: raw.files!.map((f) => ({
        ...f,
        path: NPath.resolve(outDir, f.path),
      })),
    }
  })

  test.afterAll(() => {
    NFs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test.test("rewrites relative paths to absolute in HTML served at nested route", () => {
    const routes = Route.map({
      "/notes/:id": Route.get(
        BunRoute.htmlBundle(() => bundle),
        Route.html("<p>note content</p>"),
      ),
    })

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${serverPort(bunServer)}/notes/hello`))
        const html = yield* Effect.promise(() => response.text())

        test
          .expect(html)
          .not
          .toContain("href=\"./")
        test
          .expect(html)
          .not
          .toContain("src=\"./")

        const cssFile = bundle.files!.find((f) => f.loader === "css")!
        const cssBasename = NPath.basename(cssFile.path)

        test
          .expect(html)
          .toContain(`href="/${cssBasename}"`)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.runPromise,
      )
  })

  test.test("CSS asset is accessible at top-level path", () => {
    const routes = Route.map({
      "/notes/:id": Route.get(
        BunRoute.htmlBundle(() => bundle),
        Route.html("<p>note content</p>"),
      ),
    })

    const cssFile = bundle.files!.find((f) => f.loader === "css")!
    const cssBasename = NPath.basename(cssFile.path)

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${serverPort(bunServer)}/${cssBasename}`))

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(response.headers.get("content-type"))
          .toBe(
            "text/css;charset=utf-8",
          )
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.runPromise,
      )
  })
})

test.describe("prebuilt htmlBundle with images", () => {
  let tmpDir: string
  let outDir: string
  let bundle: Bun.HTMLBundle

  test.beforeAll(async () => {
    tmpDir = NFs.mkdtempSync(NPath.join(NOs.tmpdir(), "effect-start-img-test-"))
    const srcDir = NPath.join(tmpDir, "src")
    outDir = NPath.join(tmpDir, "out")

    await Bun.write(
      NPath.join(srcDir, "pixel.gif"),
      Bun.file(NPath.join(staticDir, "pixel.gif")),
    )
    await Bun.write(
      NPath.join(srcDir, "icon.svg"),
      Bun.file(NPath.join(staticDir, "icon.svg")),
    )

    await Bun.write(
      NPath.join(srcDir, "index.html"),
      `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="./style.css">
  </head>
  <body>
    <img src="./pixel.gif" alt="Pixel">
    <img src="./icon.svg" alt="Icon">
    %children%
  </body>
</html>`,
    )
    await Bun.write(NPath.join(srcDir, "style.css"), "body { margin: 0; }")
    await Bun.write(
      NPath.join(srcDir, "server.ts"),
      `import html from "./index.html"\nexport default html`,
    )

    const result = await Bun.build({
      entrypoints: [NPath.join(srcDir, "server.ts")],
      outdir: outDir,
      target: "bun",
    })
    if (!result.success) throw new Error("Bun.build failed")

    const mod = await import(NPath.join(outDir, "server.js"))
    const raw = mod.default as Bun.HTMLBundle

    bundle = {
      index: NPath.resolve(outDir, raw.index),
      files: raw.files!.map((f) => ({
        ...f,
        path: NPath.resolve(outDir, f.path),
      })),
    }
  })

  test.afterAll(async () => {
    await Bun.$`rm -rf ${tmpDir}`.quiet()
  })

  function findOutputFile(name: string): string {
    const stem = name.replace(/\.[^.]+$/, "")
    const files = [
      ...new Bun.Glob("*").scanSync({ cwd: outDir, onlyFiles: true }),
    ]
    const match = files.find((f) => f.startsWith(stem) && !f.endsWith(".js"))
    if (!match) throw new Error(`No output file found for ${name}`)
    return match
  }

  test.test("rewrites img src to absolute paths", () => {
    const routes = Route.map({
      "/bio": Route.get(
        BunRoute.htmlBundle(() => bundle),
        Route.html("<p>bio</p>"),
      ),
    })

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${serverPort(bunServer)}/bio`))
        const html = yield* Effect.promise(() => response.text())

        test
          .expect(html)
          .not
          .toContain("src=\"./")
        test
          .expect(html)
          .not
          .toContain("src=\"../")

        const gifFile = findOutputFile("pixel.gif")

        test
          .expect(html)
          .toContain(`src="/${gifFile}"`)

        const svgFile = findOutputFile("icon.svg")

        test
          .expect(html)
          .toContain(`src="/${svgFile}"`)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.runPromise,
      )
  })

  test.test("rewrites img src at deeply nested route", () => {
    const routes = Route.map({
      "/users/:id/profile": Route.get(
        BunRoute.htmlBundle(() => bundle),
        Route.html("<p>profile</p>"),
      ),
    })

    return Effect
      .gen(function*() {
        const bunServer = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() =>
          fetch(`http://localhost:${serverPort(bunServer)}/users/42/profile`)
        )
        const html = yield* Effect.promise(() => response.text())

        const gifFile = findOutputFile("pixel.gif")

        test
          .expect(html)
          .toContain(`src="/${gifFile}"`)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.runPromise,
      )
  })

  test.test("bundler emits images into bundle.files", () => {
    const gifFile = findOutputFile("pixel.gif")
    const svgFile = findOutputFile("icon.svg")
    const bundledPaths = (bundle.files ?? []).map((f) => NPath.basename(f.path))

    test
      .expect(bundledPaths)
      .toContain(gifFile)
    test
      .expect(bundledPaths)
      .toContain(svgFile)
  })
})

test.describe("static file routes", () => {
  test.test("serves static files with correct content-type via Bun.file", () => {
    const gifPath = NPath.join(staticDir, "pixel.gif")
    const svgPath = NPath.join(staticDir, "icon.svg")

    return Effect
      .gen(function*() {
        const bunServer = yield* BunServer.make({
          port: 0,
          routes: {
            "/pixel.gif": Bun.file(gifPath),
            "/icon.svg": Bun.file(svgPath),
          },
        })

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

  test.test("HEAD request returns headers without body for Bun.file routes", () => {
    const gifPath = NPath.join(staticDir, "pixel.gif")

    return Effect
      .gen(function*() {
        const bunServer = yield* BunServer.make({
          port: 0,
          routes: {
            "/pixel.gif": Bun.file(gifPath),
          },
        })

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
