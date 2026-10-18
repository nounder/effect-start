import * as test from "bun:test"
import { BunServer } from "effect-start/bun"
import type * as RouteMap from "effect-start/internal/RouteMap"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Sse from "effect/encoding/Sse"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpServer from "effect/http/HttpServer"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"
import * as TestHttpClient from "./internal/TestHttpClient.ts"

const testLayer = <const Input extends RouteMap.RouteMapInput>(routes: Input) =>
  RouteHttp.layer().pipe(
    Layer.provideMerge(BunServer.layer({ port: 0 })),
    Layer.provide(Route.layer(Route.map(routes))),
  )

test.describe("Route.sse()", () => {
  test.it("infers format as sse", () => {
    Route.get(
      Route.sse(function*(ctx) {
        test
          .expectTypeOf(ctx)
          .toExtend<{
            method: "GET"
            format: "sse"
          }>()

        return Stream.make({ data: "hello" })
      }),
    )
  })

  test.it("accepts object events with data only", () => {
    Route.get(
      Route.sse(() => Stream.make({ data: "hello" }, { data: "world" })),
    )
  })

  test.it("accepts object events with data and type", () => {
    Route.get(
      Route.sse(() =>
        Stream.make({ data: "hello", event: "message" }, {
          data: "world",
          event: "update",
        })
      ),
    )
  })

  test.it("accepts events with retry", () => {
    Route.get(Route.sse(() => Stream.make({ data: "hello", retry: 3000 })))
  })

  test.it("accepts Effect returning Stream", () => {
    Route.get(Route.sse(Effect.succeed(Stream.make({ data: "hello" }))))
  })

  test.it("accepts generator returning Stream", () => {
    Route.get(
      Route.sse(function*() {
        const prefix = yield* Effect.succeed("msg: ")
        return Stream.make({ data: `${prefix}hello` })
      }),
    )
  })

  test.it("formats data events correctly", () =>
    Effect
      .gen(function*() {
        const handler = RouteHttp.toWebHandler(
          Route.get(
            Route.sse(() => Stream.make({ data: "hello" }, { data: "world" })),
          ),
        )
        const client = TestHttpClient.fromHandler(handler)
        const entity = yield* client.get("http://localhost/events")

        test
          .expect(entity.headers)
          .toMatchObject({
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          })

        test
          .expect(yield* entity.text)
          .toBe("data: hello\n\ndata: world\n\n")
      })
      .pipe(Effect.runPromise))

  test.it("formats events with event field", () =>
    Effect
      .gen(function*() {
        const handler = RouteHttp.toWebHandler(
          Route.get(
            Route.sse(() => Stream.make({ data: "payload", event: "custom" })),
          ),
        )
        const client = TestHttpClient.fromHandler(handler)
        const entity = yield* client.get("http://localhost/events")

        test
          .expect(yield* entity.text)
          .toBe("event: custom\ndata: payload\n\n")
      })
      .pipe(Effect.runPromise))

  test.it("formats events with retry", () =>
    Effect
      .gen(function*() {
        const handler = RouteHttp.toWebHandler(
          Route.get(
            Route.sse(() => Stream.make({ data: "hello", retry: 5000 })),
          ),
        )
        const client = TestHttpClient.fromHandler(handler)
        const entity = yield* client.get("http://localhost/events")

        test
          .expect(yield* entity.text)
          .toBe("data: hello\nretry: 5000\n\n")
      })
      .pipe(Effect.runPromise))

  test.it("formats multi-line data with multiple data fields", () =>
    Effect
      .gen(function*() {
        const handler = RouteHttp.toWebHandler(
          Route.get(
            Route.sse(() =>
              Stream.make({
                event: "patch",
                data: "line1\nline2\nline3",
              })
            ),
          ),
        )
        const client = TestHttpClient.fromHandler(handler)
        const entity = yield* client.get("http://localhost/events")

        test
          .expect(yield* entity.text)
          .toBe("event: patch\ndata: line1\ndata: line2\ndata: line3\n\n")
      })
      .pipe(Effect.runPromise))

  test.it("accepts Stream directly", () =>
    Effect
      .gen(function*() {
        const handler = RouteHttp.toWebHandler(
          Route.get(Route.sse(Stream.make({ data: "direct" }))),
        )
        const client = TestHttpClient.fromHandler(handler)
        const entity = yield* client.get("http://localhost/events")

        test
          .expect(yield* entity.text)
          .toBe("data: direct\n\n")
      })
      .pipe(Effect.runPromise))

  test.it("infers error type from Stream", () => {
    class MyError {
      readonly _tag = "MyError"
    }

    const stream: Stream.Stream<{ data: string }, MyError> = Stream.fail(
      new MyError(),
    )

    const route = Route.get(Route.sse(stream))

    const routes = [...route]
    type RouteError = (typeof routes)[0] extends Route.Route<any, any, any, infer E, any> ? E : never

    test
      .expectTypeOf<RouteError>()
      .toEqualTypeOf<MyError>()
  })

  test.it("infers context type from Stream", () => {
    class Config extends Context.Service<Config, { url: string }>()("Config") {}

    const stream = Stream.fromEffect(
      Effect.map(Config, (cfg) => ({ data: cfg.url })),
    )

    const route = Route.get(Route.sse(stream))

    const routes = [...route]
    type RouteContext = (typeof routes)[0] extends Route.Route<any, any, any, any, infer R> ? R : never

    test
      .expectTypeOf<RouteContext>()
      .toEqualTypeOf<Config>()
  })

  test.it("works with context at runtime", () =>
    Effect
      .gen(function*() {
        class Config extends Context.Service<Config, { message: string }>()("Config") {}

        const stream = Stream.fromEffect(
          Effect.map(Config, (cfg) => ({ data: cfg.message })),
        )

        const route = Route.get(Route.sse(stream))
        const layer = Layer.succeed(Config, { message: "from context" })
        const context = Effect.runSync(Layer.build(layer).pipe(Effect.scoped))
        const handler = RouteHttp.toWebHandlerWith(context)(route)

        const client = TestHttpClient.fromHandler(handler)
        const entity = yield* client.get("http://localhost/events")

        test
          .expect(yield* entity.text)
          .toBe("data: from context\n\n")
      })
      .pipe(Effect.runPromise))

  test.it("formats tagged struct as event with JSON data", () =>
    Effect
      .gen(function*() {
        const handler = RouteHttp.toWebHandler(
          Route.get(
            Route.sse(() =>
              Stream.make(
                { _tag: "UserCreated", id: 123, name: "Alice" },
                { _tag: "UserUpdated", id: 123, active: true },
              )
            ),
          ),
        )
        const client = TestHttpClient.fromHandler(handler)
        const entity = yield* client.get("http://localhost/events")

        test
          .expect(yield* entity.text)
          .toBe(
            `event: UserCreated\ndata: {"_tag":"UserCreated","id":123,"name":"Alice"}\n\n` +
              `event: UserUpdated\ndata: {"_tag":"UserUpdated","id":123,"active":true}\n\n`,
          )
      })
      .pipe(Effect.runPromise))

  test.it("handles mixed tagged and regular events", () =>
    Effect
      .gen(function*() {
        const handler = RouteHttp.toWebHandler(
          Route.get(
            Route.sse(() =>
              Stream.make(
                { data: "plain message" },
                { _tag: "Notification", text: "hello" },
                { data: "another", event: "custom" },
              )
            ),
          ),
        )
        const client = TestHttpClient.fromHandler(handler)
        const entity = yield* client.get("http://localhost/events")

        test
          .expect(yield* entity.text)
          .toBe(
            `data: plain message\n\n` +
              `event: Notification\ndata: {"_tag":"Notification","text":"hello"}\n\n` +
              `event: custom\ndata: another\n\n`,
          )
      })
      .pipe(Effect.runPromise))
})

