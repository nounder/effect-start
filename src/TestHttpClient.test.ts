import {
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import * as t from "bun:test"
import {
  Effect,
  pipe,
} from "effect"
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
