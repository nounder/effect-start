import {
  HttpApp,
  HttpClient,
  HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import {
  Context,
  Effect,
  FiberRef,
  identity,
  Layer,
  pipe,
  Scope,
  Stream,
} from "effect"

const WebHeaders = globalThis.Headers

class TestHttpApp
  extends Context.Tag("nounder/effect-bundler/TestHttpClient/TestHttpApp")<
    TestHttpApp,
    HttpApp.Default<any>
  >()
{}

export const make = <E>(
  httpApp?: HttpApp.Default<E>,
  opts?: {
    baseUrl?: string | null
    handleRouteNotFound?: (
      e: RouteNotFound,
    ) => Effect.Effect<HttpClientResponse.HttpClientResponse> | null
  },
): HttpClient.HttpClient.With<
  HttpClientError.HttpClientError | E,
  Scope.Scope
> =>
  pipe(
    HttpClient.make(
      (request, url, signal, fiber) => {
        const context = fiber.getFiberRef(FiberRef.currentContext)
        const app: HttpApp.Default<any> = httpApp
          ?? context.unsafeMap.get(TestHttpApp.key)
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
            app,
            Effect.provideService(
              HttpServerRequest.HttpServerRequest,
              serverRequest,
            ),
            Effect.andThen(HttpServerResponse.toWeb),
            Effect.andThen(res => HttpClientResponse.fromWeb(request, res)),
            opts?.handleRouteNotFound === null
              ? identity
              : Effect.catchTag("RouteNotFound", e =>
                Effect.succeed(HttpClientResponse.fromWeb(
                  e.request,
                  new Response("Failed with RouteNotFound", {
                    status: 404,
                  }),
                ))),
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
    ),
    opts?.baseUrl === null
      ? identity
      : HttpClient.mapRequest(
        HttpClientRequest.prependUrl(opts?.baseUrl ?? "http://localhost"),
      ),
  )

const layerClient = make()

export const layer = HttpClient.layerMergedContext<never, TestHttpApp>(
  Effect.succeed(layerClient),
)

export const layerFrom = (httpApp: HttpApp.Default) =>
  pipe(
    HttpClient.layerMergedContext<never, TestHttpApp>(
      Effect.succeed(make(httpApp)),
    ),
    Layer.provideMerge(
      Layer.succeed(TestHttpApp, httpApp),
    ),
  )
