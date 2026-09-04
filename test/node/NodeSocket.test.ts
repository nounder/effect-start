import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as FileSystem from "effect/FileSystem"
import * as Queue from "effect/Queue"
import type * as Socket from "effect/unstable/socket/Socket"
import * as NNet from "node:net"
import * as NodeFileSystem from "effect-start/node/NodeFileSystem"
import * as NodeSocket from "effect-start/node/NodeSocket"

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const echoServer = (options: NNet.ListenOptions) =>
  Effect.acquireRelease(
    Effect.callback<NNet.Server, Error>((resume) => {
      const server = NNet.createServer((socket) => {
        socket.on("data", (chunk) => socket.write(chunk))
      })
      const onError = (cause: Error) => resume(Effect.fail(cause))
      server.once("error", onError)
      server.listen(options, () => {
        server.off("error", onError)
        resume(Effect.succeed(server))
      })
    }),
    (server) =>
      Effect.callback<void>((resume) => {
        server.close(() => resume(Effect.void))
      }),
  )

const port = (server: NNet.Server) => {
  const address = server.address()
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected TCP server address")
  }
  return address.port
}

const roundTrip = (socket: Socket.Socket, message: string) =>
  Effect.gen(function*() {
    const messages = yield* Queue.unbounded<Uint8Array>()
    const fiber = yield* Effect.forkChild(socket.run((data) => Queue.offer(messages, data)))
    const write = yield* socket.writer
    yield* write(encoder.encode(message))
    const received = yield* Queue.take(messages)
    yield* Fiber.interrupt(fiber)
    return decoder.decode(received)
  })

test.describe("NodeSocket", () => {
  test.it("round-trips TCP data", () =>
    Effect
      .gen(function*() {
        const server = yield* echoServer({ host: "127.0.0.1", port: 0 })
        const socket = yield* NodeSocket.makeNet({
          host: "127.0.0.1",
          port: port(server),
          openTimeout: 1_000,
        })

        test
          .expect(yield* roundTrip(socket, "tcp"))
          .toBe("tcp")
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.it("round-trips Unix socket data", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "effect-start-node-socket-" })
        const path = directory + "/socket.sock"
        yield* echoServer({ path })
        const socket = yield* NodeSocket.makeNet({
          path,
          openTimeout: 1_000,
        })

        test
          .expect(yield* roundTrip(socket, "unix"))
          .toBe("unix")
      })
      .pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.scoped,
        Effect.runPromise,
      ))
})
