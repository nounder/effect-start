import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as TestHttpClient from "./TestHttpClient.ts"
import { effectFn } from "./testing.ts"

const App = Effect.gen(function*() {
  const req = yield* HttpServerRequest.HttpServerRequest

  if (req.url == "/") {
    return HttpServerResponse.text("Hello, World!")
  }

  return HttpServerResponse.text("Not Found", {
    status: 404,
  })
})

const AppClient = TestHttpClient.make(App)

const effect = effectFn()

t.it("ok", () =>
  effect(function*() {
    const res = yield* AppClient.get("/")

    t
      .expect(
        res.status,
      )
      .toEqual(200)
    t
      .expect(
        yield* res.text,
      )
      .toEqual("Hello, World!")
  }))

t.it("not found", () =>
  effect(function*() {
    const res = yield* AppClient.get("/nope")

    t
      .expect(
        res.status,
      )
      .toEqual(404)
    t
      .expect(
        yield* res.text,
      )
      .toEqual("Not Found")
  }))

t.describe("FetchHandler", () => {
  const FetchClient = TestHttpClient.make((req) =>
    new Response(`Hello from ${req.url}`, { status: 200 })
  )

  t.it("works with sync handler", () =>
    effect(function*() {
      const res = yield* FetchClient.get("/test")

      t.expect(res.status).toEqual(200)
      t.expect(yield* res.text).toContain("/test")
    }))

  const AsyncFetchClient = TestHttpClient.make(async (req) => {
    await Promise.resolve()
    return new Response(`Async: ${req.method} ${new URL(req.url).pathname}`, {
      status: 201,
    })
  })

  t.it("works with async handler", () =>
    effect(function*() {
      const res = yield* AsyncFetchClient.post("/async-path")

      t.expect(res.status).toEqual(201)
      t.expect(yield* res.text).toEqual("Async: POST /async-path")
    }))
})
