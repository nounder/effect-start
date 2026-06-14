import * as test from "bun:test"
import { BunServer } from "effect-start/bun"
import * as Route from "effect-start/Route"
import type * as RouteMap from "effect-start/RouteMap"
import * as Socket from "effect-start/Socket"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"

const testLayer = <const Input extends RouteMap.RouteMapInput>(routes: Input) =>
  BunServer.layerRoutes({ port: 0 }).pipe(Layer.provide(Route.layer(routes)))

const connect = (url: string) =>
  Effect.async<WebSocket>((resume) => {
    const ws = new WebSocket(url)
    ws.binaryType = "arraybuffer"
    ws.addEventListener("open", () => resume(Effect.succeed(ws)), { once: true })
    ws.addEventListener("error", () => resume(Effect.die("ws error")), {
      once: true,
    })
  })

const nextMessage = (ws: WebSocket) =>
  Effect.async<string | ArrayBuffer>((resume) => {
    ws.addEventListener(
      "message",
      (event) => resume(Effect.succeed(event.data)),
      { once: true },
    )
  })

const nextClose = (ws: WebSocket) =>
  Effect.async<CloseEvent>((resume) => {
    ws.addEventListener(
      "close",
      (event) => resume(Effect.succeed(event)),
      { once: true },
    )
  })

const wsUrl = (server: { port: number | undefined }) => `ws://localhost:${server.port}`

