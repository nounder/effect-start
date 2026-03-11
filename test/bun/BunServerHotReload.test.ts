import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as MutableRef from "effect/MutableRef"
import * as Route from "effect-start/Route"
import * as Scope from "effect/Scope"
import { BunServer } from "effect-start/bun"
import * as PlatformRuntime from "../../src/PlatformRuntime.ts"

/** Set mainFiber to a dummy fiber, returning it. */
const withMainFiber = Effect.gen(function* () {
  const fiber = yield* Effect.fork(Effect.never)
  MutableRef.set(PlatformRuntime.mainFiber, fiber as any)
  return fiber
})

/** Create a BunServer in a standalone scope for manual lifecycle control. */
const makeServerScoped = (routes?: ReturnType<typeof Route.tree>) =>
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    const server = yield* BunServer.make({ port: 0 }, routes).pipe(
      Effect.provideService(Scope.Scope, scope),
    )

    const spy = { stopped: false }
    const originalStop = server.server.stop.bind(server.server)
    server.server.stop = (...args: [boolean?]) => {
      spy.stopped = true
      return originalStop(...args)
    }

    return {
      server,
      port: server.server.port,
      spy,
      closeScope: Scope.close(scope, yield* Effect.exit(Effect.void)),
      cleanup: Effect.sync(() => originalStop()),
    }
  })

const run = <A>(effect: Effect.Effect<A, never, never>) =>
  effect.pipe(
    Effect.scoped,
    Effect.ensuring(
      Effect.sync(() => MutableRef.set(PlatformRuntime.mainFiber, undefined)),
    ),
    Effect.runPromise,
  )

test.describe("BunServer hot reload", () => {
  test.test("hot reload: finalizer does NOT stop the server", () =>
    run(
      Effect.gen(function* () {
        const oldFiber = yield* withMainFiber
        const { port, spy, closeScope, cleanup } = yield* makeServerScoped()

        // Simulate hot reload: new main fiber takes over, then old scope closes
        const newFiber = yield* withMainFiber
        yield* closeScope

        test.expect(spy.stopped).toBe(false)

        // Server is still alive
        const res = yield* Effect.promise(() =>
          fetch(`http://localhost:${port}/`),
        )
        test.expect(res.status).toBe(404)

        yield* cleanup
        yield* Fiber.interruptAll([oldFiber, newFiber])
      }),
    ),
  )

  test.test("real shutdown: finalizer DOES stop the server", () =>
    run(
      Effect.gen(function* () {
        const fiber = yield* withMainFiber
        const { spy, closeScope } = yield* makeServerScoped()

        // No new fiber — this is a real shutdown
        yield* closeScope

        test.expect(spy.stopped).toBe(true)

        yield* Fiber.interrupt(fiber)
      }),
    ),
  )

  test.test("setRoutes swaps handlers on same port", () =>
    run(
      Effect.gen(function* () {
        const fiber = yield* withMainFiber
        const { server, port } = yield* makeServerScoped(
          Route.tree({ "/v": Route.get(Route.text("v1")) }),
        )

        const text = (url: string) =>
          Effect.promise(() => fetch(url).then((r) => r.text()))

        test.expect(yield* text(`http://localhost:${port}/v`)).toBe("v1")

        yield* server.setRoutes(
          Route.tree({ "/v": Route.get(Route.text("v2")) }),
        )

        test.expect(yield* text(`http://localhost:${port}/v`)).toBe("v2")

        yield* Fiber.interrupt(fiber)
      }),
    ),
  )
})
