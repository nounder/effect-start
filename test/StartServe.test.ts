import * as test from "bun:test"
import { NodeServer } from "effect-start/node"
import * as Route from "effect-start/Route"
import * as Start from "effect-start/Start"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"

// Start.serve defaults to Bun (BunServer + BunRuntime.runMain). These tests
// exercise the pluggable `server`/`runMain` options that let it target
// another platform — here, a plain Node.js HTTP server — without touching
// process signal handlers or process.exit like the real runMains do.
test.test("Start.serve serves routes over a Node.js HTTP server via options.server/runMain", async () => {
  const routes = Route.map({
    "/hello": Route.get(Route.text("world from node")),
  })

  const portBox: { port?: number } = {}
  const capturePort = Layer.effectDiscard(
    Effect.gen(function*() {
      const server = yield* NodeServer.NodeServer
      if (server.address._tag === "TcpAddress") {
        portBox.port = server.address.port
      }
    }),
  )

  const serverLayer = Layer.provideMerge(
    capturePort,
    NodeServer.withLogAddress(NodeServer.layerStart({ port: 0 })),
  )

  let fiber: Fiber.RuntimeFiber<never, never> | undefined
  Start.serve(Route.layer(routes), {
    server: serverLayer,
    runMain: ((effect: Effect.Effect<never, never>) => {
      fiber = Effect.runFork(effect)
    }) as any,
  })

  try {
    const start = Date.now()
    while (portBox.port === undefined && Date.now() - start < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    if (portBox.port === undefined) throw new Error("NodeServer never bound a port")

    const response = await fetch(`http://localhost:${portBox.port}/hello`)
    const text = await response.text()

    test.expect(response.status).toBe(200)
    test.expect(text).toBe("world from node")
  } finally {
    if (fiber) await Effect.runPromise(Fiber.interrupt(fiber))
  }
})
