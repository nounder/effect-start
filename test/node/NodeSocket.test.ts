import * as test from "bun:test"
import { BunSocket } from "effect-start/bun"
import * as FileSystem from "effect-start/FileSystem"
import { NodeFileSystem, NodeSocket } from "effect-start/node"
import * as Socket from "effect-start/Socket"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Queue from "effect/Queue"
import * as NNet from "node:net"

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const tcpEchoServer = Effect.acquireRelease(
  Effect.async<NNet.Server, Error>((resume) => {
    const server = NNet.createServer((socket) => {
      socket.on("data", (chunk) => {
        socket.write(chunk)
      })
    })
    const onError = (cause: Error) => {
      resume(Effect.fail(cause))
    }
    server.once("error", onError)
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError)
      resume(Effect.succeed(server))
    })
  }),
  (server) =>
    Effect.async<void>((resume) => {
      server.close(() => {
        resume(Effect.void)
      })
    }),
)

const bunWsEchoServer = Effect.acquireRelease(
  Effect.sync(() =>
    Bun.serve({
      port: 0,
      fetch(request, server) {
        if (server.upgrade(request)) return undefined as any
        return new Response("not a websocket", { status: 426 })
      },
      websocket: {
        message(ws, message) {
          ws.send(message)
        },
      },
    })
  ),
  (server) => Effect.sync(() => server.stop(true)),
)

const unixEchoServer = (socketPath: string) =>
  Effect.acquireRelease(
    Effect.async<NNet.Server, Error>((resume) => {
      const server = NNet.createServer((socket) => {
        socket.on("data", (chunk) => {
          socket.write(chunk)
        })
      })
      const onError = (cause: Error) => {
        resume(Effect.fail(cause))
      }
      server.once("error", onError)
      server.listen(socketPath, () => {
        server.off("error", onError)
        resume(Effect.succeed(server))
      })
    }),
    (server) =>
      Effect.async<void>((resume) => {
        server.close(() => {
          resume(Effect.void)
        })
      }),
  )

const unixSocketPath = (prefix: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped({ prefix })
    return `${directory}/socket.sock`
  })

const tcpPort = (server: NNet.Server) => {
  const address = server.address()
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected TCP server address")
  }
  return address.port
}

test.describe("NodeSocket", () => {
  test.it("round-trips TCP data", () =>
    Effect
      .gen(function*() {
        const server = yield* tcpEchoServer
        const socket = yield* NodeSocket.makeNet({
          host: "127.0.0.1",
          port: tcpPort(server),
          openTimeout: 1000,
        })
        const messages = yield* Queue.unbounded<Uint8Array>()
        const fiber = yield* Effect.fork(socket.run((data) => Queue.offer(messages, data)))
        const write = yield* socket.writer

        yield* write(encoder.encode("ping"))

        const received = yield* Queue.take(messages)

        test
          .expect(decoder.decode(received))
          .toBe("ping")

        yield* Fiber.interrupt(fiber)
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.it("round-trips Unix socket data", () =>
    Effect
      .gen(function*() {
        const socketPath = yield* unixSocketPath("effect-start-node-socket-")
        yield* unixEchoServer(socketPath)
        const socket = yield* NodeSocket.makeNet({
          path: socketPath,
          openTimeout: 1000,
        })
        const messages = yield* Queue.unbounded<Uint8Array>()
        const fiber = yield* Effect.fork(socket.run((data) => Queue.offer(messages, data)))
        const write = yield* socket.writer

        yield* write(encoder.encode("unix-ping"))

        const received = yield* Queue.take(messages)

        test
          .expect(decoder.decode(received))
          .toBe("unix-ping")

        yield* Fiber.interrupt(fiber)
      })
      .pipe(
        Effect.scoped,
        Effect.provide(NodeFileSystem.layer),
        Effect.runPromise,
      ))
})

test.describe("BunSocket", () => {
  test.it("round-trips TCP data through the Node socket adapter", () =>
    Effect
      .gen(function*() {
        const server = yield* tcpEchoServer
        const socket = yield* BunSocket.makeNet({
          host: "127.0.0.1",
          port: tcpPort(server),
          openTimeout: 1000,
        })
        const messages = yield* Queue.unbounded<Uint8Array>()
        const fiber = yield* Effect.fork(socket.run((data) => Queue.offer(messages, data)))
        const write = yield* socket.writer

        yield* write(encoder.encode("bun-node-ping"))

        const received = yield* Queue.take(messages)

        test
          .expect(decoder.decode(received))
          .toBe("bun-node-ping")

        yield* Fiber.interrupt(fiber)
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.it("round-trips Unix socket data through the Node socket adapter", () =>
    Effect
      .gen(function*() {
        const socketPath = yield* unixSocketPath("effect-start-bun-socket-")
        yield* unixEchoServer(socketPath)
        const socket = yield* BunSocket.makeNet({
          path: socketPath,
          openTimeout: 1000,
        })
        const messages = yield* Queue.unbounded<Uint8Array>()
        const fiber = yield* Effect.fork(socket.run((data) => Queue.offer(messages, data)))
        const write = yield* socket.writer

        yield* write(encoder.encode("bun-unix-ping"))

        const received = yield* Queue.take(messages)

        test
          .expect(decoder.decode(received))
          .toBe("bun-unix-ping")

        yield* Fiber.interrupt(fiber)
      })
      .pipe(
        Effect.scoped,
        Effect.provide(NodeFileSystem.layer),
        Effect.runPromise,
      ))
})

test.describe("Socket", () => {
  test.it("provides a global websocket Socket layer", () =>
    Effect
      .gen(function*() {
        const server = yield* bunWsEchoServer
        const socket = yield* Effect.provide(
          Socket.Socket,
          Socket.layerWebSocketGlobal(`ws://127.0.0.1:${server.port}`, {
            closeCodeIsError: () => false,
          }),
        )
        const messages = yield* Queue.unbounded<string>()
        const fiber = yield* Effect.fork(socket.runString((data) => Queue.offer(messages, data)))
        const write = yield* socket.writer

        yield* write("hello")

        const received = yield* Queue.take(messages)

        test
          .expect(received)
          .toBe("hello")

        yield* Fiber.interrupt(fiber)
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))
})
