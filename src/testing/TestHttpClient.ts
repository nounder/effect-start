import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientError from "@effect/platform/HttpClientError"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as UrlParams from "@effect/platform/UrlParams"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import * as Function from "effect/Function"
import * as Stream from "effect/Stream"

const WebHeaders = globalThis.Headers

export type FetchHandler = (req: Request) => Response | Promise<Response>

export const isFetchHandler = (
  app: unknown,
): app is FetchHandler => typeof app === "function" && !Effect.isEffect(app)

const fromFetchHandler = (
  handler: FetchHandler,
): HttpApp.Default<never, never> =>
  Effect.gen(function*() {
    const serverRequest = yield* HttpServerRequest.HttpServerRequest
    const webRequest = serverRequest.source as Request
    const response = yield* Effect.promise(async () => handler(webRequest))
    const body = yield* Effect.promise(() => response.arrayBuffer())
    return HttpServerResponse.raw(new Uint8Array(body), {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    })
  })

export const make = <E, R>(
  appOrHandler: HttpApp.Default<E, R> | FetchHandler,
  opts?: {
    baseUrl?: string | null
    handleRouteNotFound?: (
      e: RouteNotFound,
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse> | null
  },
): HttpClient.HttpClient.With<
  HttpClientError.HttpClientError | E,
  Exclude<R, HttpServerRequest.HttpServerRequest>
> => {
  const httpApp: HttpApp.Default<E, R> = isFetchHandler(appOrHandler)
    ? fromFetchHandler(appOrHandler) as HttpApp.Default<E, R>
    : appOrHandler

  const execute = (
    request: HttpClientRequest.HttpClientRequest,
  ): Effect.Effect<
    HttpClientResponse.HttpClientResponse,
    HttpClientError.HttpClientError | E,
    Exclude<R, HttpServerRequest.HttpServerRequest>
  > => {
    const urlResult = UrlParams.makeUrl(
      request.url,
      request.urlParams,
      request.hash,
    )
    if (Either.isLeft(urlResult)) {
      return Effect.die(urlResult.left)
    }
    const url = urlResult.right
    const controller = new AbortController()
    const signal = controller.signal

    const send = (
      body: BodyInit | undefined,
    ): Effect.Effect<
      HttpClientResponse.HttpClientResponse,
      E,
      Exclude<R, HttpServerRequest.HttpServerRequest>
    > => {
      const serverRequest = HttpServerRequest.fromWeb(
        new Request(url.toString(), {
          method: request.method,
          headers: new WebHeaders(request.headers),
          body,
          duplex: request.body._tag === "Stream" ? "half" : undefined,
          signal,
        } as RequestInit),
      )

      return Function.pipe(
        httpApp,
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          serverRequest,
        ),
        Effect.andThen(HttpServerResponse.toWeb),
        Effect.andThen(res => HttpClientResponse.fromWeb(request, res)),
        opts?.handleRouteNotFound === null
          ? Function.identity
          : Effect.catchAll((e) =>
            e instanceof RouteNotFound
              ? Effect.succeed(HttpClientResponse.fromWeb(
                request,
                new Response("Failed with RouteNotFound", {
                  status: 404,
                }),
              ))
              : Effect.fail(e)
          ),
      ) as Effect.Effect<
        HttpClientResponse.HttpClientResponse,
        E,
        Exclude<R, HttpServerRequest.HttpServerRequest>
      >
    }

    switch (request.body._tag) {
      case "Raw":
      case "Uint8Array":
        return send(request.body.body as BodyInit)
      case "FormData":
        return send(request.body.formData)
      case "Stream":
        return Effect.flatMap(
          Stream.toReadableStreamEffect(request.body.stream),
          send,
        )
    }

    return send(undefined)
  }

  const client = HttpClient.makeWith(
    (requestEffect) => Effect.flatMap(requestEffect, execute),
    (request) => Effect.succeed(request),
  )

  return client.pipe(
    opts?.baseUrl === null
      ? Function.identity
      : HttpClient.mapRequest(
        HttpClientRequest.prependUrl(opts?.baseUrl ?? "http://localhost"),
      ),
  ) as HttpClient.HttpClient.With<
    HttpClientError.HttpClientError | E,
    Exclude<R, HttpServerRequest.HttpServerRequest>
  >
}
