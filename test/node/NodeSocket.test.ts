import * as test from "bun:test"
import * as NodeFileSystem from "effect-start/node/NodeFileSystem"
import * as NodeSocket from "effect-start/node/NodeSocket"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as FileSystem from "effect/FileSystem"
import * as Result from "effect/Result"
import * as Scope from "effect/Scope"
import * as Socket from "effect/socket/Socket"
import * as NNet from "node:net"
import * as NStream from "node:stream"

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
    const pull = yield* Socket.readerBytes(socket)
    const write = yield* socket.writer
    yield* write.write(encoder.encode(message))
    const received = yield* pull
    return received.map((chunk) => decoder.decode(chunk)).join("")
  })

test.describe("NodeSocket", () => {
  test.it("writes mixed text and binary batches", () =>
    Effect
      .gen(function*() {
        const server = yield* echoServer({ host: "127.0.0.1", port: 0 })
        const socket = yield* NodeSocket.makeNet({ host: "127.0.0.1", port: port(server) })
        const pull = yield* Socket.readerBytes(socket)
        const writer = yield* socket.writer
        yield* writer.writeAll(["one", encoder.encode("-"), "two"])
        let received = ""
        while (received.length < 7) {
          const chunks = yield* pull
          received += chunks.map((chunk) => decoder.decode(chunk)).join("")
        }

        test
          .expect(received)
          .toBe("one-two")
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.it("fails a suspended pull when the reader scope closes", () =>
    Effect
      .gen(function*() {
        const stream = yield* Effect.acquireRelease(
          Effect.sync(() => new NStream.PassThrough()),
          (stream) =>
            Effect.sync(() => {
              stream.destroy()
            }),
        )
        const socket = yield* NodeSocket.fromDuplex(Effect.succeed(stream))
        const readerScope = yield* Scope.fork(yield* Effect.scope)
        const reader = yield* Scope.provide(socket.reader, readerScope)
        const pending = yield* Effect.forkChild(Effect.result(reader.pull))
        yield* Effect.yieldNow
        yield* Scope.close(readerScope, Exit.void)
        const result = yield* Fiber.join(pending)

        test
          .expect(Result.isFailure(result))
          .toBe(true)

        if (Result.isFailure(result)) {
          test
            .expect(result.failure.reason)
            .toMatchObject({ _tag: "SocketCloseError", code: 1006 })
        }

        test
          .expect(stream.listenerCount("readable"))
          .toBe(0)
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.it("delivers buffered bytes before reporting a clean EOF", () =>
    Effect
      .gen(function*() {
        const stream = yield* Effect.acquireRelease(
          Effect.sync(() => new NStream.PassThrough()),
          (stream) =>
            Effect.sync(() => {
              stream.destroy()
            }),
        )
        const socket = yield* NodeSocket.fromDuplex(Effect.succeed(stream))
        const reader = yield* socket.reader
        yield* Effect.sync(() => {
          stream.end(encoder.encode("last"))
        })
        const chunks = yield* reader.pull

        test
          .expect(chunks.map((chunk) => typeof chunk === "string" ? chunk : decoder.decode(chunk)).join(""))
          .toBe(
            "last",
          )

        const result = yield* Effect.result(reader.pull)

        test
          .expect(Result.isFailure(result))
          .toBe(true)

        if (Result.isFailure(result)) {
          test
            .expect(result.failure.reason)
            .toMatchObject({ _tag: "SocketCloseError", code: 1000 })
        }
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

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
