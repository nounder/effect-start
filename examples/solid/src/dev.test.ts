import { expect, it } from "bun:test"
import { effectFn, TestHttpClient } from "effect-bundler"
import * as Dev from "./dev.ts"

const effect = effectFn(Dev.layer)

const Client = TestHttpClient.make(Dev.App)

it("dev yo", () =>
  effect(function*() {
    const res = yield* Client.get("/yo")

    expect(res.status).toEqual(200)
    expect(yield* res.text).toEqual("yo")
  }))

it("dev error", () =>
  effect(function*() {
    const res = yield* Client.get("/error")

    expect(res.status).toEqual(500)
    expect(yield* res.json).toMatchObject({
      error: "Error",
      message: "custom error",
    })
  }))

it("dev random", () =>
  effect(function*() {
    const res = yield* Client.get("/random")

    expect(res.status)
      .toEqual(200)

    expect(yield* res.text)
      .toInclude(">Random<")
  }))

it("loads client bundle", () =>
  effect(function*() {
    const res = yield* Client.get("/.bundle/manifest.json")

    expect(res.status)
      .toEqual(200)
  }))
