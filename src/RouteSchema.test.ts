import * as test from "bun:test"
import {
  Effect,
  Schema,
} from "effect"
import * as Http from "./Http.ts"
import * as Route from "./Route.ts"
import * as RouteHttp from "./RouteHttp.ts"
import * as RouteMount from "./RouteMount.ts"
import * as RouteSchema from "./RouteSchema.ts"

test.describe(`${RouteSchema.schemaHeaders.name}()`, () => {
  test.it(`${RouteSchema.schemaHeaders.name} merges`, () => {
    type ExpectedBindings = {
      hello: string
      "x-custom-header": string
    }
    const route = Route
      .use(
        RouteSchema.schemaHeaders(
          Schema.Struct({
            "hello": Schema.String,
          }),
        ),
      )
      .get(
        RouteSchema.schemaHeaders(
          Schema.Struct({
            "x-custom-header": Schema.String,
          }),
        ),
        Route.html(function*(ctx) {
          test
            .expectTypeOf(ctx.headers)
            .toExtend<ExpectedBindings>()

          return `<h1>Hello, world!</h1>`
        }),
      )

    test
      .expectTypeOf<Route.Route.Context<typeof route>>()
      .toExtend<{
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
        Effect.gen(function*() {
          test
            .expectTypeOf(context)
            .toExtend<ExpectedBindings>()

          test
            .expect(context)
            .toMatchObject({
              headers,
            })

          return "Hello, World!"
        })
      ),
    )

    test
      .expectTypeOf<Route.Route.Context<typeof route>>()
      .toExtend<ExpectedBindings>()
  })
})

test.describe(`${RouteSchema.schemaCookies.name}()`, () => {
  test.it("merges cookies from schema", () => {
    type ExpectedBindings = {
      session: string
      token: string
    }
    const route = Route
      .use(
        RouteSchema.schemaCookies(
          Schema.Struct({
            "session": Schema.String,
          }),
        ),
      )
      .get(
        RouteSchema.schemaCookies(
          Schema.Struct({
            "token": Schema.String,
          }),
        ),
        Route.html(function*(ctx) {
          test
            .expectTypeOf(ctx.cookies)
            .toExtend<ExpectedBindings>()

          return `<h1>Hello, world!</h1>`
        }),
      )

    test
      .expectTypeOf<Route.Route.Context<typeof route>>()
      .toExtend<{
        cookies: ExpectedBindings
      }>()
  })

  test.it("parses cookies from request", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        RouteSchema.schemaCookies(
          Schema.Struct({
            "session": Schema.String,
          }),
        ),
        Route.text(function*(ctx) {
          return `session=${ctx.cookies.session}`
        }),
      ),
    )
    const response = await Http.fetch(handler, {
      path: "/test",
      headers: {
        "Cookie": "session=abc123",
      },
    })

    test
      .expect(response.status)
      .toBe(200)
    test
      .expect(await response.text())
      .toBe("session=abc123")
  })
})

test.describe(`${RouteSchema.schemaSearchParams.name}()`, () => {
  test.it("merges search params from schema", () => {
    type ExpectedBindings = {
      page: string
      limit: string
    }
    const route = Route
      .use(
        RouteSchema.schemaSearchParams(
          Schema.Struct({
            "page": Schema.String,
          }),
        ),
      )
      .get(
        RouteSchema.schemaSearchParams(
          Schema.Struct({
            "limit": Schema.String,
          }),
        ),
        Route.html(function*(ctx) {
          test
            .expectTypeOf(ctx.searchParams)
            .toExtend<ExpectedBindings>()

          return `<h1>Hello, world!</h1>`
        }),
      )

    test
      .expectTypeOf<Route.Route.Context<typeof route>>()
      .toExtend<{
        searchParams: ExpectedBindings
      }>()
  })

  test.it("parses search params from request", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        RouteSchema.schemaSearchParams(
          Schema.Struct({
            "page": Schema.NumberFromString,
            "limit": Schema.NumberFromString,
          }),
        ),
        Route.text(function*(ctx) {
          return `page=${ctx.searchParams.page},limit=${ctx.searchParams.limit}`
        }),
      ),
    )
    const response = await Http.fetch(handler, {
      path: "/test?page=2&limit=10",
    })

    test
      .expect(response.status)
      .toBe(200)
    test
      .expect(await response.text())
      .toBe("page=2,limit=10")
  })
})

