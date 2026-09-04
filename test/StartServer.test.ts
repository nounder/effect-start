import * as test from "bun:test"
import * as Socket from "effect-start/Socket"
import * as StartServer from "effect-start/StartServer"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Scope from "effect/Scope"
import * as SocketAddress from "../src/internal/SocketAddress.ts"

test.describe("make", () => {
  test.test("exposes hostname/port/url derived from the given address", () =>
    Effect
      .gen(function*() {
        const server = yield* StartServer.make({
          address: SocketAddress.tcp("example.com", 4000),
        })

        test
          .expect(server.address)
          .toEqual({ _tag: "TcpAddress", hostname: "example.com", port: 4000 })
        test
          .expect(server.hostname)
          .toBe("example.com")
        test
          .expect(server.port)
          .toBe(4000)
        test
          .expect(server.url)
          .toBe("http://example.com:4000")
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.test("derives a synthetic hostname/port for a WorkerAddress", () =>
    Effect
      .gen(function*() {
        const server = yield* StartServer.make({
          address: SocketAddress.worker("my-app.workers.dev", 443),
        })

        test
          .expect(server.hostname)
          .toBe("my-app.workers.dev")
        test
          .expect(server.port)
          .toBe(443)
        test
          .expect(server.url)
          .toBe("https://my-app.workers.dev:443")
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.test("upgrade fails with a SocketOpenError by default", () =>
    Effect
      .gen(function*() {
        const server = yield* StartServer.make({
          address: SocketAddress.worker(),
        })
        const scope = yield* Effect.scope
        const error = yield* Effect.flip(
          server.upgrade(new Request("http://localhost/"), scope),
        )

        test
          .expect(error.reason._tag)
          .toBe("SocketOpenError")
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.test("upgrade can be overridden", () => {
    const socket = Socket.make({
      runRaw: () => Effect.void,
      writer: Effect.succeed(() => Effect.void),
    })

    return Effect
      .gen(function*() {
        const server = yield* StartServer.make({
          address: SocketAddress.worker(),
          upgrade: () => Effect.succeed(socket),
        })
        const scope = yield* Effect.scope
        const result = yield* server.upgrade(new Request("http://localhost/"), scope)

        test
          .expect(result)
          .toBe(socket)
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      )
  })

  test.test("runFork forks into the server's scope and is interrupted when it closes", () =>
    Effect
      .gen(function*() {
        const scope = yield* Scope.make()
        const server = yield* Scope.extend(
          StartServer.make({ address: SocketAddress.worker() }),
          scope,
        )

        const interrupted = yield* Deferred.make<void>()
        yield* server.runFork(
          Effect.onInterrupt(Effect.never, () => Deferred.succeed(interrupted, void 0)),
        )
        // Give the forked fiber a scheduling tick to start running (and
        // install its interrupt handler) before the scope closes under it.
        yield* Effect.sleep("10 millis")

        yield* Scope.close(scope, Exit.void)

        yield* Deferred.await(interrupted).pipe(
          Effect.timeoutFail({
            duration: "1 second",
            onTimeout: () => new Error("expected runFork's effect to be interrupted"),
          }),
        )
      })
      .pipe(Effect.runPromise))
})
