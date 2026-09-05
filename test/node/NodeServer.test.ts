import * as test from "bun:test"
import { NodeServer } from "effect-start/node"
import * as Route from "effect-start/Route"
import * as Socket from "effect-start/Socket"
import * as Start from "effect-start/Start"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import type * as RouteMap from "../../src/internal/RouteMap.ts"

const portOf = (server: NodeServer.NodeServer): number => {
  const address = server.address
  if (address._tag !== "TcpAddress") throw new Error("expected a TCP address")
  return address.port
}

const testLayer = <const Input extends RouteMap.RouteMapInput>(routes: Input) =>
  NodeServer.layerRoutes({ port: 0 }).pipe(Layer.provide(Route.layer(routes)))

test.describe("NodeServer routes", () => {
  test.test("serves static text route", () => {
    const routes = Route.map({
      "/": Route.get(Route.text("Hello, World!")),
    })

    return Effect
      .gen(function*() {
        const server = yield* NodeServer.NodeServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${portOf(server)}/`))
        const text = yield* Effect.promise(() => response.text())

        test.expect(response.status).toBe(200)
        test.expect(text).toBe("Hello, World!")
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
        const server = yield* NodeServer.NodeServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${portOf(server)}/api/data`))
        const json = yield* Effect.promise(() => response.json())

        test.expect(response.status).toBe(200)
        test.expect(response.headers.get("content-type")).toBe("application/json")
        test.expect(json).toEqual({ message: "success", value: 42 })
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
        const server = yield* NodeServer.NodeServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${portOf(server)}/unknown`))

        test.expect(response.status).toBe(404)
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
        const server = yield* NodeServer.NodeServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${portOf(server)}/users/123`))
        const text = yield* Effect.promise(() => response.text())

        test.expect(response.status).toBe(200)
        test.expect(text).toBe("user")
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
        const server = yield* NodeServer.NodeServer
        const base = `http://localhost:${portOf(server)}`

        const jsonResponse = yield* Effect.promise(() =>
          fetch(`${base}/data`, { headers: { Accept: "application/json" } })
        )
        const jsonBody = yield* Effect.promise(() => jsonResponse.json())

        const htmlResponse = yield* Effect.promise(() => fetch(`${base}/data`, { headers: { Accept: "text/html" } }))
        const htmlBody = yield* Effect.promise(() => htmlResponse.text())

        test.expect(jsonResponse.headers.get("content-type")).toBe("application/json")
        test.expect(jsonBody).toEqual({ type: "json" })
        test.expect(htmlResponse.headers.get("content-type")).toBe("text/html; charset=utf-8")
        test.expect(htmlBody).toBe("<div>html</div>")
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("streams a POST body back", () => {
    const routes = Route.map({
      "/echo": Route.post(
        Route.schemaBodyJson(Schema.Struct({ hello: Schema.String })),
        Route.json((ctx) => Effect.succeed(ctx.body)),
      ),
    })

    return Effect
      .gen(function*() {
        const server = yield* NodeServer.NodeServer
        const response = yield* Effect.promise(() =>
          fetch(`http://localhost:${portOf(server)}/echo`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ hello: "world" }),
          })
        )
        const json = yield* Effect.promise(() => response.json())

        test.expect(response.status).toBe(200)
        test.expect(json).toEqual({ hello: "world" })
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("HEAD request returns headers without a body", () => {
    const routes = Route.map({
      "/": Route.get(Route.text("Hello, World!")),
    })

    return Effect
      .gen(function*() {
        const server = yield* NodeServer.NodeServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${portOf(server)}/`, { method: "HEAD" }))
        const body = yield* Effect.promise(() => response.text())

        test.expect(response.status).toBe(200)
        test.expect(body).toBe("")
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })
})

test.describe("NodeServer.layerStart composition", () => {
  test.test("existing NodeServer is upgraded with routes by layerStart", () => {
    const routeLayer = Route.layer(
      Route.map({
        "/hello": Route.get(Route.text("world")),
      }),
    )

    const appLayer = Start.pack(
      routeLayer,
      NodeServer.layer({ port: 0 }),
    )

    const composed = Layer.provide(
      NodeServer.withLogAddress(NodeServer.layerStart()),
      appLayer,
    )

    return Effect
      .gen(function*() {
        const server = yield* NodeServer.NodeServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${portOf(server)}/hello`))
        const text = yield* Effect.promise(() => response.text())

        test.expect(response.status).toBe(200)
        test.expect(text).toBe("world")
      })
      .pipe(
        Effect.provide(composed),
        Effect.scoped,
        Effect.runPromise,
      )
  })
})

const wsUrl = (server: NodeServer.NodeServer) => `ws://localhost:${portOf(server)}`

