import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientError from "effect/http/HttpClientError"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as HttpEffect from "effect/http/HttpEffect"
import * as HttpRouter from "effect/http/HttpRouter"
import type * as HttpServerRequest from "effect/http/HttpServerRequest"
import type * as Scope from "effect/Scope"

export const fromRouter = <R = never>(
  router: HttpRouter.HttpRouter,
  context: Context.Context<R> = Context.empty() as Context.Context<R>,
): HttpClient.HttpClient =>
  fromHandler(
    HttpEffect.toWebHandlerWith<
      R | HttpRouter.HttpRouter,
      HttpServerRequest.HttpServerRequest | Scope.Scope,
      never
    >(Context.add(context, HttpRouter.HttpRouter, router))(Effect.suspend(() => router.asHttpEffect())),
  )

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
