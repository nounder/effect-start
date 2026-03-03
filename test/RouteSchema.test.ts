import * as test from "bun:test"
import { Effect, Schema } from "effect"
import * as Fetch from "effect-start/Fetch"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as RouteMount from "effect-start/RouteMount"
import * as RouteError from "effect-start/RouteError"
import * as RouteSchema from "effect-start/RouteSchema"
import { TestLogger } from "effect-start/testing"

test.describe(`${RouteSchema.schemaHeaders.name}()`, () => {
  test.it(`${RouteSchema.schemaHeaders.name} merges`, () => {
    type ExpectedBindings = {
      hello: string
      "x-custom-header": string
    }
    const route = Route.use(
      RouteSchema.schemaHeaders(
        Schema.Struct({
          hello: Schema.String,
        }),
      ),
    ).get(
      RouteSchema.schemaHeaders(
        Schema.Struct({
          "x-custom-header": Schema.String,
        }),
      ),
      Route.html(function* (ctx) {
        test.expectTypeOf(ctx.headers).toExtend<ExpectedBindings>()

        return `<h1>Hello, world!</h1>`
      }),
    )

    test.expectTypeOf<Route.Route.Context<typeof route>>().toExtend<{
      headers: ExpectedBindings
    }>()
  })

  test.it("passes bindings and parses value", async () => {
    const headers = {
      "x-hello": "test-value",
    }
    type ExpectedBindings = {
      headers: typeof headers
    }

    const route = RouteMount.get(
      RouteSchema.schemaHeaders(
        Schema.Struct({
          "x-hello": Schema.String,
        }),
      ),
      Route.text((context) =>
        Effect.gen(function* () {
          test.expectTypeOf(context).toExtend<ExpectedBindings>()

          test.expect(context).toMatchObject({
            headers,
          })

          return "Hello, World!"
        }),
      ),
    )

    test.expectTypeOf<Route.Route.Context<typeof route>>().toExtend<ExpectedBindings>()
  })
})

test.describe(`${RouteSchema.schemaCookies.name}()`, () => {
  test.it("merges cookies from schema", () => {
    type ExpectedBindings = {
      session: string
      token: string
    }
    const route = Route.use(
      RouteSchema.schemaCookies(
        Schema.Struct({
          session: Schema.String,
        }),
      ),
    ).get(
      RouteSchema.schemaCookies(
        Schema.Struct({
          token: Schema.String,
        }),
      ),
      Route.html(function* (ctx) {
        test.expectTypeOf(ctx.cookies).toExtend<ExpectedBindings>()

        return `<h1>Hello, world!</h1>`
      }),
    )

    test.expectTypeOf<Route.Route.Context<typeof route>>().toExtend<{
      cookies: ExpectedBindings
    }>()
  })

  test.it("parses cookies from request", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          RouteSchema.schemaCookies(
            Schema.Struct({
              session: Schema.String,
            }),
          ),
          Route.text(function* (ctx) {
            return `session=${ctx.cookies.session}`
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test", {
        headers: {
          Cookie: "session=abc123",
        },
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("session=abc123")
    }).pipe(Effect.runPromise),
  )
})

test.describe(`${RouteSchema.schemaSearchParams.name}()`, () => {
  test.it("merges search params from schema", () => {
    type ExpectedBindings = {
      page: string
      limit: string
    }
    const route = Route.use(
      RouteSchema.schemaSearchParams(
        Schema.Struct({
          page: Schema.String,
        }),
      ),
    ).get(
      RouteSchema.schemaSearchParams(
        Schema.Struct({
          limit: Schema.String,
        }),
      ),
      Route.html(function* (ctx) {
        test.expectTypeOf(ctx.searchParams).toExtend<ExpectedBindings>()

        return `<h1>Hello, world!</h1>`
      }),
    )

    test.expectTypeOf<Route.Route.Context<typeof route>>().toExtend<{
      searchParams: ExpectedBindings
    }>()
  })

  test.it("parses search params from request", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          RouteSchema.schemaSearchParams(
            Schema.Struct({
              page: Schema.NumberFromString,
              limit: Schema.NumberFromString,
            }),
          ),
          Route.text(function* (ctx) {
            return `page=${ctx.searchParams.page},limit=${ctx.searchParams.limit}`
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test?page=2&limit=10")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.text).toBe("page=2,limit=10")
    }).pipe(Effect.runPromise),
  )
})

