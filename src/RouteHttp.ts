import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as FiberId from "effect/FiberId"
import * as FiberRef from "effect/FiberRef"
import * as GlobalValue from "effect/GlobalValue"
import * as HashSet from "effect/HashSet"
import * as Option from "effect/Option"
import type * as Predicate from "effect/Predicate"
import * as Runtime from "effect/Runtime"
import * as Stream from "effect/Stream"
import * as Tracer from "effect/Tracer"
import * as ContentNegotiation from "./ContentNegotiation.ts"
import * as Http from "./Http.ts"
import * as Route from "./Route.ts"
import * as RouteBody from "./RouteBody.ts"
import * as RouteMount from "./RouteMount.ts"
import * as RouteTree from "./RouteTree.ts"
import * as StreamExtra from "./StreamExtra.ts"

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

const parentSpanFromHeaders = (
  headers: Headers,
): Option.Option<Tracer.ExternalSpan> => {
  let span = w3cTraceparent(headers)
  if (span._tag === "Some") return span

  span = b3Single(headers)
  if (span._tag === "Some") return span

  return xb3(headers)
}

type UnboundedRouteWithMethod = Route.Route.With<{
  method: RouteMount.RouteMount.Method
  format?: RouteBody.Format
}>

const formatToMediaType = {
  text: "text/plain",
  html: "text/html",
  json: "application/json",
  bytes: "application/octet-stream",
} as const

const formatToContentType = {
  text: "text/plain; charset=utf-8",
  html: "text/html; charset=utf-8",
  json: "application/json",
  bytes: "application/octet-stream",
} as const

/**
 * A synthetic fiber used to tag interruptions caused by client disconnects.
 * Number stands for HTTP status 499 "Client Closed Request".
 * This is what @effect/platform does to signal request cancelation.
 */
export const clientAbortFiberId = FiberId.runtime(-499, 0)

const isClientAbort = (cause: Cause.Cause<unknown>): boolean =>
  Cause.isInterruptedOnly(cause)
  && HashSet.some(
    Cause.interruptors(cause),
    (id) => id === clientAbortFiberId,
  )

const getStatusFromCause = (cause: Cause.Cause<unknown>): number => {
  const failure = Cause.failureOption(cause)

  if (failure._tag === "Some") {
    const error = failure.value as { _tag?: string }
    if (error._tag === "ParseError" || error._tag === "RequestBodyError") {
      return 400
    }
  }

  return 500
}

function toResponse(result: unknown, format?: string): Response {
  if (result instanceof Response) {
    return result
  }

  const contentType = format && format in formatToContentType
    ? formatToContentType[format]
    : typeof result === "string"
    ? "text/html; charset=utf-8"
    : "application/json"

  const body = contentType === "application/json"
    ? JSON.stringify(result)
    : result

  return new Response(body as BodyInit, {
    headers: { "Content-Type": contentType },
  })
}

function streamToResponse(
  stream: Stream.Stream<string | Uint8Array, unknown, unknown>,
  format: string | undefined,
  runtime: Runtime.Runtime<any>,
): Response {
  const contentType = format && format in formatToContentType
    ? formatToContentType[format as keyof typeof formatToContentType]
    : "application/octet-stream"

  const encoder = new TextEncoder()

  const byteStream = stream.pipe(
    Stream.map((chunk): Uint8Array =>
      typeof chunk === "string" ? encoder.encode(chunk) : chunk
    ),
    Stream.catchAll((error) =>
      Stream.fail(
        error instanceof Error ? error : new Error(String(error)),
      )
    ),
  )

  const readable = Stream.toReadableStreamRuntime(byteStream, runtime)

  return new Response(readable, {
    headers: { "Content-Type": contentType },
  })
}

type Handler = (
  context: any,
  next: (context: any) => Effect.Effect<any, any, any>,
) => Effect.Effect<any, any, any>

function determineSelectedFormat(
  accept: string | null,
  routes: UnboundedRouteWithMethod[],
): RouteBody.Format | undefined {
  const formats = routes
    .map((r) => Route.descriptor(r).format)
    .filter(Boolean) as RouteBody.Format[]

  const uniqueFormats = [...new Set(formats)]
  const mediaTypes = uniqueFormats
    .map((f) => formatToMediaType[f])
    .filter(Boolean)

  if (mediaTypes.length === 0) {
    return undefined
  }

  if (!accept) {
    return uniqueFormats[0]
  }

  const negotiated = ContentNegotiation.media(accept, mediaTypes)
  if (negotiated.length === 0) return undefined

  return Object
    .entries(formatToMediaType)
    .find(([_, mt]) => mt === negotiated[0])
    ?.[0] as RouteBody.Format
}

