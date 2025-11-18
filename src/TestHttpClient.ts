// @ts-nocheck
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientError from "@effect/platform/HttpClientError"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"

const WebHeaders = globalThis.Headers

export const make = <E = any, R = any>(
  httpApp: HttpApp.Default<E, R>,
  opts?: {
    baseUrl?: string | null
    handleRouteNotFound?: (
      e: RouteNotFound,
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse> | null
  },
): HttpClient.HttpClient.With<
  HttpClientError.HttpClientError | E,
  Exclude<
    Scope.Scope | R,
    HttpServerRequest.HttpServerRequest
  >
> =>
  HttpClient
    .make(
      (request, url, signal) => {
        const send = (
          body: BodyInit | undefined,
        ) => {
          const app = httpApp
          const serverRequest = HttpServerRequest.fromWeb(
            new Request(url.toString(), {
              method: request.method,
              headers: new WebHeaders(request.headers),
              body,
              duplex: request.body._tag === "Stream" ? "half" : undefined,
              signal,
            } as any),
          )

          return Function.pipe(
            app,
            Effect.provideService(
              HttpServerRequest.HttpServerRequest,
              serverRequest,
            ),
            Effect.andThen(HttpServerResponse.toWeb),
            Effect.andThen(res => HttpClientResponse.fromWeb(request, res)),
            opts?.handleRouteNotFound === null
              ? Function.identity
              : Effect.catchTag("RouteNotFound", e =>
                Effect
                  .succeed(HttpClientResponse.fromWeb(
                    e.request,
                    new Response("Failed with RouteNotFound", {
                      status: 404,
                    }),
                  ))),
          )
        }

        switch (
          request
            .body
            ._tag
        ) {
          case "Raw":
          case "Uint8Array":
            return send(
              request
                .body
                .body as any,
            )
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
    .pipe(
      opts?.baseUrl === null
        ? Function.identity
        : HttpClient.mapRequest(
          HttpClientRequest.prependUrl(opts?.baseUrl ?? "http://localhost"),
        ),
    )