test.describe("Route.sse with HttpClient", () => {
  test.it("parses SSE events from a real server", () =>
    Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const url = `${HttpServer.formatAddress(server.address)}/events`

        const events = yield* HttpClient.get(url).pipe(
          Effect.map((response) =>
            response.stream.pipe(
              Stream.decodeText(),
              Stream.pipeThroughChannel(Sse.decode()),
            )
          ),
          Effect.flatMap(Stream.runCollect),
        )

        test
          .expect(Array.from(events))
          .toEqual([
            { _tag: "Event", id: undefined, event: "message", data: "hello" },
            { _tag: "Event", id: undefined, data: "world", event: "custom" },
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
                )
              ),
            ),
          }),
        ),
        Effect.provide(FetchHttpClient.layer),
        Effect.runPromise,
      ))

  test.it("exposes retry directives through the core SSE decoder", () =>
    Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const response = yield* HttpClient.get(`${HttpServer.formatAddress(server.address)}/events`)
        const exit = yield* response.stream.pipe(
          Stream.decodeText(),
          Stream.pipeThroughChannel(Sse.decode()),
          Stream.runCollect,
          Effect.exit,
        )

        test
          .expect(exit._tag)
          .toBe("Failure")

        if (exit._tag === "Failure") {
          const error = Cause.findErrorOption(exit.cause)

          test
            .expect(Option.isSome(error) && Sse.Retry.is(error.value))
            .toBe(true)

          if (Option.isSome(error) && Sse.Retry.is(error.value)) {
            test
              .expect(Duration.toMillis(error.value.duration))
              .toBe(3000)
          }
        }
      })
      .pipe(
        Effect.provide(testLayer({
          "/events": Route.get(Route.sse(Stream.make({ data: "reconnect", retry: 3000 }))),
        })),
        Effect.provide(FetchHttpClient.layer),
        Effect.runPromise,
      ))

  test.it("parses multi-line data events", () =>
    Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const url = `${HttpServer.formatAddress(server.address)}/events`

        const events = yield* HttpClient.get(url).pipe(
          Effect.map((response) =>
            response.stream.pipe(
              Stream.decodeText(),
              Stream.pipeThroughChannel(Sse.decode()),
            )
          ),
          Effect.flatMap(Stream.runCollect),
        )

        test
          .expect(Array.from(events))
          .toEqual([{
            _tag: "Event",
            id: undefined,
            event: "message",
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
        Effect.provide(FetchHttpClient.layer),
        Effect.runPromise,
      ))

  test.it("parses tagged struct events", () =>
    Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const url = `${HttpServer.formatAddress(server.address)}/events`

        const events = yield* HttpClient.get(url).pipe(
          Effect.map((response) =>
            response.stream.pipe(
              Stream.decodeText(),
              Stream.pipeThroughChannel(Sse.decode()),
            )
          ),
          Effect.flatMap(Stream.runCollect),
        )

        test
          .expect(Array.from(events))
          .toEqual([
            {
              _tag: "Event",
              id: undefined,
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
        Effect.provide(FetchHttpClient.layer),
        Effect.runPromise,
      ))

  test.it("handles stream timeout", () =>
    Effect
      .gen(function*() {
        const server = yield* HttpServer.HttpServer
        const url = `${HttpServer.formatAddress(server.address)}/events`

        const events = yield* HttpClient.get(url).pipe(
          Effect.map((response) =>
            response.stream.pipe(
              Stream.decodeText(),
              Stream.pipeThroughChannel(Sse.decode()),
            )
          ),
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
          .toEqual({ _tag: "Event", id: undefined, event: "message", data: "first" })
      })
      .pipe(
        Effect.provide(
          testLayer({
            "/events": Route.get(
              Route.sse(() => Stream.concat(Stream.make({ data: "first" }), Stream.never)),
            ),
          }),
        ),
        Effect.provide(FetchHttpClient.layer),
        Effect.runPromise,
      ))
})