test.describe("Route.ws", () => {
  test.test("echoes text frames", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data))
      })),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hello")
        const echoed = yield* nextMessage(ws)

        test
          .expect(echoed)
          .toBe("hello")

        ws.close()
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("round-trips text and binary frames", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data))
      })),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)

        ws.send("text-frame")
        const textEchoed = yield* nextMessage(ws)

        test
          .expect(textEchoed)
          .toBe("text-frame")

        const bytes = new Uint8Array([1, 2, 3, 4])
        ws.send(bytes)
        const binaryEchoed = yield* nextMessage(ws)

        test
          .expect(new Uint8Array(binaryEchoed as ArrayBuffer))
          .toEqual(bytes)

        ws.close()
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("coexists with a plain GET on the same path", () => {
    const routes = Route.map({
      "/dual": Route.get(Route.text("hi")).get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data))
      })),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const base = `http://localhost:${server.port}`

        const response = yield* Effect.promise(() => fetch(`${base}/dual`))
        const body = yield* Effect.promise(() => response.text())

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(body)
          .toBe("hi")

        const ws = yield* connect(`${wsUrl(server)}/dual`)
        ws.send("ping")
        const echoed = yield* nextMessage(ws)

        test
          .expect(echoed)
          .toBe("ping")

        ws.close()
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("returns 426 for a plain GET on a socket-only path", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data))
      })),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${server.port}/ws`))

        test
          .expect(response.status)
          .toBe(426)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("delivers a message buffered before the handler attaches", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data))
      })),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("immediately")
        const echoed = yield* nextMessage(ws)

        test
          .expect(echoed)
          .toBe("immediately")

        ws.close()
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("does not configure websockets without a socket route", () => {
    const routes = Route.map({
      "/": Route.get(Route.text("plain")),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const base = `http://localhost:${server.port}`

        const response = yield* Effect.promise(() => fetch(`${base}/`))
        const body = yield* Effect.promise(() => response.text())

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(body)
          .toBe("plain")

        const closed = yield* Effect.async<CloseEvent>((resume) => {
          const ws = new WebSocket(`${wsUrl(server)}/`)
          ws.addEventListener(
            "close",
            (event) => resume(Effect.succeed(event)),
            { once: true },
          )
          ws.addEventListener("open", () => {
            ws.close()
          }, { once: true })
        })

        test
          .expect(closed.code)
          .not
          .toBe(1000)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("clean close (1000) completes the handler without error", () => {
    const routes = Route.map({
      "/ws": Route.get(
        Route.ws(function*(ctx) {
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data))
        }),
      ),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hello")
        yield* nextMessage(ws)
        ws.close(1000)
        const closeEvent = yield* nextClose(ws)

        test
          .expect(closeEvent.code)
          .toBe(1000)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("abnormal close surfaces a SocketCloseError to the handler", () => {
    let observed: Socket.SocketError | "completed" | undefined

    const routes = Route.map({
      "/ws": Route.get(
        Route.ws(function*(ctx) {
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data)).pipe(
            Effect.catchAll((error) =>
              Effect.sync(() => {
                observed = error
              })
            ),
          )
          if (observed === undefined) {
            observed = "completed"
          }
        }),
      ),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hello")
        yield* nextMessage(ws)
        ws.close(1011, "server error")
        yield* nextClose(ws)
        yield* Effect.sleep("100 millis")

        test
          .expect(Socket.isSocketError(observed))
          .toBe(true)

        if (Socket.isSocketError(observed)) {
          test
            .expect(observed.reason._tag)
            .toBe("SocketCloseError")
        }
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("server-initiated close delivers the code and reason to the client", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw(() => write(new Socket.CloseEvent(4001, "bye")))
      })),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("trigger")
        const closeEvent = yield* nextClose(ws)

        test
          .expect(closeEvent.code)
          .toBe(4001)
        test
          .expect(closeEvent.reason)
          .toBe("bye")
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("runs onOpen before forwarding frames", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data), {
          // onOpen is typed Effect<void> (no error channel), but write can fail
          // with SocketError — orDie to bridge it. See the onOpen ergonomics note.
          onOpen: Effect.orDie(write("welcome")),
        })
      })),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        const first = yield* nextMessage(ws)

        test
          .expect(first)
          .toBe("welcome")

        ws.close()
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("isolates context across concurrent connections", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data))
      })),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const a = yield* connect(`${wsUrl(server)}/ws`)
        const b = yield* connect(`${wsUrl(server)}/ws`)

        a.send("from-a")
        b.send("from-b")
        const echoedA = yield* nextMessage(a)
        const echoedB = yield* nextMessage(b)

        test
          .expect(echoedA)
          .toBe("from-a")
        test
          .expect(echoedB)
          .toBe("from-b")

        a.close()
        b.close()
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("returns 426 for an upgrade request to a path with no socket route", () => {
    const routes = Route.map({
      "/plain": Route.get(Route.text("hi")),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const response = yield* Effect.promise(() =>
          fetch(`http://localhost:${server.port}/plain`, {
            headers: { upgrade: "websocket", connection: "Upgrade" },
          })
        )

        test
          .expect(response.status)
          .toBe(426)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("runs wildcard middleware on the upgrade chain", () => {
    let middlewareRan = false
    const routes = Route.map({
      "/ws": Route.use(
        Route.handle((_ctx, next) =>
          Effect.gen(function*() {
            middlewareRan = true
            return yield* next
          })
        ),
      ).get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data))
      })),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hello")
        const echoed = yield* nextMessage(ws)

        test
          .expect(echoed)
          .toBe("hello")
        test
          .expect(middlewareRan)
          .toBe(true)

        ws.close()
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("an upgrade to a path with only non-socket routes still returns 426", () => {
    const routes = Route.map({
      "/page": Route.use(
        Route.handle((_ctx, next) => next),
      ).get(Route.text("hello")),
    })

    return Effect
      .gen(function*() {
        const { server } = yield* BunServer.BunServer
        const response = yield* Effect.promise(() =>
          fetch(`http://localhost:${server.port}/page`, {
            headers: { upgrade: "websocket", connection: "Upgrade" },
          })
        )

        test
          .expect(response.status)
          .toBe(426)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })
})

test.describe("Route.ws scope lifecycle", () => {
  test.test("handler runs inside an open scope", () =>
    Effect.gen(function*() {
      const observed = yield* Deferred.make<boolean>()

      const routes = Route.map({
        "/ws": Route.get(Route.ws(function*(ctx) {
          const scope = yield* Effect.scope
          yield* Deferred.succeed(
            observed,
            Scope.ScopeTypeId in scope,
          )
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data))
        })),
      })

      return yield* Effect.gen(function*() {
        const { server } = yield* BunServer.BunServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)

        test
          .expect(yield* Deferred.await(observed))
          .toBe(true)

        ws.close()
      }).pipe(Effect.provide(testLayer(routes)), Effect.scoped)
    }).pipe(Effect.scoped, Effect.runPromise))

  test.test("finalizer runs when the client closes cleanly", () =>
    Effect.gen(function*() {
      const released = yield* Deferred.make<void>()

      const routes = Route.map({
        "/ws": Route.get(Route.ws(function*(ctx) {
          yield* Effect.addFinalizer(() => Deferred.succeed(released, undefined))
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data))
        })),
      })

      return yield* Effect.gen(function*() {
        const { server } = yield* BunServer.BunServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hello")
        yield* nextMessage(ws)

        test
          .expect(yield* Deferred.isDone(released))
          .toBe(false)

        ws.close(1000)
        yield* Deferred.await(released)
      }).pipe(Effect.provide(testLayer(routes)), Effect.scoped)
    }).pipe(Effect.scoped, Effect.runPromise))

  test.test("finalizer runs when the client closes abnormally", () =>
    Effect.gen(function*() {
      const released = yield* Deferred.make<void>()

      const routes = Route.map({
        "/ws": Route.get(Route.ws(function*(ctx) {
          yield* Effect.addFinalizer(() => Deferred.succeed(released, undefined))
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data)).pipe(
            Effect.catchAll(() => Effect.void),
          )
        })),
      })

      return yield* Effect.gen(function*() {
        const { server } = yield* BunServer.BunServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hello")
        yield* nextMessage(ws)
        ws.close(1011, "boom")
        yield* Deferred.await(released)
      }).pipe(Effect.provide(testLayer(routes)), Effect.scoped)
    }).pipe(Effect.scoped, Effect.runPromise))

  test.test("acquireRelease resource is released after close", () =>
    Effect.gen(function*() {
      const acquired = yield* Deferred.make<void>()
      const released = yield* Deferred.make<void>()

      const routes = Route.map({
        "/ws": Route.get(Route.ws(function*(ctx) {
          yield* Effect.acquireRelease(
            Deferred.succeed(acquired, undefined),
            () => Deferred.succeed(released, undefined),
          )
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data))
        })),
      })

      return yield* Effect.gen(function*() {
        const { server } = yield* BunServer.BunServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        yield* Deferred.await(acquired)

        test
          .expect(yield* Deferred.isDone(released))
          .toBe(false)

        ws.close(1000)
        yield* Deferred.await(released)
      }).pipe(Effect.provide(testLayer(routes)), Effect.scoped)
    }).pipe(Effect.scoped, Effect.runPromise))

  test.test("scope stays open across multiple frames", () =>
    Effect.gen(function*() {
      const released = yield* Deferred.make<void>()

      const routes = Route.map({
        "/ws": Route.get(Route.ws(function*(ctx) {
          yield* Effect.addFinalizer(() => Deferred.succeed(released, undefined))
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data))
        })),
      })

      return yield* Effect.gen(function*() {
        const { server } = yield* BunServer.BunServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)

        ws.send("one")
        test.expect(yield* nextMessage(ws)).toBe("one")
        ws.send("two")
        test.expect(yield* nextMessage(ws)).toBe("two")

        test
          .expect(yield* Deferred.isDone(released))
          .toBe(false)

        ws.close(1000)
        yield* Deferred.await(released)
      }).pipe(Effect.provide(testLayer(routes)), Effect.scoped)
    }).pipe(Effect.scoped, Effect.runPromise))
})

test.describe("Route.ws types", () => {
  test.it("exposes protocol and socket on the handler context", () => {
    Route.get(Route.ws((ctx) => {
      test
        .expectTypeOf(ctx)
        .toExtend<{
          protocol: "ws"
          socket: Socket.Socket
        }>()

      return Effect.void
    }))
  })

  test.it("does not leak BunServer or Scope into the app requirements", () => {
    const layer = Route.layer(
      Route.map({
        "/ws": Route.get(Route.ws(function*(ctx) {
          yield* Effect.addFinalizer(() => Effect.void)
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data))
        })),
      }),
    )

    // BunServer is an IntrinsicService provided automatically at handling time;
    // Scope is provided by the scoped runner around the handler. Neither should
    // surface in the layer's requirements.
    test
      .expectTypeOf<Layer.Layer.Context<typeof layer>>()
      .toEqualTypeOf<never>()
  })
})
