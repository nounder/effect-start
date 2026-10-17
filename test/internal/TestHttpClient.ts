import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientError from "effect/http/HttpClientError"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"

export const fromHandler = (handler: (request: Request) => Response | Promise<Response>): HttpClient.HttpClient =>
  HttpClient.make((request, _url, signal) =>
    HttpClientRequest.toWeb(request, { signal }).pipe(
      Effect.mapError((cause) =>
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ request, cause }),
        })
      ),
      Effect.flatMap((webRequest) =>
        Effect.tryPromise({
          try: () => Promise.resolve(handler(webRequest)),
          catch: (cause) =>
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({ request, cause }),
            }),
        })
      ),
      Effect.map((response) => HttpClientResponse.fromWeb(request, response)),
    )
  )
