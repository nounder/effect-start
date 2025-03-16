import {
  HttpApp,
  HttpClientRequest,
  HttpServerResponse,
} from "@effect/platform"
import { HttpServerRequest } from "@effect/platform"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { Context, Layer, pipe } from "effect"
import * as Effect from "effect/Effect"
import * as FiberRef from "effect/FiberRef"
import * as Stream from "effect/Stream"

const WebHeaders = globalThis.Headers

type TargetHttpApp = HttpApp.Default

export class TestHttpApp
  extends Context.Tag("nounder/effect-bundler/TestHttpClient/TestHttpApp")<
    TestHttpApp,
    TargetHttpApp
  >()
{}

const client: HttpClient.HttpClient = HttpClient.make(
  (request, url, signal, fiber) => {
    const context = fiber.getFiberRef(FiberRef.currentContext)
    const httpApp: TargetHttpApp = context.unsafeMap.get(TestHttpApp.key)
    const send = (body: BodyInit | undefined) => {
      const serverRequest = HttpServerRequest.fromWeb(
        new Request(url.toString(), {
          method: request.method,
          headers: new WebHeaders(request.headers),
          body,
          duplex: request.body._tag === "Stream" ? "half" : undefined,
          signal,
        } as any),
      )

      return pipe(
        httpApp,
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          serverRequest,
        ),
        Effect.andThen(HttpServerResponse.toWeb),
        Effect.andThen(res => HttpClientResponse.fromWeb(request, res)),
      )
    }

    switch (request.body._tag) {
      case "Raw":
      case "Uint8Array":
        return send(request.body.body as any)
      case "FormData":
        return send(request.body.formData)
      case "Stream":
        return Effect.flatMap(
          Stream.toReadableStreamEffect(request.body.stream),
          send,
        )
    }

    return send(undefined)
  },
)

export const from = (httpApp: TargetHttpApp) =>
  pipe(
    client,
    HttpClient.filterStatusOk,
    HttpClient.mapRequest(
      HttpClientRequest.prependUrl(`http://localhost`),
    ),
  )

export const layer = HttpClient.layerMergedContext<never, TestHttpApp>(
  Effect.succeed(client),
)

export const layerFrom = (httpApp: TargetHttpApp) =>
  pipe(
    HttpClient.layerMergedContext<never, TestHttpApp>(
      Effect.succeed(client),
    ),
    Layer.provideMerge(
      Layer.succeed(TestHttpApp, httpApp),
    ),
  )
