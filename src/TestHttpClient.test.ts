import {
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import {
  expect,
  it,
} from "bun:test"
import {
  Effect,
  pipe,
} from "effect"
import * as TestHttpClient from "./TestHttpClient.ts"
import {
  effectFn,
} from "./testing.ts"

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

it("ok", () =>
  effect(function*() {
    const res = yield* AppClient.get("/")

    expect(
      res.status,
    )
      .toEqual(200)
    expect(
      yield* res.text,
    )
      .toEqual("Hello, World!")
  }))

it("not found", () =>
  effect(function*() {
    const res = yield* AppClient.get("/nope")

    expect(
      res.status,
    )
      .toEqual(404)
    expect(
      yield* res.text,
    )
      .toEqual("Not Found")
  }))