export const toWebHandlerRuntime = <R>(
  runtime: Runtime.Runtime<R>,
) => {
  const runFork = Runtime.runFork(runtime)

  return (
    routes: Iterable<UnboundedRouteWithMethod>,
  ): Http.WebHandler => {
    const grouped = Object.groupBy(
      routes,
      (route) => Route.descriptor(route).method?.toUpperCase() ?? "*",
    )
    const wildcards = grouped["*"] ?? []
    const methodGroups: {
      [method in Http.Method]?: UnboundedRouteWithMethod[]
    } = {
      GET: undefined,
      POST: undefined,
      PUT: undefined,
      PATCH: undefined,
      DELETE: undefined,
      HEAD: undefined,
      OPTIONS: undefined,
    }

    for (const method in grouped) {
      if (method !== "*") {
        methodGroups[method] = grouped[method]
      }
    }

    return (request) => {
      const method = request.method.toUpperCase()
      const accept = request.headers.get("accept")
      const methodRoutes = methodGroups[method]

      if (!methodRoutes || methodRoutes.length === 0) {
        return Promise.resolve(
          new Response("Method Not Allowed", { status: 405 }),
        )
      }

      const allRoutes = [...wildcards, ...methodRoutes]
      const selectedFormat = determineSelectedFormat(accept, allRoutes)

      if (
        selectedFormat === undefined
        && allRoutes.some((r) => Route.descriptor(r).format)
      ) {
        return Promise.resolve(
          new Response("Not Acceptable", { status: 406 }),
        )
      }

      const createChain = (
        initialContext: any,
      ): Effect.Effect<any, any, any> => {
        let index = 0
        let currentContext = initialContext
        let routePathSet = false

        const next = (passedContext?: any): Effect.Effect<any, any, any> => {
          if (index >= allRoutes.length) {
            return Effect.succeed(undefined)
          }

          // Use passed context if provided, otherwise use current context
          if (passedContext !== undefined) {
            currentContext = passedContext
          }

          const route = allRoutes[index++]
          const descriptor = Route.descriptor(route)
          const format = descriptor.format
          const handler = route.handler as unknown as Handler

          if (format && format !== selectedFormat) {
            return next()
          }

          currentContext = { ...currentContext, ...descriptor }

          const routePath = descriptor["path"]
          if (!routePathSet && routePath !== undefined) {
            routePathSet = true
            return Effect.flatMap(
              Effect.currentSpan.pipe(Effect.option),
              (spanOption) => {
                if (Option.isSome(spanOption)) {
                  spanOption.value.attribute("http.route", routePath)
                }
                return handler(currentContext, next)
              },
            )
          }

          return handler(currentContext, next)
        }

        return next()
      }

      const effect = Effect.withFiberRuntime<Response, unknown, R>(
        (fiber) => {
          const tracerDisabled =
            !fiber.getFiberRef(FiberRef.currentTracerEnabled)
            || fiber.getFiberRef(currentTracerDisabledWhen)(request)

          const url = new URL(request.url)

          const innerEffect = Effect.gen(function*() {
            const result = yield* createChain({ request, selectedFormat })

            if (result === undefined) {
              return new Response("Not Acceptable", { status: 406 })
            }

            if (StreamExtra.isStream(result)) {
              return streamToResponse(
                result as Stream.Stream<string | Uint8Array, unknown, unknown>,
                selectedFormat,
                runtime,
              )
            }

            return toResponse(result, selectedFormat)
          })

          if (tracerDisabled) {
            return innerEffect
          }

          const spanNameGenerator = fiber.getFiberRef(currentSpanNameGenerator)

          return Effect.useSpan(
            spanNameGenerator(request),
            {
              parent: Option.getOrUndefined(
                parentSpanFromHeaders(request.headers),
              ),
              kind: "server",
              captureStackTrace: false,
            },
            (span) => {
              span.attribute("http.request.method", request.method)
              span.attribute("url.full", url.toString())
              span.attribute("url.path", url.pathname)
              const query = url.search.slice(1)
              if (query !== "") {
                span.attribute("url.query", query)
              }
              span.attribute("url.scheme", url.protocol.slice(0, -1))

              const userAgent = request.headers.get("user-agent")
              if (userAgent !== null) {
                span.attribute("user_agent.original", userAgent)
              }

              return Effect.flatMap(
                Effect.exit(Effect.withParentSpan(innerEffect, span)),
                (exit) => {
                  if (exit._tag === "Success") {
                    span.attribute(
                      "http.response.status_code",
                      exit.value.status,
                    )
                  }
                  return exit
                },
              )
            },
          )
        },
      )

      return new Promise((resolve) => {
        const fiber = runFork(
          effect.pipe(
            Effect.scoped,
            Effect.catchAllCause((cause) =>
              Effect.gen(function*() {
                yield* Effect.logError(cause)
                const status = getStatusFromCause(cause)
                return new Response(Cause.pretty(cause), { status })
              })
            ),
          ),
        )

        request.signal?.addEventListener(
          "abort",
          () => {
            fiber.unsafeInterruptAsFork(clientAbortFiberId)
          },
          { once: true },
        )

        fiber.addObserver((exit) => {
          if (exit._tag === "Success") {
            resolve(exit.value)
          } else if (isClientAbort(exit.cause)) {
            resolve(new Response(null, { status: 499 }))
          } else {
            const status = getStatusFromCause(exit.cause)
            resolve(new Response(Cause.pretty(exit.cause), { status }))
          }
        })
      })
    }
  }
}

export const toWebHandler: (
  routes: Iterable<UnboundedRouteWithMethod>,
) => Http.WebHandler = toWebHandlerRuntime(Runtime.defaultRuntime)

export function* walkHandles(
  tree: RouteTree.RouteTree,
): Generator<[path: string, handler: Http.WebHandler]> {
  const pathGroups = new Map<
    string,
    Array<Route.Route.With<{ path: string; method: string }>>
  >()

  for (const route of RouteTree.walk(tree)) {
    const descriptor = Route.descriptor(route)
    const path = descriptor.path
    const routes = pathGroups.get(path) ?? []
    routes.push(route)
    pathGroups.set(path, routes)
  }

  for (const [path, routes] of pathGroups) {
    yield [path, toWebHandler(routes)]
  }
}
