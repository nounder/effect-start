import * as test from "bun:test"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Runtime from "effect/Runtime"
import * as Stream from "effect/Stream"
import * as Http from "effect-start/Http"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as RouteMount from "effect-start/RouteMount"

test.describe("Route.sse()", () => {
  test.it("infers format as text", () => {
    RouteMount.get(
      Route.sse(function* (ctx) {
        test.expectTypeOf(ctx).toExtend<{
          method: "GET"
          format: "text"
        }>()

        return Stream.make({ data: "hello" })
      }),
    )
  })

  test.it("accepts object events with data only", () => {
    RouteMount.get(Route.sse(() => Stream.make({ data: "hello" }, { data: "world" })))
  })

  test.it("accepts object events with data and type", () => {
    RouteMount.get(
      Route.sse(() =>
        Stream.make({ data: "hello", type: "message" }, { data: "world", type: "update" }),
      ),
    )
  })

  test.it("accepts events with retry", () => {
    RouteMount.get(Route.sse(() => Stream.make({ data: "hello", retry: 3000 })))
  })

  test.it("accepts Effect returning Stream", () => {
    RouteMount.get(Route.sse(Effect.succeed(Stream.make({ data: "hello" }))))
  })

  test.it("accepts generator returning Stream", () => {
    RouteMount.get(
      Route.sse(function* () {
        const prefix = yield* Effect.succeed("msg: ")
        return Stream.make({ data: `${prefix}hello` })
      }),
    )
  })

  test.it("formats data events correctly", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.sse(() => Stream.make({ data: "hello" }, { data: "world" }))),
    )
    const response = await Http.fetch(handler, { path: "/events" })

    test.expect(response.headers.get("content-type")).toBe("text/event-stream")
    test.expect(response.headers.get("cache-control")).toBe("no-cache")
    test.expect(response.headers.get("connection")).toBe("keep-alive")

    const text = await response.text()

    test.expect(text).toBe("data: hello\n\ndata: world\n\n")
  })

  test.it("formats events with type field", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.sse(() => Stream.make({ data: "payload", type: "custom" }))),
    )
    const response = await Http.fetch(handler, { path: "/events" })

    const text = await response.text()

    test.expect(text).toBe("event: custom\ndata: payload\n\n")
  })

  test.it("formats events with retry", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(Route.sse(() => Stream.make({ data: "hello", retry: 5000 }))),
    )
    const response = await Http.fetch(handler, { path: "/events" })

    const text = await response.text()

    test.expect(text).toBe("data: hello\nretry: 5000\n\n")
  })

  test.it("formats multi-line data with multiple data fields", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.sse(() =>
          Stream.make({
            type: "patch",
            data: "line1\nline2\nline3",
          }),
        ),
      ),
    )
    const response = await Http.fetch(handler, { path: "/events" })

    const text = await response.text()

    test.expect(text).toBe("event: patch\ndata: line1\ndata: line2\ndata: line3\n\n")
  })

  test.it("accepts Stream directly", async () => {
    const handler = RouteHttp.toWebHandler(Route.get(Route.sse(Stream.make({ data: "direct" }))))
    const response = await Http.fetch(handler, { path: "/events" })

    const text = await response.text()

    test.expect(text).toBe("data: direct\n\n")
  })

  test.it("infers error type from Stream", () => {
    class MyError {
      readonly _tag = "MyError"
    }

    const stream: Stream.Stream<{ data: string }, MyError> = Stream.fail(new MyError())

    const route = Route.get(Route.sse(stream))

    const routes = [...route]
    type RouteError =
      (typeof routes)[0] extends Route.Route.Route<any, any, any, infer E, any> ? E : never

    test.expectTypeOf<RouteError>().toEqualTypeOf<MyError>()
  })

  test.it("infers context type from Stream", () => {
    class Config extends Context.Tag("Config")<Config, { url: string }>() {}

    const stream = Stream.fromEffect(Effect.map(Config, (cfg) => ({ data: cfg.url })))

    const route = Route.get(Route.sse(stream))

    const routes = [...route]
    type RouteContext =
      (typeof routes)[0] extends Route.Route.Route<any, any, any, any, infer R> ? R : never

    test.expectTypeOf<RouteContext>().toEqualTypeOf<Config>()
  })

  test.it("works with context at runtime", async () => {
    class Config extends Context.Tag("Config")<Config, { message: string }>() {}

    const stream = Stream.fromEffect(Effect.map(Config, (cfg) => ({ data: cfg.message })))

    const route = Route.get(Route.sse(stream))
    const layer = Layer.succeed(Config, { message: "from context" })
    const runtime = Effect.runSync(Layer.toRuntime(layer).pipe(Effect.scoped))
    const handler = RouteHttp.toWebHandlerRuntime(runtime)(route)

    const response = await Http.fetch(handler, { path: "/events" })
    const text = await response.text()

    test.expect(text).toBe("data: from context\n\n")
  })

  test.it("formats tagged struct as event with JSON data", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.sse(() =>
          Stream.make(
            { _tag: "UserCreated", id: 123, name: "Alice" },
            { _tag: "UserUpdated", id: 123, active: true },
          ),
        ),
      ),
    )
    const response = await Http.fetch(handler, { path: "/events" })

    const text = await response.text()

    test
      .expect(text)
      .toBe(
        `event: UserCreated\ndata: {"_tag":"UserCreated","id":123,"name":"Alice"}\n\n` +
          `event: UserUpdated\ndata: {"_tag":"UserUpdated","id":123,"active":true}\n\n`,
      )
  })

  test.it("handles mixed tagged and regular events", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.sse(() =>
          Stream.make(
            { data: "plain message" },
            { _tag: "Notification", text: "hello" },
            { data: "another", type: "custom" },
          ),
        ),
      ),
    )
    const response = await Http.fetch(handler, { path: "/events" })

    const text = await response.text()

    test
      .expect(text)
      .toBe(
        `data: plain message\n\n` +
          `event: Notification\ndata: {"_tag":"Notification","text":"hello"}\n\n` +
          `event: custom\ndata: another\n\n`,
      )
  })
})
