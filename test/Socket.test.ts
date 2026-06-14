import * as test from "bun:test"
import * as Socket from "effect-start/Socket"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const echoServer = Effect.acquireRelease(
  Effect.sync(() =>
    Bun.serve({
      port: 0,
      fetch(request, server) {
        if (server.upgrade(request)) return undefined as any
        return new Response("not a websocket", { status: 426 })
      },
      websocket: {
        message(ws, message) {
          if (message === "__close") {
            ws.close(1000, "done")
            return
          }
          ws.send(message)
        },
      },
    })
  ),
  (server) => Effect.sync(() => server.stop(true)),
)

const wsUrl = (server: { port: number | undefined }) => `ws://localhost:${server.port}`

const provideConstructor = Effect.provideService(
  Socket.WebSocketConstructor,
  (url, protocols) => new globalThis.WebSocket(url, protocols),
)

test.describe("makeWebSocket", () => {
  test.it("round-trips text and binary frames", () =>
    Effect.gen(function*() {
      const server = yield* echoServer
      const socket = yield* Socket.makeWebSocket(wsUrl(server), {
        closeCodeIsError: () => false,
      })
      const messages = yield* Queue.unbounded<Uint8Array>()
      const fiber = yield* Effect.fork(
        socket.run((data) => Queue.offer(messages, data)),
      )

      yield* Effect.gen(function*() {
        const write = yield* socket.writer
        yield* write(encoder.encode("Hello"))
        yield* write(encoder.encode("World"))
      }).pipe(Effect.scoped)

      const first = yield* Queue.take(messages)
      const second = yield* Queue.take(messages)

      test
        .expect(decoder.decode(first))
        .toBe("Hello")
      test
        .expect(decoder.decode(second))
        .toBe("World")

      yield* Fiber.interrupt(fiber)
    }).pipe(provideConstructor, Effect.scoped, Effect.runPromise))

  test.it("runString decodes incoming frames to strings", () =>
    Effect.gen(function*() {
      const server = yield* echoServer
      const socket = yield* Socket.makeWebSocket(wsUrl(server), {
        closeCodeIsError: () => false,
      })
      const messages = yield* Queue.unbounded<string>()
      const fiber = yield* Effect.fork(
        socket.runString((data) => Queue.offer(messages, data)),
      )

      yield* Effect.gen(function*() {
        const write = yield* socket.writer
        yield* write("from-string")
      }).pipe(Effect.scoped)

      const received = yield* Queue.take(messages)

      test
        .expect(received)
        .toBe("from-string")

      yield* Fiber.interrupt(fiber)
    }).pipe(provideConstructor, Effect.scoped, Effect.runPromise))

  test.it("close codes are errors by default", () =>
    Effect.gen(function*() {
      const server = yield* echoServer
      const socket = yield* Socket.makeWebSocket(wsUrl(server))
      const fiber = yield* Effect.fork(socket.run(() => {}))

      const write = yield* Effect.scoped(socket.writer)
      yield* write("__close")

      const exit = yield* Fiber.join(fiber).pipe(Effect.exit)

      test
        .expect(exit._tag)
        .toBe("Failure")

      const error = exit._tag === "Failure" && exit.cause._tag === "Fail"
        ? exit.cause.error
        : undefined

      test
        .expect(Socket.isSocketError(error))
        .toBe(true)

      if (Socket.isSocketError(error)) {
        test
          .expect(error.reason._tag)
          .toBe("SocketCloseError")
        if (error.reason._tag === "SocketCloseError") {
          test
            .expect(error.reason.code)
            .toBe(1000)
          test
            .expect(error.reason.closeReason)
            .toBe("done")
        }
      }
    }).pipe(provideConstructor, Effect.scoped, Effect.runPromise))

  test.it("clean close completes the run when closeCodeIsError opts out", () =>
    Effect.gen(function*() {
      const server = yield* echoServer
      const socket = yield* Socket.makeWebSocket(wsUrl(server), {
        closeCodeIsError: () => false,
      })
      const fiber = yield* Effect.fork(socket.run(() => {}))

      const write = yield* Effect.scoped(socket.writer)
      yield* write("__close")

      const exit = yield* Fiber.join(fiber).pipe(Effect.exit)

      test
        .expect(exit._tag)
        .toBe("Success")
    }).pipe(provideConstructor, Effect.scoped, Effect.runPromise))

  test.it("times out when the socket never opens", () =>
    Effect.gen(function*() {
      const socket = yield* Socket.makeWebSocket(wsUrl({ port: 1 }), {
        openTimeout: 100,
      })

      const exit = yield* socket.run(() => {}).pipe(Effect.exit)

      test
        .expect(exit._tag)
        .toBe("Failure")

      const error = exit._tag === "Failure" && exit.cause._tag === "Fail"
        ? exit.cause.error
        : undefined

      if (Socket.isSocketError(error)) {
        test
          .expect(["SocketOpenError", "SocketCloseError"])
          .toContain(error.reason._tag)
      }
    }).pipe(provideConstructor, Effect.scoped, Effect.runPromise))
})

test.describe("fromTransformStream", () => {
  test.it("reads from readable and writes to writable", () =>
    Effect.gen(function*() {
      const readable = Stream.make("A", "B", "C").pipe(
        Stream.encodeText,
        Stream.toReadableStream(),
      )
      const chunks: Array<string> = []
      const writable = new WritableStream<Uint8Array>({
        write(chunk) {
          chunks.push(decoder.decode(chunk))
        },
      })

      const socket = yield* Socket.fromTransformStream(
        Effect.succeed({ readable, writable }),
        { closeCodeIsError: () => false },
      )

      yield* socket.writer.pipe(
        Effect.flatMap((write) =>
          write("Hello").pipe(Effect.andThen(write("World")))
        ),
        Effect.scoped,
        Effect.fork,
      )

      const received: Array<string> = []
      yield* socket.runString((chunk) =>
        Effect.sync(() => {
          received.push(chunk)
        })
      ).pipe(Effect.scoped)

      test
        .expect(received)
        .toEqual(["A", "B", "C"])
      test
        .expect(chunks)
        .toEqual(["Hello", "World"])
    }).pipe(Effect.scoped, Effect.runPromise))

  test.it("a finished readable surfaces a clean SocketCloseError by default", () =>
    Effect.gen(function*() {
      const readable = Stream.make("only").pipe(
        Stream.encodeText,
        Stream.toReadableStream(),
      )
      const writable = new WritableStream<Uint8Array>({ write() {} })

      const socket = yield* Socket.fromTransformStream(
        Effect.succeed({ readable, writable }),
      )

      const exit = yield* socket.run(() => {}).pipe(Effect.scoped, Effect.exit)

      test
        .expect(exit._tag)
        .toBe("Failure")

      const error = exit._tag === "Failure" && exit.cause._tag === "Fail"
        ? exit.cause.error
        : undefined

      if (Socket.isSocketError(error)) {
        test
          .expect(error.reason._tag)
          .toBe("SocketCloseError")
        if (error.reason._tag === "SocketCloseError") {
          test
            .expect(error.reason.code)
            .toBe(1000)
        }
      }
    }).pipe(Effect.scoped, Effect.runPromise))
})
