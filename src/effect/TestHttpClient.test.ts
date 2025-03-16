import {
  HttpClient,
  HttpClientRequest,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { expect, it } from "bun:test"
import { Effect, flow, pipe } from "effect"
import * as TestHttpClient from "./TestHttpClient.ts"

const App = Effect.gen(function*() {
  const _req = yield* HttpServerRequest.HttpServerRequest

  return HttpServerResponse.text("Hello, World!")
})

const AppClient = TestHttpClient.make(App)

it("ok", () =>
  Effect.runPromise(
    Effect.gen(function*() {
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
    }).pipe(
      Effect.scoped,
      Effect.provide(TestHttpClient.layerFrom(App)),
    ),
  ))
