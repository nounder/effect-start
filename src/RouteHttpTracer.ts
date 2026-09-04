import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import * as References from "effect/References"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import * as Tracer from "effect/Tracer"
import * as HttpBody from "effect/unstable/http/HttpBody"
import * as HttpEffect from "effect/unstable/http/HttpEffect"
import * as HttpServerError from "effect/unstable/http/HttpServerError"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import * as HttpTraceContext from "effect/unstable/http/HttpTraceContext"

export const currentTracerDisabledWhen = Context.Reference<
  (request: HttpServerRequest.HttpServerRequest) => boolean
>("effect-start/RouteHttpTracer/currentTracerDisabledWhen", {
  defaultValue: () => () => false,
})

export const withTracerDisabledWhen = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  predicate: (request: HttpServerRequest.HttpServerRequest) => boolean,
): Effect.Effect<A, E, R> => Effect.provideService(effect, currentTracerDisabledWhen, predicate)

export const currentSpanNameGenerator = Context.Reference<
  (request: HttpServerRequest.HttpServerRequest) => string
>("effect-start/RouteHttpTracer/currentSpanNameGenerator", {
  defaultValue: () => (request) => `http.server ${request.method}`,
})

export const withSpanNameGenerator = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  f: (request: HttpServerRequest.HttpServerRequest) => string,
): Effect.Effect<A, E, R> => Effect.provideService(effect, currentSpanNameGenerator, f)

const serverTimingTrace = (span: Tracer.Span): string =>
  `trace;desc=00-${span.traceId}-${span.spanId}-${span.sampled ? "01" : "00"}`

const annotateRequest = (
  span: Tracer.Span,
  request: HttpServerRequest.HttpServerRequest,
): void => {
  const url = new URL(request.url, "http://localhost")
  span.attribute("http.request.method", request.method)
  span.attribute("url.full", url.toString())
  span.attribute("url.path", url.pathname)
  if (url.search.length > 1) span.attribute("url.query", url.search.slice(1))
  span.attribute("url.scheme", url.protocol.slice(0, -1))
  if (request.headers["user-agent"] !== undefined) {
    span.attribute("user_agent.original", request.headers["user-agent"])
  }
  if (request.headers["content-type"] !== undefined) {
    span.attribute("http.request.header.content-type", [request.headers["content-type"]])
  }
}

const annotateResponse = (
  span: Tracer.Span,
  response: HttpServerResponse.HttpServerResponse,
): HttpServerResponse.HttpServerResponse => {
  span.attribute("http.response.status_code", response.status)
  const contentType = response.headers["content-type"]
  if (contentType !== undefined) span.attribute("http.response.header.content-type", [contentType])

  const timing = serverTimingTrace(span)
  const currentTiming = response.headers["server-timing"]
  return HttpServerResponse.setHeader(
    response,
    "server-timing",
    currentTiming === undefined ? timing : `${currentTiming}, ${timing}`,
  )
}

const provideParentToStream = (
  response: HttpServerResponse.HttpServerResponse,
  span: Tracer.Span,
): HttpServerResponse.HttpServerResponse =>
  response.body._tag === "Stream"
    ? HttpServerResponse.setBody(
      response,
      HttpBody.stream(
        Stream.provideService(response.body.stream, Tracer.ParentSpan, span),
        response.body.contentType,
        response.body.contentLength,
      ),
    )
    : response

export const tracer = <E, R>(
  app: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E,
    R | HttpServerRequest.HttpServerRequest
  >,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  E,
  R | HttpServerRequest.HttpServerRequest | Scope.Scope
> =>
  Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const tracerEnabled = yield* References.TracerEnabled
    const disabledWhen = yield* currentTracerDisabledWhen
    if (!tracerEnabled || disabledWhen(request)) return yield* app

    const spanName = yield* currentSpanNameGenerator
    const span = yield* Effect.makeSpanScoped(spanName(request), {
      parent: Option.getOrUndefined(HttpTraceContext.fromHeaders(request.headers)),
      kind: "server",
    })
    annotateRequest(span, request)
    if (request.source instanceof Request) {
      const onAbort = () => span.attribute("http.response.status_code", 499)
      request.source.signal.addEventListener("abort", onAbort, { once: true })
      yield* Effect.addFinalizer(() =>
        Effect.sync(() =>
          request.source instanceof Request && request.source.signal.removeEventListener("abort", onAbort)
        )
      )
    }

    yield* HttpEffect.appendPreResponseHandler((_request, response) => Effect.succeed(annotateResponse(span, response)))

    return yield* Effect.withParentSpan(app, span).pipe(
      Effect.map((response) => provideParentToStream(response, span)),
      Effect.onExit((exit) => {
        if (Exit.isSuccess(exit) || !Cause.hasInterrupts(exit.cause)) return Effect.void
        return Effect.map(HttpServerError.causeResponse(exit.cause), ([response]) => {
          span.attribute("http.response.status_code", response.status)
        })
      }),
    )
  })
