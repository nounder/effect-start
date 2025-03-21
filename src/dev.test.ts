import { expect, it } from "bun:test"
import { ServerApp } from "./dev.ts"
import * as TestHttpClient from "./effect/TestHttpClient.ts"
import { effectFn } from "./test.ts"

const effect = effectFn()

const Client = TestHttpClient.make(ServerApp)

it("yo", () =>
  effect(function*() {
    const res = yield* Client.get("/yo")

    expect(res.status).toEqual(200)
    expect(yield* res.text).toEqual("yo")
  }))

it("error", () =>
  effect(function*() {
    const res = yield* Client.get("/error")

    expect(res.status).toEqual(200)
    expect(yield* res.json).toMatchObject({
      error: "Error",
      message: "custom error",
    })
  }))

it("ssr random", () =>
  effect(function*() {
    const res = yield* Client.get("/random")

    console.log(res.status, "<-------")

    expect(res.status).toEqual(200)
    expect(yield* res.text).toInclude(">Random<")
  }))
