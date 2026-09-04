import * as test from "bun:test"
import { BunServer } from "effect-start/bun"
import * as Fetch from "effect-start/Fetch"
import * as Route from "effect-start/Route"
import { TestLogger } from "effect-start/testing"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as HttpServer from "effect/unstable/http/HttpServer"
import * as Socket from "effect/unstable/socket/Socket"
import type * as RouteMap from "effect-start/internal/RouteMap"

const testLayer = <const Input extends RouteMap.RouteMapInput>(routes: Input) =>
  BunServer
    .layerRoutes({
      hostname: "localhost",
      port: 0,
      gracefulShutdownTimeout: "100 millis",
    })
    .pipe(Layer.provide(Route.layer(routes)))

const loggingTestLayer = <const Input extends RouteMap.RouteMapInput>(routes: Input) =>
  testLayer(routes).pipe(Layer.provideMerge(TestLogger.layer()))

const messages = new WeakMap<WebSocket, Array<string | ArrayBuffer>>()
const messageWaiters = new WeakMap<WebSocket, (data: string | ArrayBuffer) => void>()
const closes = new WeakMap<WebSocket, CloseEvent>()
const closeWaiters = new WeakMap<WebSocket, (event: CloseEvent) => void>()

const connect = (url: string) =>
  Effect.callback<WebSocket>((resume) => {
    const ws = new WebSocket(url)
    ws.binaryType = "arraybuffer"
    messages.set(ws, [])
    ws.addEventListener("message", (event) => {
      const waiter = messageWaiters.get(ws)
      if (waiter !== undefined) {
        messageWaiters.delete(ws)
        waiter(event.data)
      } else {
        messages.get(ws)!.push(event.data)
      }
    })
    ws.addEventListener("close", (event) => {
      const waiter = closeWaiters.get(ws)
      if (waiter !== undefined) {
        closeWaiters.delete(ws)
        waiter(event)
      } else {
        closes.set(ws, event)
      }
    })
    ws.addEventListener("open", () => resume(Effect.succeed(ws)), { once: true })
    ws.addEventListener("error", () => resume(Effect.die("ws error")), {
      once: true,
    })
  })

const nextMessage = (ws: WebSocket) =>
  Effect.callback<string | ArrayBuffer>((resume) => {
    const buffered = messages.get(ws)?.shift()
    if (buffered !== undefined) {
      resume(Effect.succeed(buffered))
    } else {
      messageWaiters.set(ws, (data) => resume(Effect.succeed(data)))
    }
  })

const nextClose = (ws: WebSocket) =>
  Effect.callback<CloseEvent>((resume) => {
    const buffered = closes.get(ws)
    if (buffered !== undefined) {
      closes.delete(ws)
      resume(Effect.succeed(buffered))
    } else {
      closeWaiters.set(ws, (event) => resume(Effect.succeed(event)))
    }
  })

const httpUrl = (server: { readonly address: HttpServer.Address }) => HttpServer.formatAddress(server.address)

const wsUrl = (server: { readonly address: HttpServer.Address }) => httpUrl(server).replace(/^http/, "ws")