const connect = (url: string) =>
  Effect.async<WebSocket>((resume) => {
    const ws = new WebSocket(url)
    ws.binaryType = "arraybuffer"
    ws.addEventListener("open", () => resume(Effect.succeed(ws)), { once: true })
    ws.addEventListener("error", () => resume(Effect.die("ws error")), { once: true })
  })

const nextMessage = (ws: WebSocket) =>
  Effect.async<string | ArrayBuffer>((resume) => {
    ws.addEventListener("message", (event) => resume(Effect.succeed(event.data)), { once: true })
  })

const nextClose = (ws: WebSocket) =>
  Effect.async<CloseEvent>((resume) => {
    ws.addEventListener("close", (event) => resume(Effect.succeed(event)), { once: true })
  })

// Bun's `node:http` upgrade support has known bugs where bytes written to the
// upgrade socket aren't flushed to the client (oven-sh/bun#32195), so these
// tests hang under `bun test` even though the implementation is correct.
// Verified manually against real Node.js — see scripts in the PR description.
const skipUnderBun = typeof process.versions.bun === "string"

test.describe("NodeServer Route.ws", () => {
  test.test.skipIf(skipUnderBun)("echoes text frames", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data))
      })),
    })

    return Effect
      .gen(function*() {
        const server = yield* NodeServer.NodeServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hello")
        const echoed = yield* nextMessage(ws)

        test.expect(echoed).toBe("hello")

        ws.close()
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test.skipIf(skipUnderBun)("round-trips text and binary frames", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data))
      })),
    })

    return Effect
      .gen(function*() {
        const server = yield* NodeServer.NodeServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)

        ws.send("text-frame")
        const textEchoed = yield* nextMessage(ws)
        test.expect(textEchoed).toBe("text-frame")

        const bytes = new Uint8Array([1, 2, 3, 4])
        ws.send(bytes)
        const binaryEchoed = yield* nextMessage(ws)
        test.expect(new Uint8Array(binaryEchoed as ArrayBuffer)).toEqual(bytes)

        ws.close()
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test.skipIf(skipUnderBun)("isolates context across concurrent connections", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data))
      })),
    })

    return Effect
      .gen(function*() {
        const server = yield* NodeServer.NodeServer
        const a = yield* connect(`${wsUrl(server)}/ws`)
        const b = yield* connect(`${wsUrl(server)}/ws`)

        a.send("from-a")
        b.send("from-b")
        const echoedA = yield* nextMessage(a)
        const echoedB = yield* nextMessage(b)

        test.expect(echoedA).toBe("from-a")
        test.expect(echoedB).toBe("from-b")

        a.close()
        b.close()
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test.skipIf(skipUnderBun)("clean close (1000) completes the handler without error", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data))
      })),
    })

    return Effect
      .gen(function*() {
        const server = yield* NodeServer.NodeServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hello")
        yield* nextMessage(ws)
        ws.close(1000)
        const closeEvent = yield* nextClose(ws)

        test.expect(closeEvent.code).toBe(1000)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test.skipIf(skipUnderBun)("abnormal close surfaces a SocketCloseError to the handler", () => {
    let observed: Socket.SocketError | "completed" | undefined

    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw((data) => write(data)).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => {
              observed = error
            })
          ),
        )
        if (observed === undefined) observed = "completed"
      })),
    })

    return Effect
      .gen(function*() {
        const server = yield* NodeServer.NodeServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("hello")
        yield* nextMessage(ws)
        ws.close(1011, "server error")
        yield* nextClose(ws)
        yield* Effect.sleep("100 millis")

        test.expect(Socket.isSocketError(observed)).toBe(true)
        if (Socket.isSocketError(observed)) {
          test.expect(observed.reason._tag).toBe("SocketCloseError")
        }
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
        const server = yield* NodeServer.NodeServer
        const response = yield* Effect.promise(() => fetch(`http://localhost:${portOf(server)}/ws`))

        test.expect(response.status).toBe(426)
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test.skipIf(skipUnderBun)("server-initiated close delivers the code and reason to the client", () => {
    const routes = Route.map({
      "/ws": Route.get(Route.ws(function*(ctx) {
        const write = yield* ctx.socket.writer
        yield* ctx.socket.runRaw(() => write(new Socket.CloseEvent(4001, "bye")))
      })),
    })

    return Effect
      .gen(function*() {
        const server = yield* NodeServer.NodeServer
        const ws = yield* connect(`${wsUrl(server)}/ws`)
        ws.send("trigger")
        const closeEvent = yield* nextClose(ws)

        test.expect(closeEvent.code).toBe(4001)
        test.expect(closeEvent.reason).toBe("bye")
      })
      .pipe(
        Effect.provide(testLayer(routes)),
        Effect.scoped,
        Effect.runPromise,
      )
  })
})
