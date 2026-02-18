import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import * as Fetch from "./Fetch.ts"
import * as Route from "./Route.ts"
import * as BunServer from "./bun/BunServer.ts"

const testLayer = (routes: Parameters<typeof Route.tree>[0]) =>
  BunServer.layerRoutes({ port: 0 }).pipe(Layer.provide(Route.layer(Route.tree(routes))))

test.describe("Fetch.sse", () => {
  test.it("parses SSE events from a real server", () =>
    Effect.gen(function* () {
      const { server } = yield* BunServer.BunServer
      const url = `http://localhost:${server.port}/events`

      const events = yield* Fetch.get(url).pipe(
        Effect.map(Fetch.sse()),
        Effect.flatMap(Stream.runCollect),
      )

      test
        .expect(Array.from(events))
        .toEqual([
          { data: "hello" },
          { data: "world", type: "custom" },
          { data: "retry-test", retry: 3000 },
        ])
    }).pipe(
      Effect.provide(
        testLayer({
          "/events": Route.get(
            Route.sse(() =>
              Stream.make(
                { data: "hello" },
                { data: "world", type: "custom" },
                { data: "retry-test", retry: 3000 },
              ),
            ),
          ),
        }),
      ),
      Effect.runPromise,
    ),
  )

  test.it("fails on non-SSE content-type", () =>
    Effect.gen(function* () {
      const { server } = yield* BunServer.BunServer
      const url = `http://localhost:${server.port}/json`

      const exit = yield* Fetch.get(url).pipe(
        Effect.map(Fetch.sse()),
        Effect.flatMap(Stream.runCollect),
        Effect.exit,
      )

      test.expect(exit._tag).toBe("Failure")
      if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
        test.expect(exit.cause.error._tag).toBe("FetchError")
        test.expect(exit.cause.error.reason).toBe("Status")
      }
    }).pipe(
      Effect.provide(
        testLayer({
          "/json": Route.get(Route.json({ ok: true })),
        }),
      ),
      Effect.runPromise,
    ),
  )

  test.it("parses multi-line data events", () =>
    Effect.gen(function* () {
      const { server } = yield* BunServer.BunServer
      const url = `http://localhost:${server.port}/events`

      const events = yield* Fetch.get(url).pipe(
        Effect.map(Fetch.sse()),
        Effect.flatMap(Stream.runCollect),
      )

      test.expect(Array.from(events)).toEqual([{ data: "line1\nline2\nline3" }])
    }).pipe(
      Effect.provide(
        testLayer({
          "/events": Route.get(Route.sse(() => Stream.make({ data: "line1\nline2\nline3" }))),
        }),
      ),
      Effect.runPromise,
    ),
  )

  test.it("parses tagged struct events", () =>
    Effect.gen(function* () {
      const { server } = yield* BunServer.BunServer
      const url = `http://localhost:${server.port}/events`

      const events = yield* Fetch.get(url).pipe(
        Effect.map(Fetch.sse()),
        Effect.flatMap(Stream.runCollect),
      )

      test.expect(Array.from(events)).toEqual([
        {
          data: '{"_tag":"UserCreated","id":1,"name":"Alice"}',
          type: "UserCreated",
        },
      ])
    }).pipe(
      Effect.provide(
        testLayer({
          "/events": Route.get(
            Route.sse(() => Stream.make({ _tag: "UserCreated", id: 1, name: "Alice" })),
          ),
        }),
      ),
      Effect.runPromise,
    ),
  )

  test.it("handles stream timeout", () =>
    Effect.gen(function* () {
      const { server } = yield* BunServer.BunServer
      const url = `http://localhost:${server.port}/events`

      const events = yield* Fetch.get(url).pipe(
        Effect.map(Fetch.sse()),
        Effect.flatMap((stream) =>
          stream.pipe(
            Stream.takeUntilEffect(() => Effect.sleep("100 millis").pipe(Effect.as(true))),
            Stream.runCollect,
          ),
        ),
      )

      test.expect(Array.from(events).length).toBeGreaterThanOrEqual(1)
      test.expect(Array.from(events)[0]).toEqual({ data: "first" })
    }).pipe(
      Effect.provide(
        testLayer({
          "/events": Route.get(
            Route.sse(() => Stream.concat(Stream.make({ data: "first" }), Stream.never)),
          ),
        }),
      ),
      Effect.runPromise,
    ),
  )
})