const runPromise = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.runPromise(effect as Effect.Effect<A, E>)

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
        const server = yield* HttpServer.HttpServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hello")
        const echoed = yield* nextMessage(ws)

        test
          .expect(echoed)
          .toBe("hello")

        ws.close()
        yield* nextClose(ws)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        runPromise,
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
        const server = yield* HttpServer.HttpServer
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
        yield* nextClose(ws)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        runPromise,
      )
  })

  test.test("coexists with a plain GET on the same path", () => {
    const routes = Route.map({
      "/dual": Route.get(
        Route.text("hi"),
        Route.ws(function*(ctx) {
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data))
        }),
      ),
    })

    return Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const base = httpUrl(server)

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
        yield* nextClose(ws)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        runPromise,
      )
  })

  test.test("negotiates content for plain GETs and upgrades the socket on the same path", () => {
    const routes = Route.map({
      "/feed": Route.get(
        Route.html("<h1>feed</h1>"),
        Route.text("plain feed"),
        Route.ws(function*(ctx) {
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data))
        }),
      ),
    })

    return Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const base = httpUrl(server)

        // No upgrade, Accept prefers html → the html route wins negotiation.
        const htmlResponse = yield* Fetch.get(`${base}/feed`, {
          headers: { accept: "text/html" },
        })

        test
          .expect(htmlResponse.status)
          .toBe(200)
        test
          .expect(htmlResponse.headers["content-type"])
          .toBe("text/html; charset=utf-8")
        test
          .expect(yield* htmlResponse.text)
          .toBe("<h1>feed</h1>")

        // No upgrade, Accept prefers plain text → the text route wins.
        const textResponse = yield* Fetch.get(`${base}/feed`, {
          headers: { accept: "text/plain" },
        })

        test
          .expect(textResponse.status)
          .toBe(200)
        test
          .expect(textResponse.headers["content-type"])
          .toBe("text/plain; charset=utf-8")
        test
          .expect(yield* textResponse.text)
          .toBe("plain feed")

        // Upgrade request on the same path → the socket route handles it.
        const ws = yield* connect(`${wsUrl(server)}/feed`)
        ws.send("ping")
        const echoed = yield* nextMessage(ws)

        test
          .expect(echoed)
          .toBe("ping")

        ws.close()
        yield* nextClose(ws)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        runPromise,
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
        const server = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() => fetch(`${httpUrl(server)}/ws`))

        test
          .expect(response.status)
          .toBe(426)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        runPromise,
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
        const server = yield* HttpServer.HttpServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("immediately")
        const echoed = yield* nextMessage(ws)

        test
          .expect(echoed)
          .toBe("immediately")

        ws.close()
        yield* nextClose(ws)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        runPromise,
      )
  })

  test.test("does not configure websockets without a socket route", () => {
    const routes = Route.map({
      "/": Route.get(Route.text("plain")),
    })

    return Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const base = httpUrl(server)

        const response = yield* Effect.promise(() => fetch(`${base}/`))
        const body = yield* Effect.promise(() => response.text())

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(body)
          .toBe("plain")

        const closed = yield* Effect.callback<CloseEvent>((resume) => {
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
        runPromise,
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
        const server = yield* HttpServer.HttpServer
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
        runPromise,
      )
  })

  test.test("abnormal close surfaces a SocketCloseError to the handler", () => {
    let observed: Socket.SocketError | "completed" | undefined

    const routes = Route.map({
      "/ws": Route.get(
        Route.ws(function*(ctx) {
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data)).pipe(
            Effect.catch((error) =>
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
        const server = yield* HttpServer.HttpServer
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
        runPromise,
      )
  })

  test.test("does not log an error when the client disconnects with a normal code", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data))
      })),
    })

    return Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hello")
        yield* nextMessage(ws)
        // 1001 "Going Away" is a normal browser/tab-close disconnect, not an
        // application error — it must not be logged.
        ws.close(1001, "going away")
        yield* nextClose(ws)
        yield* Effect.sleep("100 millis")

        const messages = yield* TestLogger.messages

        test
          .expect(messages)
          .toEqual([])
      })
      .pipe(
        Effect.provide(loggingTestLayer(routes)),
        Effect.scoped,
        runPromise,
      )
  })

  test.test("logs an unclean server-initiated close", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw(() => write(new Socket.CloseEvent(4001, "bye")))
      })),
    })

    return Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("trigger")
        yield* nextClose(ws)
        yield* Effect.sleep("100 millis")

        const messages = yield* TestLogger.messages

        test
          .expect(messages.some((message) => message.includes("SocketError: 4001: bye")))
          .toBe(true)
      })
      .pipe(
        Effect.provide(loggingTestLayer(routes)),
        Effect.scoped,
        runPromise,
      )
  })

  test.test("closes the socket with 1000 when the handler requests a clean close", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* write(new Socket.CloseEvent(1000))
      })),
    })

    return Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        const closeEvent = yield* nextClose(ws)

        test
          .expect(closeEvent.code)
          .toBe(1000)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        runPromise,
      )
  })

  test.test("closes the socket with 1011 when the handler fails", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) =>
          Effect.gen(function*() {
            yield* write(data)
            yield* Effect.fail(new Error("boom"))
          })
        )
      })),
    })

    return Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hi")
        const closeEvent = yield* nextClose(ws)

        // A failed handler tears the connection down with Internal Error rather
        // than leaving it half-open.
        test
          .expect(closeEvent.code)
          .toBe(1011)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        runPromise,
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
        const server = yield* HttpServer.HttpServer
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
        runPromise,
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
        const server = yield* HttpServer.HttpServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        const first = yield* nextMessage(ws)

        test
          .expect(first)
          .toBe("welcome")

        ws.close()
        yield* nextClose(ws)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        runPromise,
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
        const server = yield* HttpServer.HttpServer
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
        yield* Effect.all([nextClose(a), nextClose(b)])
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        runPromise,
      )
  })

  test.test("returns 426 for an upgrade request to a path with no socket route", () => {
    const routes = Route.map({
      "/plain": Route.get(Route.text("hi")),
    })

    return Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() =>
          fetch(`${httpUrl(server)}/plain`, {
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
        runPromise,
      )
  })

  test.test("upgrades under a wildcard html layout layer", () => {
    const routes = Route.map({
      "/ws": Route
        .use(
          Route.html(function*(_ctx, next) {
            return yield* next.html
          }),
        )
        .get(Route.ws(function*(ctx) {
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data))
        })),
    })

    return Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hello")
        const echoed = yield* nextMessage(ws)

        test
          .expect(echoed)
          .toBe("hello")

        ws.close()
        yield* nextClose(ws)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        runPromise,
      )
  })

  test.test("runs wildcard middleware on the upgrade chain", () => {
    let middlewareRan = false
    const routes = Route.map({
      "/ws": Route
        .use(
          Route.handle((_ctx, next) =>
            Effect.gen(function*() {
              middlewareRan = true
              return yield* next
            })
          ),
        )
        .get(Route.ws(function*(ctx) {
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data))
        })),
    })

    return Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
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
        yield* nextClose(ws)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        runPromise,
      )
  })

  test.test("an upgrade to a path with only non-socket routes still returns 426", () => {
    const routes = Route.map({
      "/page": Route
        .use(
          Route.handle((_ctx, next) => next),
        )
        .get(Route.text("hello")),
    })

    return Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const response = yield* Effect.promise(() =>
          fetch(`${httpUrl(server)}/page`, {
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
        runPromise,
      )
  })
})

