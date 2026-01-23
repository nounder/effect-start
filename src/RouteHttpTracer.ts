import * as Effect from "effect/Effect"
import * as FiberRef from "effect/FiberRef"
import * as GlobalValue from "effect/GlobalValue"
import * as Option from "effect/Option"
import type * as Predicate from "effect/Predicate"
import * as Tracer from "effect/Tracer"

export const currentTracerDisabledWhen = GlobalValue.globalValue(
  Symbol.for("effect-start/RouteHttp/tracerDisabledWhen"),
  () => FiberRef.unsafeMake<Predicate.Predicate<Request>>(() => false),
)

export const withTracerDisabledWhen = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  predicate: Predicate.Predicate<Request>,
): Effect.Effect<A, E, R> =>
  Effect.locally(effect, currentTracerDisabledWhen, predicate)

export const currentSpanNameGenerator = GlobalValue.globalValue(
  Symbol.for("effect-start/RouteHttp/spanNameGenerator"),
  () =>
    FiberRef.unsafeMake<(request: Request) => string>(
      (request) => `http.server ${request.method}`,
    ),
)

export const withSpanNameGenerator = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  f: (request: Request) => string,
): Effect.Effect<A, E, R> => Effect.locally(effect, currentSpanNameGenerator, f)

const w3cTraceparent = (
  headers: Headers,
): Option.Option<Tracer.ExternalSpan> => {
  const header = headers.get("traceparent")
  if (header === null) return Option.none()

  const parts = header.split("-")
  if (parts.length < 4) return Option.none()

  const [_version, traceId, spanId, flags] = parts
  if (!traceId || !spanId) return Option.none()

  return Option.some(Tracer.externalSpan({
    spanId,
    traceId,
    sampled: flags === "01",
  }))
}

const b3Single = (headers: Headers): Option.Option<Tracer.ExternalSpan> => {
  const header = headers.get("b3")
  if (header === null) return Option.none()

  const parts = header.split("-")
  if (parts.length < 2) return Option.none()

  const [traceId, spanId, sampledStr] = parts
  if (!traceId || !spanId) return Option.none()

  return Option.some(Tracer.externalSpan({
    spanId,
    traceId,
    sampled: sampledStr === "1",
  }))
}

const xb3 = (headers: Headers): Option.Option<Tracer.ExternalSpan> => {
  const traceId = headers.get("x-b3-traceid")
  const spanId = headers.get("x-b3-spanid")
  if (traceId === null || spanId === null) return Option.none()

  const sampled = headers.get("x-b3-sampled")

  return Option.some(Tracer.externalSpan({
    spanId,
    traceId,
    sampled: sampled === "1",
  }))
}

export const parentSpanFromHeaders = (
  headers: Headers,
): Option.Option<Tracer.ExternalSpan> => {
  let span = w3cTraceparent(headers)
  if (span._tag === "Some") return span

  span = b3Single(headers)
  if (span._tag === "Some") return span

  return xb3(headers)
}