test.describe(`${RouteSchema.schemaBodyJson.name}()`, () => {
  test.it("parses JSON body from schema", () => {
    type ExpectedBindings = {
      name: string
      age: number
    }
    const route = Route.post(
      RouteSchema.schemaBodyJson(
        Schema.Struct({
          name: Schema.String,
          age: Schema.Number,
        }),
      ),
      Route.json(function* (ctx) {
        test.expectTypeOf(ctx.body).toExtend<ExpectedBindings>()

        return { received: ctx.body }
      }),
    )

    test.expectTypeOf<Route.Route.Context<typeof route>>().toExtend<{
      body: ExpectedBindings
    }>()
  })

  test.it("parses JSON body from request", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.post(
          RouteSchema.schemaBodyJson(
            Schema.Struct({
              name: Schema.String,
              age: Schema.Number,
            }),
          ),
          Route.json(function* (ctx) {
            return { name: ctx.body.name, age: ctx.body.age }
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.post("http://localhost/test", {
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Alice", age: 30 }),
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.json).toEqual({ name: "Alice", age: 30 })
    }).pipe(Effect.runPromise),
  )

  test.it("returns error for invalid JSON body", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<TestLogger.TestLogger>()
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.post(
          RouteSchema.schemaBodyJson(
            Schema.Struct({
              name: Schema.String,
              age: Schema.Number,
            }),
          ),
          Route.json(function* (ctx) {
            return ctx.body
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.post("http://localhost/test", {
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Alice", age: "not a number" }),
      })

      test.expect(entity.status).toBe(400)

      const messages = yield* TestLogger.messages

      test.expect(messages.some((m) => m.includes("ParseError"))).toBe(true)
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )
})

test.describe(`${RouteSchema.schemaBodyUrlParams.name}()`, () => {
  test.it("parses URL params body from schema", () => {
    type ExpectedBindings = {
      username: string
      password: string
    }
    const route = Route.post(
      RouteSchema.schemaBodyUrlParams(
        Schema.Struct({
          username: Schema.String,
          password: Schema.String,
        }),
      ),
      Route.json(function* (ctx) {
        test.expectTypeOf(ctx.body).toExtend<ExpectedBindings>()

        return { received: ctx.body }
      }),
    )

    test.expectTypeOf<Route.Route.Context<typeof route>>().toExtend<{
      body: ExpectedBindings
    }>()
  })

  test.it("parses URL-encoded body from request", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.post(
          RouteSchema.schemaBodyUrlParams(
            Schema.Struct({
              username: Schema.String,
              password: Schema.String,
            }),
          ),
          Route.json(function* (ctx) {
            return { username: ctx.body.username, password: ctx.body.password }
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.post("http://localhost/test", {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "username=alice&password=secret123",
      })

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.json).toEqual({ username: "alice", password: "secret123" })
    }).pipe(Effect.runPromise),
  )
})

test.describe(`${RouteSchema.schemaBodyMultipart.name}()`, () => {
  test.it("has correct type signature for multipart body", () => {
    const route = Route.post(
      RouteSchema.schemaBodyMultipart(
        Schema.Struct({
          name: Schema.String,
        }),
      ),
      Route.json(function* (ctx) {
        test.expectTypeOf(ctx.body).toExtend<{ name: string }>()

        return { name: ctx.body.name }
      }),
    )

    test.expectTypeOf<Route.Route.Context<typeof route>>().toExtend<{
      body: { name: string }
    }>()
  })
})

test.describe(`${RouteSchema.schemaBodyForm.name}()`, () => {
  test.it("has correct type signature for form body", () => {
    const route = Route.post(
      RouteSchema.schemaBodyForm(
        Schema.Struct({
          email: Schema.String,
        }),
      ),
      Route.json(function* (ctx) {
        test.expectTypeOf(ctx.body).toExtend<{ email: string }>()

        return { email: ctx.body.email }
      }),
    )

    test.expectTypeOf<Route.Route.Context<typeof route>>().toExtend<{
      body: { email: string }
    }>()
  })
})

test.describe(`${RouteSchema.schemaSuccess.name}()`, () => {
  test.it("encodes response body through schema", () =>
    Effect.gen(function* () {
      const UserResponse = Schema.Struct({
        name: Schema.String,
        age: Schema.Number,
      })

      const handler = RouteHttp.toWebHandler(
        Route.get(
          RouteSchema.schemaSuccess(UserResponse),
          Route.json(function* () {
            return { name: "Alice", age: 30 }
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.json).toEqual({ name: "Alice", age: 30 })
    }).pipe(Effect.runPromise),
  )

  test.it("returns error when response body does not match schema", () =>
    Effect.gen(function* () {
      const StrictResponse = Schema.Struct({
        name: Schema.String,
        age: Schema.Number,
      })

      const runtime = yield* Effect.runtime<TestLogger.TestLogger>()
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.get(
          RouteSchema.schemaSuccess(StrictResponse),
          Route.json(function* () {
            return { name: "Alice", age: "not a number" }
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(400)

      const messages = yield* TestLogger.messages

      test.expect(messages.some((m) => m.includes("ParseError"))).toBe(true)
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("strips extra fields via schema encode", () =>
    Effect.gen(function* () {
      const StrictResponse = Schema.Struct({
        id: Schema.Number,
        name: Schema.String,
      })

      const handler = RouteHttp.toWebHandler(
        Route.get(
          RouteSchema.schemaSuccess(StrictResponse),
          Route.json(function* () {
            return { id: 1, name: "Alice", secret: "should-be-stripped" }
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(200)

      const body = yield* entity.json

      test.expect(body).toEqual({ id: 1, name: "Alice" })
      test.expect(body).not.toHaveProperty("secret")
    }).pipe(Effect.runPromise),
  )

  test.it("works with schema transforms", () =>
    Effect.gen(function* () {
      const DateResponse = Schema.Struct({
        createdAt: Schema.DateFromString,
      })

      const handler = RouteHttp.toWebHandler(
        Route.get(
          RouteSchema.schemaSuccess(DateResponse),
          // @ts-expect-error Date is not Json, but schemaSuccess encodes it to string
          Route.json(function* () {
            return { createdAt: new Date("2025-01-01") }
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.json).toEqual({ createdAt: "2025-01-01T00:00:00.000Z" })
    }).pipe(Effect.runPromise),
  )
})

test.describe(`${RouteSchema.schemaError.name}()`, () => {
  class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {
    message: Schema.String,
  }) {}

  class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {
    message: Schema.String,
  }) {}

  test.it("catches matching error and returns structured response", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          RouteSchema.schemaError(NotFound, { status: 404 }),
          Route.json(function* () {
            const found = false as boolean
            if (!found) return yield* new NotFound({ message: "User not found" })
            return { name: "Alice" }
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(404)
      test.expect(yield* entity.json).toEqual({
        _tag: "NotFound",
        message: "User not found",
      })
    }).pipe(Effect.runPromise),
  )

  test.it("passes through unmatched errors", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<TestLogger.TestLogger>()
      const handler = RouteHttp.toWebHandlerRuntime(runtime)(
        Route.get(
          RouteSchema.schemaError(NotFound, { status: 404 }),
          Route.json(function* () {
            const ok = false as boolean
            if (!ok) return yield* new Unauthorized({ message: "No access" })
            return { name: "Alice" }
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(500)
    }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
  )

  test.it("chains multiple schemaError pipes", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          RouteSchema.schemaError(NotFound, { status: 404 }),
          RouteSchema.schemaError(Unauthorized, { status: 401 }),
          Route.json(function* () {
            const ok = false as boolean
            if (!ok) return yield* new Unauthorized({ message: "Denied" })
            return { name: "Alice" }
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(401)
      test.expect(yield* entity.json).toEqual({
        _tag: "Unauthorized",
        message: "Denied",
      })
    }).pipe(Effect.runPromise),
  )

  test.it("success responses pass through unchanged", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          RouteSchema.schemaError(NotFound, { status: 404 }),
          Route.json(function* () {
            return { name: "Alice" }
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(200)
      test.expect(yield* entity.json).toEqual({ name: "Alice" })
    }).pipe(Effect.runPromise),
  )

  test.it("schemaError route has E=never", () => {
    const routeSet = RouteSchema.schemaError(NotFound, { status: 404 })(Route.empty)

    type Items = Route.RouteSet.Items<typeof routeSet>
    type ErrorRoute = Items[0]
    type E = ErrorRoute extends Route.Route.Route<any, any, any, infer _E, any> ? _E : "fail"

    true satisfies [E] extends [never] ? true : false
  })

  test.it("infers status from static property on schema", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          RouteSchema.schemaError(RouteError.NotFound),
          Route.json(function* () {
            const found = false as boolean
            if (!found) return yield* new RouteError.NotFound({ message: "Gone" })
            return { name: "Alice" }
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(404)
      test.expect(yield* entity.json).toEqual({
        _tag: "NotFound",
        message: "Gone",
      })
    }).pipe(Effect.runPromise),
  )

  test.it("explicit status overrides static property", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          RouteSchema.schemaError(RouteError.NotFound, { status: 410 }),
          Route.json(function* () {
            const found = false as boolean
            if (!found) return yield* new RouteError.NotFound({ message: "Gone forever" })
            return { name: "Alice" }
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(410)
    }).pipe(Effect.runPromise),
  )

  test.it("pre-built errors work with multiple chained schemaError", () =>
    Effect.gen(function* () {
      const handler = RouteHttp.toWebHandler(
        Route.get(
          RouteSchema.schemaError(RouteError.NotFound),
          RouteSchema.schemaError(RouteError.Unauthorized),
          Route.json(function* () {
            const ok = false as boolean
            if (!ok) return yield* new RouteError.Unauthorized({ message: "No token" })
            return { name: "Alice" }
          }),
        ),
      )
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/test")

      test.expect(entity.status).toBe(401)
      test.expect(yield* entity.json).toEqual({
        _tag: "Unauthorized",
        message: "No token",
      })
    }).pipe(Effect.runPromise),
  )
})