test.describe("Route.ws scope lifecycle", () => {
  test.test("handler runs inside an open scope", () =>
    Effect
      .gen(function*() {
        const observed = yield* Deferred.make<boolean>()

        const routes = Route.map({
          "/ws": Route.get(Route.ws(function*(ctx) {
            const scope = yield* Effect.scope
            yield* Deferred.succeed(
              observed,
              scope.state._tag !== "Closed",
            )
            const write = yield* ctx.socket.writer
            yield* ctx.socket.runRaw((data) => write(data))
          })),
        })

        return yield* Effect
          .gen(function*() {
            const server = yield* HttpServer.HttpServer
            const ws = yield* connect(`${wsUrl(server)}/ws`)

            test
              .expect(yield* Deferred.await(observed))
              .toBe(true)

            ws.close()
            yield* nextClose(ws)
          })
          .pipe(
            Effect.provide(testLayer(routes)),
            Effect.scoped,
          )
      })
      .pipe(
        Effect.scoped,
        runPromise,
      ))

  test.test("finalizer runs when the client closes cleanly", () =>
    Effect
      .gen(function*() {
        const released = yield* Deferred.make<void>()

        const routes = Route.map({
          "/ws": Route.get(Route.ws(function*(ctx) {
            yield* Effect.addFinalizer(() => Deferred.succeed(released, undefined))
            const write = yield* ctx.socket.writer
            yield* ctx.socket.runRaw((data) => write(data))
          })),
        })

        return yield* Effect
          .gen(function*() {
            const server = yield* HttpServer.HttpServer
            const ws = yield* connect(`${wsUrl(server)}/ws`)
            ws.send("hello")
            yield* nextMessage(ws)

            test
              .expect(yield* Deferred.isDone(released))
              .toBe(false)

            ws.close(1000)
            yield* Deferred.await(released)
          })
          .pipe(
            Effect.provide(testLayer(routes)),
            Effect.scoped,
          )
      })
      .pipe(
        Effect.scoped,
        runPromise,
      ))

  test.test("finalizer runs when the client closes abnormally", () =>
    Effect
      .gen(function*() {
        const released = yield* Deferred.make<void>()

        const routes = Route.map({
          "/ws": Route.get(Route.ws(function*(ctx) {
            yield* Effect.addFinalizer(() => Deferred.succeed(released, undefined))
            const write = yield* ctx.socket.writer
            yield* ctx.socket.runRaw((data) => write(data)).pipe(
              Effect.catch(() => Effect.void),
            )
          })),
        })

        return yield* Effect
          .gen(function*() {
            const server = yield* HttpServer.HttpServer
            const ws = yield* connect(`${wsUrl(server)}/ws`)
            ws.send("hello")
            yield* nextMessage(ws)
            ws.close(1011, "boom")
            yield* Deferred.await(released)
          })
          .pipe(
            Effect.provide(testLayer(routes)),
            Effect.scoped,
          )
      })
      .pipe(
        Effect.scoped,
        runPromise,
      ))

  test.test("acquireRelease resource is released after close", () =>
    Effect
      .gen(function*() {
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

        return yield* Effect
          .gen(function*() {
            const server = yield* HttpServer.HttpServer
            const ws = yield* connect(`${wsUrl(server)}/ws`)
            yield* Deferred.await(acquired)

            test
              .expect(yield* Deferred.isDone(released))
              .toBe(false)

            ws.close(1000)
            yield* Deferred.await(released)
          })
          .pipe(
            Effect.provide(testLayer(routes)),
            Effect.scoped,
          )
      })
      .pipe(
        Effect.scoped,
        runPromise,
      ))

  test.test("scope stays open across multiple frames", () =>
    Effect
      .gen(function*() {
        const released = yield* Deferred.make<void>()

        const routes = Route.map({
          "/ws": Route.get(Route.ws(function*(ctx) {
            yield* Effect.addFinalizer(() => Deferred.succeed(released, undefined))
            const write = yield* ctx.socket.writer
            yield* ctx.socket.runRaw((data) => write(data))
          })),
        })

        return yield* Effect
          .gen(function*() {
            const server = yield* HttpServer.HttpServer
            const ws = yield* connect(`${wsUrl(server)}/ws`)

            ws.send("one")

            test
              .expect(yield* nextMessage(ws))
              .toBe("one")

            ws.send("two")

            test
              .expect(yield* nextMessage(ws))
              .toBe("two")

            test
              .expect(yield* Deferred.isDone(released))
              .toBe(false)

            ws.close(1000)
            yield* Deferred.await(released)
          })
          .pipe(
            Effect.provide(testLayer(routes)),
            Effect.scoped,
          )
      })
      .pipe(
        Effect.scoped,
        runPromise,
      ))

  test.test("finalizer runs when the server scope closes with the socket still open", () =>
    Effect
      .gen(function*() {
        const released = yield* Deferred.make<void>()

        const routes = Route.map({
          "/ws": Route.get(Route.ws(function*(ctx) {
            yield* Effect.addFinalizer(() => Deferred.succeed(released, undefined))
            const write = yield* ctx.socket.writer
            yield* ctx.socket.runRaw((data) => write(data))
          })),
        })

        // Build the server into a scope we close ourselves, simulating shutdown
        // while a connection is live.
        const serverScope = yield* Scope.make()
        const server = yield* Layer.build(testLayer(routes)).pipe(
          Effect.map((context) => Context.get(context, HttpServer.HttpServer)),
          Scope.provide(serverScope),
        )

        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hello")
        yield* nextMessage(ws)

        test
          .expect(yield* Deferred.isDone(released))
          .toBe(false)

        const closeFiber = yield* Effect.forkChild(Scope.close(serverScope, Exit.void))

        yield* Deferred.await(released).pipe(
          Effect.timeout("500 millis"),
        )

        ws.close()
        yield* nextClose(ws)
        yield* Fiber.join(closeFiber)
      })
      .pipe(
        Effect.scoped,
        runPromise,
      ))
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

  test.it("does not leak HttpServer or Scope into the app requirements", () => {
    const layer = Route.layer(
      Route.map({
        "/ws": Route.get(Route.ws(function*(ctx) {
          yield* Effect.addFinalizer(() => Effect.void)
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data))
        })),
      }),
    )

    // HttpServerRequest is provided automatically at handling time;
    // Scope is provided by the scoped runner around the handler. Neither should
    // surface in the layer's requirements.
    test
      .expectTypeOf<Layer.Services<typeof layer>>()
      .toEqualTypeOf<never>()
  })

  test.it("infers the union of error and requirement types from generator yields", () => {
    const rs = Route.get(Route.ws(function*(ctx) {
      const db = yield* Db
      const row = yield* db.query()
      const write = yield* ctx.socket.writer
      // yields with three different error types (none, MyErr, SocketError) and
      // two requirements (Db, Scope) must all be collected, not unified to one.
      yield* write(row)
    }))

    const layer = Route.layer(Route.map({ "/ws": rs }))

    // Db survives as a real requirement; HttpServerRequest and Scope are stripped.
    test
      .expectTypeOf<Layer.Services<typeof layer>>()
      .toEqualTypeOf<Db>()
  })
})

class MyErr extends Data.TaggedError("MyErr")<{}> {}
class Db extends Context.Service<Db, { query: () => Effect.Effect<string, MyErr> }>()("Db") {}