test.describe(`${RouteSchema.schemaBodyJson.name}()`, () => {
  test.it("parses JSON body from schema", () => {
    type ExpectedBindings = {
      name: string
      age: number
    }
    const route = Route
      .post(
        RouteSchema.schemaBodyJson(
          Schema.Struct({
            name: Schema.String,
            age: Schema.Number,
          }),
        ),
        Route.json(function*(ctx) {
          test
            .expectTypeOf(ctx.body)
            .toExtend<ExpectedBindings>()

          return { received: ctx.body }
        }),
      )

    test
      .expectTypeOf<Route.Route.Context<typeof route>>()
      .toExtend<{
        body: ExpectedBindings
      }>()
  })

  test.it("parses JSON body from request", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.post(
        RouteSchema.schemaBodyJson(
          Schema.Struct({
            name: Schema.String,
            age: Schema.Number,
          }),
        ),
        Route.json(function*(ctx) {
          return { name: ctx.body.name, age: ctx.body.age }
        }),
      ),
    )
    const response = await Http.fetch(handler, {
      path: "/test",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Alice", age: 30 }),
    })

    test
      .expect(response.status)
      .toBe(200)
    test
      .expect(await response.json())
      .toEqual({ name: "Alice", age: 30 })
  })

  test.it("returns error for invalid JSON body", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.post(
        RouteSchema.schemaBodyJson(
          Schema.Struct({
            name: Schema.String,
            age: Schema.Number,
          }),
        ),
        Route.json(function*(ctx) {
          return ctx.body
        }),
      ),
    )
    const response = await Http.fetch(handler, {
      path: "/test",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Alice", age: "not a number" }),
    })

    test
      .expect(response.status)
      .toBe(500)
  })
})

test.describe(`${RouteSchema.schemaBodyUrlParams.name}()`, () => {
  test.it("parses URL params body from schema", () => {
    type ExpectedBindings = {
      username: string
      password: string
    }
    const route = Route
      .post(
        RouteSchema.schemaBodyUrlParams(
          Schema.Struct({
            username: Schema.String,
            password: Schema.String,
          }),
        ),
        Route.json(function*(ctx) {
          test
            .expectTypeOf(ctx.body)
            .toExtend<ExpectedBindings>()

          return { received: ctx.body }
        }),
      )

    test
      .expectTypeOf<Route.Route.Context<typeof route>>()
      .toExtend<{
        body: ExpectedBindings
      }>()
  })

  test.it("parses URL-encoded body from request", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.post(
        RouteSchema.schemaBodyUrlParams(
          Schema.Struct({
            username: Schema.String,
            password: Schema.String,
          }),
        ),
        Route.json(function*(ctx) {
          return { username: ctx.body.username, password: ctx.body.password }
        }),
      ),
    )
    const response = await Http.fetch(handler, {
      path: "/test",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "username=alice&password=secret123",
    })

    test
      .expect(response.status)
      .toBe(200)
    test
      .expect(await response.json())
      .toEqual({ username: "alice", password: "secret123" })
  })
})

test.describe(`${RouteSchema.schemaBodyMultipart.name}()`, () => {
  test.it("has correct type signature for multipart body", () => {
    const route = Route
      .post(
        RouteSchema.schemaBodyMultipart(
          Schema.Struct({
            name: Schema.String,
          }),
        ),
        Route.json(function*(ctx) {
          test
            .expectTypeOf(ctx.body)
            .toExtend<{ name: string }>()

          return { name: ctx.body.name }
        }),
      )

    test
      .expectTypeOf<Route.Route.Context<typeof route>>()
      .toExtend<{
        body: { name: string }
      }>()
  })
})

test.describe(`${RouteSchema.schemaBodyForm.name}()`, () => {
  test.it("has correct type signature for form body", () => {
    const route = Route
      .post(
        RouteSchema.schemaBodyForm(
          Schema.Struct({
            email: Schema.String,
          }),
        ),
        Route.json(function*(ctx) {
          test
            .expectTypeOf(ctx.body)
            .toExtend<{ email: string }>()

          return { email: ctx.body.email }
        }),
      )

    test
      .expectTypeOf<Route.Route.Context<typeof route>>()
      .toExtend<{
        body: { email: string }
      }>()
  })
})

test.describe(`${RouteSchema.schemaBodyFormJson.name}()`, () => {
  test.it("has correct type signature for form JSON body", () => {
    const route = Route
      .post(
        RouteSchema.schemaBodyFormJson(
          Schema.Struct({
            data: Schema.String,
          }),
          "metadata",
        ),
        Route.json(function*(ctx) {
          test
            .expectTypeOf(ctx.body)
            .toExtend<{ data: string }>()

          return ctx.body
        }),
      )

    test
      .expectTypeOf<Route.Route.Context<typeof route>>()
      .toExtend<{
        body: { data: string }
      }>()
  })
})
