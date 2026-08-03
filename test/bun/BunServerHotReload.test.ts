import * as test from "bun:test"
import { BunServer } from "effect-start/bun"
import * as Route from "effect-start/Route"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as MutableRef from "effect/MutableRef"
import * as Schema from "effect/Schema"
import * as Scope from "effect/Scope"
import type * as RouteMap from "../../src/internal/RouteMap.ts"
import * as PlatformRuntime from "../../src/PlatformRuntime.ts"

/** Set mainFiber to a dummy fiber, returning it. */
const withMainFiber = Effect.gen(function*() {
  const fiber = yield* Effect.fork(Effect.never)
  MutableRef.set(PlatformRuntime.mainFiber, fiber as any)
  return fiber
})

/** Create a BunServer in a standalone scope for manual lifecycle control. */
const makeServerScoped = (routes?: RouteMap.RouteMap) =>
  Effect.gen(function*() {
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

const waitForPendingRequests = (
  server: BunServer.BunServer,
  count: number,
) =>
  Effect.gen(function*() {
    for (let attempt = 0; attempt < 1_000; attempt++) {
      if (server.server.pendingRequests >= count) return true
      yield* Effect.sleep("1 millis")
    }
    return false
  })

test.describe("BunServer hot reload", () => {
  test.it("finalizer does NOT stop the server", () =>
    run(
      Effect.gen(function*() {
        const oldFiber = yield* withMainFiber
        const { port, spy, closeScope, cleanup } = yield* makeServerScoped(
          Route.map({ "/": Route.get(Route.text("alive")) }),
        )

        // Simulate hot reload: new main fiber takes over, then old scope closes
        const newFiber = yield* withMainFiber
        yield* closeScope

        test
          .expect(spy.stopped)
          .toBe(false)

        // Server is still alive
        const res = yield* Effect.promise(() => fetch(`http://localhost:${port}/`))

        test
          .expect(res.status)
          .toBe(200)

        yield* cleanup
        yield* Fiber.interruptAll([oldFiber, newFiber])
      }),
    ))

  test.test("real shutdown: finalizer DOES stop the server", () =>
    run(
      Effect.gen(function*() {
        const fiber = yield* withMainFiber
        const { spy, closeScope } = yield* makeServerScoped()

        // No new fiber — this is a real shutdown
        yield* closeScope

        test
          .expect(spy.stopped)
          .toBe(true)

        yield* Fiber.interrupt(fiber)
      }),
    ))

  test.test("setRoutes swaps handlers on same port", () =>
    run(
      Effect.gen(function*() {
        const fiber = yield* withMainFiber
        const { server, port } = yield* makeServerScoped(
          Route.map({ "/v": Route.get(Route.text("v1")) }),
        )

        const text = (url: string) => Effect.promise(() => fetch(url).then((r) => r.text()))

        test
          .expect(yield* text(`http://localhost:${port}/v`))
          .toBe("v1")

        yield* server.setRoutes(
          Route.map({ "/v": Route.get(Route.text("v2")) }),
        )

        test
          .expect(yield* text(`http://localhost:${port}/v`))
          .toBe("v2")

        yield* Fiber.interrupt(fiber)
      }),
    ))

  test.it("resumes all requests waiting for initial routes", () =>
    run(
      Effect.gen(function*() {
        const fiber = yield* withMainFiber
        const { server, port } = yield* makeServerScoped()
        const staticResponsePromise = fetch(`http://localhost:${port}/ready/static`)
        const dynamicResponsePromise = fetch(`http://localhost:${port}/ready/123`)

        test
          .expect(yield* waitForPendingRequests(server, 2))
          .toBe(true)

        yield* server.setRoutes(
          Route.map({
            "/ready/static": Route.get(Route.text("static")),
            "/ready/:id": Route.get(Route.text("dynamic")),
          }),
        )

        const responses = yield* Effect.promise(() => Promise.all([staticResponsePromise, dynamicResponsePromise]))
        const bodies = yield* Effect.promise(() => Promise.all(responses.map((response) => response.text())))

        test
          .expect(responses.map((response) => response.status))
          .toEqual([200, 200])
        test
          .expect(bodies)
          .toEqual(["static", "dynamic"])

        yield* Fiber.interrupt(fiber)
      }),
    ))

  test.it("preserves the method and body while waiting", () =>
    run(
      Effect.gen(function*() {
        const fiber = yield* withMainFiber
        const { server, port } = yield* makeServerScoped()
        const responsePromise = fetch(`http://localhost:${port}/submit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ value: "kept" }),
        })

        test
          .expect(yield* waitForPendingRequests(server, 1))
          .toBe(true)

        yield* server.setRoutes(
          Route.map({
            "/submit": Route.post(
              Route.schemaBodyJson(
                Schema.Struct({ value: Schema.String }),
              ),
              Route.json(function*(ctx) {
                return { method: ctx.method, value: ctx.body.value }
              }),
            ),
          }),
        )

        const response = yield* Effect.promise(() => responsePromise)

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(yield* Effect.promise(() => response.json()))
          .toEqual({ method: "POST", value: "kept" })

        yield* Fiber.interrupt(fiber)
      }),
    ))

  test.it("returns 404 when registered routes do not match a waiting request", () =>
    run(
      Effect.gen(function*() {
        const fiber = yield* withMainFiber
        const { server, port } = yield* makeServerScoped()
        const responsePromise = fetch(`http://localhost:${port}/missing`)

        test
          .expect(yield* waitForPendingRequests(server, 1))
          .toBe(true)

        yield* server.setRoutes(
          Route.map({ "/ready": Route.get(Route.text("ready")) }),
        )

        const response = yield* Effect.promise(() => responsePromise)

        test
          .expect(response.status)
          .toBe(404)

        yield* Fiber.interrupt(fiber)
      }),
    ))

  test.it("aborting one request does not cancel route readiness", () =>
    run(
      Effect.gen(function*() {
        const fiber = yield* withMainFiber
        const { server, port } = yield* makeServerScoped()
        const controller = new AbortController()
        const abortedResponsePromise = fetch(`http://localhost:${port}/aborted`, {
          signal: controller.signal,
        })
          .then(
            () => "resolved" as const,
            () => "aborted" as const,
          )
        const survivingResponsePromise = fetch(`http://localhost:${port}/ready`)

        test
          .expect(yield* waitForPendingRequests(server, 2))
          .toBe(true)

        controller.abort()

        test
          .expect(yield* Effect.promise(() => abortedResponsePromise))
          .toBe("aborted")

        yield* server.setRoutes(
          Route.map({ "/ready": Route.get(Route.text("ready")) }),
        )

        const response = yield* Effect.promise(() => survivingResponsePromise)

        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(yield* Effect.promise(() => response.text()))
          .toBe("ready")

        yield* Fiber.interrupt(fiber)
      }),
    ))
})
