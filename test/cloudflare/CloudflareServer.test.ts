import * as test from "bun:test"
import { CloudflareServer } from "effect-start/cloudflare"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as StartServer from "effect-start/StartServer"
import * as Effect from "effect/Effect"
import * as Runtime from "effect/Runtime"

test.describe("make", () => {
  test.test("defaults to a synthetic workers.dev address on port 443", () =>
    Effect
      .gen(function*() {
        const server = yield* CloudflareServer.make()

        test
          .expect(server.address)
          .toEqual({ _tag: "WorkerAddress", hostname: "workers.dev", port: 443 })
        test
          .expect(server.hostname)
          .toBe("workers.dev")
        test
          .expect(server.port)
          .toBe(443)
        test
          .expect(server.url)
          .toBe("https://workers.dev:443")
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.test("accepts a custom public hostname and port", () =>
    Effect
      .gen(function*() {
        const server = yield* CloudflareServer.make({
          hostname: "my-app.example.com",
          port: 8443,
        })

        test
          .expect(server.hostname)
          .toBe("my-app.example.com")
        test
          .expect(server.port)
          .toBe(8443)
        test
          .expect(server.url)
          .toBe("https://my-app.example.com:8443")
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.test("has no persistent socket to upgrade, so it fails with a SocketOpenError", () =>
    Effect
      .gen(function*() {
        const server = yield* CloudflareServer.make()
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
})

test.describe("layer", () => {
  test.test("provides both CloudflareServer and StartServer backed by the same instance", () =>
    Effect
      .gen(function*() {
        const cloudflareServer = yield* CloudflareServer.CloudflareServer
        const startServer = yield* StartServer.StartServer

        test
          .expect(startServer)
          .toBe(cloudflareServer)
      })
      .pipe(
        Effect.provide(CloudflareServer.layer({ hostname: "my-app.workers.dev" })),
        Effect.scoped,
        Effect.runPromise,
      ))
})

test.describe("Route.ws integration", () => {
  test.test("a fetch-style handler responds 426 instead of hanging, since there's no socket to upgrade", () =>
    Effect
      .gen(function*() {
        const route = Route.get(Route.ws(function*(ctx) {
          const write = yield* ctx.socket.writer
          yield* ctx.socket.runRaw((data) => write(data))
        }))

        const server = yield* CloudflareServer.make()
        const runtime = yield* Effect.runtime().pipe(
          Effect.map(Runtime.provideService(StartServer.StartServer, server)),
        )
        const handler = RouteHttp.toWebHandlerRuntime(runtime)(route)

        const response = yield* Effect.promise(() =>
          Promise.resolve(
            handler(
              new Request("https://my-app.workers.dev/ws", {
                headers: { upgrade: "websocket", connection: "Upgrade" },
              }),
            ),
          )
        )

        test
          .expect(response.status)
          .toBe(426)
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))
})
