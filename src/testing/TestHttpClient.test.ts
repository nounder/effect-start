import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import { effectFn } from "./index.ts"
import * as TestHttpClient from "./TestHttpClient.ts"

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

test.it("ok", () =>
  effect(function*() {
    const res = yield* AppClient.get("/")

    test
      .expect(res.status)
      .toEqual(200)
    test
      .expect(yield* res.text)
      .toEqual("Hello, World!")
  }))

test.it("not found", () =>
  effect(function*() {
    const res = yield* AppClient.get("/nope")

    test
      .expect(res.status)
      .toEqual(404)
    test
      .expect(yield* res.text)
      .toEqual("Not Found")
  }))

test.describe("FetchHandler", () => {
  const FetchClient = TestHttpClient.make((req) =>
    new Response(`Hello from ${req.url}`, { status: 200 })
  )

  test.it("works with sync handler", () =>
    effect(function*() {
      const res = yield* FetchClient.get("/test")

      test
        .expect(res.status)
        .toEqual(200)
      test
        .expect(yield* res.text)
        .toContain("/test")
    }))

  const AsyncFetchClient = TestHttpClient.make(async (req) => {
    await Promise.resolve()
    return new Response(`Async: ${req.method} ${new URL(req.url).pathname}`, {
      status: 201,
    })
  })

  test.it("works with async handler", () =>
    effect(function*() {
      const res = yield* AsyncFetchClient.post("/async-path")

      test
        .expect(res.status)
        .toEqual(201)
      test
        .expect(yield* res.text)
        .toEqual("Async: POST /async-path")
    }))
})
