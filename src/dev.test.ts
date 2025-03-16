import { expect, it } from "bun:test"
import { App } from "./dev.ts"
import * as TestHttpClient from "./effect/TestHttpClient.ts"
import { effectFn } from "./test.ts"

const effect = effectFn()

const AppClient = TestHttpClient.make(App)

it("yo", () =>
  effect(function*() {
    const res = yield* AppClient.get("/yo")

    expect(res.status).toEqual(200)
    expect(yield* res.text).toEqual("yo")
  }))

it("error", () =>
  effect(function*() {
    const res = yield* AppClient.get("/error")

    expect(res.status).toEqual(200)
    expect(yield* res.json).toMatchObject({
      error: "Error",
      message: "custom error",
    })
  }))
