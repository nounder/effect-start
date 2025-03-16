import {
  HttpClient,
  HttpClientRequest,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { expect, it } from "bun:test"
import { Effect, flow, Layer, pipe } from "effect"
import type { YieldWrap } from "effect/Utils"
import * as TestHttpClient from "./TestHttpClient.ts"

const makeEffectFn =
  (layer: Layer.Layer<any>) =>
  <Eff extends YieldWrap<Effect.Effect<any, any, any>>, AEff>(
    f: () => Generator<Eff, AEff, never>,
  ): Promise<any> =>
    pipe(
      Effect.gen(f),
      Effect.scoped,
      Effect.provide(layer),
      Effect.runPromise,
    )

const App = Effect.gen(function*() {
  const _req = yield* HttpServerRequest.HttpServerRequest

  return HttpServerResponse.text("Hello, World!")
})

const AppClient = TestHttpClient.from(App).pipe(
  HttpClient.filterStatusOk,
  HttpClient.mapRequest(
    HttpClientRequest.prependUrl(`http://localhost`),
  ),
)

const effect = makeEffectFn(
  TestHttpClient.layerFrom(App),
)

it("singleton", () =>
  effect(function*() {
    const res = yield* AppClient.get("/")
      .pipe(Effect.andThen(v => v.text))

    expect(res).toEqual("Hello, World!")
  }))

it("usingContext", () =>
  effect(function*() {
    const client = yield* HttpClient.HttpClient.pipe(
      Effect.andThen(
        flow(
          HttpClient.filterStatusOk,
          HttpClient.mapRequest(
            HttpClientRequest.prependUrl(`http://localhost`),
          ),
        ),
      ),
    )

    const res = yield* client.get("/")
      .pipe(Effect.andThen(v => v.text))

    expect(res).toEqual("Hello, World!")
  }))
