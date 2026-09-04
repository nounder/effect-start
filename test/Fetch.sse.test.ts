import * as test from "bun:test"
import { BunServer } from "effect-start/bun"
import * as Fetch from "effect-start/Fetch"
import * as Route from "effect-start/Route"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"
import * as HttpServer from "effect/unstable/http/HttpServer"
import type * as RouteMap from "effect-start/internal/RouteMap"

const testLayer = <const Input extends RouteMap.RouteMapInput>(routes: Input) =>
  BunServer.layerRoutes({ port: 0 }).pipe(
    Layer.provide(Route.layer(Route.map(routes))),
  )

test.describe("Fetch.sse", () => {
  test.it("parses SSE events from a real server", () =>
    Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const url = `${HttpServer.formatAddress(server.address)}/events`

        const events = yield* Fetch.get(url).pipe(
          Effect.map(Fetch.sse()),
          Effect.flatMap(Stream.runCollect),
        )

        test
          .expect(Array.from(events))
          .toEqual([
            { data: "hello" },
            { data: "world", event: "custom" },
            { data: "retry-test", retry: 3000 },
          ])
      })
      .pipe(
        Effect.provide(
          testLayer({
            "/events": Route.get(
              Route.sse(() =>
                Stream.make(
                  { data: "hello" },
                  { data: "world", event: "custom" },
                  { data: "retry-test", retry: 3000 },
                )
              ),
            ),
          }),
        ),
        Effect.runPromise,
      ))

  test.it("fails on non-SSE content-type", () =>
    Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const url = `${HttpServer.formatAddress(server.address)}/json`

        const exit = yield* Fetch.get(url).pipe(
          Effect.map(Fetch.sse()),
          Effect.flatMap(Stream.runCollect),
          Effect.exit,
        )

        test
          .expect(exit._tag)
          .toBe("Failure")

        if (exit._tag === "Failure") {
          const error = Cause.findErrorOption(exit.cause)

          test
            .expect(Option.isSome(error) && error.value._tag)
            .toBe("FetchError")
          test
            .expect(Option.isSome(error) && error.value.reason)
            .toBe("Status")
        }
      })
      .pipe(
        Effect.provide(
          testLayer({
            "/json": Route.get(Route.json({ ok: true })),
          }),
        ),
        Effect.runPromise,
      ))

  test.it("parses multi-line data events", () =>
    Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const url = `${HttpServer.formatAddress(server.address)}/events`

        const events = yield* Fetch.get(url).pipe(
          Effect.map(Fetch.sse()),
          Effect.flatMap(Stream.runCollect),
        )

        test
          .expect(Array.from(events))
          .toEqual([{
            data: "line1\nline2\nline3",
          }])
      })
      .pipe(
        Effect.provide(
          testLayer({
            "/events": Route.get(
              Route.sse(() => Stream.make({ data: "line1\nline2\nline3" })),
            ),
          }),
        ),
        Effect.runPromise,
      ))

  test.it("parses tagged struct events", () =>
    Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const url = `${HttpServer.formatAddress(server.address)}/events`

        const events = yield* Fetch.get(url).pipe(
          Effect.map(Fetch.sse()),
          Effect.flatMap(Stream.runCollect),
        )

        test
          .expect(Array.from(events))
          .toEqual([
            {
              data: "{\"_tag\":\"UserCreated\",\"id\":1,\"name\":\"Alice\"}",
              event: "UserCreated",
            },
          ])
      })
      .pipe(
        Effect.provide(
          testLayer({
            "/events": Route.get(
              Route.sse(() => Stream.make({ _tag: "UserCreated", id: 1, name: "Alice" })),
            ),
          }),
        ),
        Effect.runPromise,
      ))

  test.it("handles stream timeout", () =>
    Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const url = `${HttpServer.formatAddress(server.address)}/events`

        const events = yield* Fetch.get(url).pipe(
          Effect.map(Fetch.sse()),
          Effect.flatMap((stream) =>
            stream.pipe(
              Stream.timeout("100 millis"),
              Stream.runCollect,
            )
          ),
        )

        test
          .expect(Array.from(events).length)
          .toBeGreaterThanOrEqual(1)
        test
          .expect(Array.from(events)[0])
          .toEqual({ data: "first" })
      })
      .pipe(
        Effect.provide(
          testLayer({
            "/events": Route.get(
              Route.sse(() => Stream.concat(Stream.make({ data: "first" }), Stream.never)),
            ),
          }),
        ),
        Effect.runPromise,
      ))
})
