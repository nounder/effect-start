import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FiberId from "effect/FiberId"
import * as FiberRef from "effect/FiberRef"
import * as GlobalValue from "effect/GlobalValue"
import * as HashSet from "effect/HashSet"
import * as Option from "effect/Option"
import type * as ParseResult from "effect/ParseResult"
import * as Runtime from "effect/Runtime"
import * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import type * as Tracer from "effect/Tracer"
import * as Development from "./Development.ts"
import * as Entity from "./Entity.ts"
import * as ContentNegotiation from "./internal/ContentNegotiation.ts"
import type * as Http from "./internal/Http.ts"
import type * as RouteBody from "./internal/RouteBody.ts"
import * as RouteMap from "./internal/RouteMap.ts"
import type * as RouteMount from "./internal/RouteMount.ts"
import * as StreamExtra from "./internal/StreamExtra.ts"
import * as Route from "./Route.ts"
import * as RouteHttpTracer from "./RouteHttpTracer.ts"

type UnboundedRouteWithMethod = Route.Route.With<{
  method: RouteMount.RouteMount.Method
  format?: RouteBody.Format
}>

// Media types offered during content negotiation. Key order defines the
// default format priority.
const formatToMediaType = {
  json: "application/json",
  text: "text/*",
  html: "text/html",
  bytes: "application/octet-stream",
  sse: "text/event-stream",
} as const

// Used after content negotiation to determine which format was selected.
const mediaTypeToFormat = {
  "application/json": "json",
  "text/*": "text",
  "text/html": "html",
  "application/octet-stream": "bytes",
  "text/event-stream": "sse",
} as const

/**
 * A synthetic fiber used to tag interruptions caused by client disconnects.
 * Number stands for HTTP status 499 "Client Closed Request".
 * This is what @effect/platform does to signal request cancelation.
 */
export const clientAbortFiberId = FiberId.runtime(-499, 0)

const isClientAbort = (cause: Cause.Cause<unknown>): boolean =>
  Cause.isInterruptedOnly(cause) &&
  HashSet.some(Cause.interruptors(cause), (id) => id === clientAbortFiberId)

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

const respondError = (
  options: { status: number; message: string },
  headers?: Record<string, string>,
): Response =>
  new Response(JSON.stringify(options, null, 2), {
    status: options.status,
    headers: { "content-type": "application/json", ...headers },
  })

const serverTimingTrace = (span: Tracer.Span): string =>
  `trace;desc=00-${span.traceId}-${span.spanId}-${span.sampled ? "01" : "00"}`

const streamOwnedScopes = GlobalValue.globalValue(
  Symbol.for("effect-start/RouteHttp/streamOwnedScopes"),
  () => new WeakSet<Scope.Scope>(),
)

function streamResponse(
  stream: Stream.Stream<unknown, unknown, unknown>,
  headers: globalThis.Headers,
  status: number,
): Effect.Effect<Response> {
  return Effect.map(Effect.runtime<never>(), (runtime) => {
    const encoder = new TextEncoder()
    let byteStream = (stream as Stream.Stream<unknown, unknown, never>).pipe(
      Stream.map(
        (chunk): Uint8Array =>
          typeof chunk === "string"
            ? encoder.encode(chunk)
            : (chunk as Uint8Array),
      ),
      Stream.catchAll((error) => Stream.fail(error instanceof Error ? error : new Error(String(error)))),
    )

    const request = Context.getOption(runtime.context, Route.Request)
    const signal = Option.isSome(request) ? request.value.signal : undefined
    if (signal !== undefined) {
      // The request fiber is already done while the body streams, so a client
      // abort has to interrupt the stream directly.
      byteStream = Stream.interruptWhen(
        byteStream,
        signal.aborted ? Effect.void : Effect.async<void>((resume) => {
          const onAbort = () => resume(Effect.void)
          signal.addEventListener("abort", onAbort, { once: true })
          return Effect.sync(() => signal.removeEventListener("abort", onAbort))
        }),
      )
    }

    const scope = Context.getOption(runtime.context, Scope.Scope)
    if (Option.isSome(scope)) {
      streamOwnedScopes.add(scope.value)
      byteStream = Stream.ensuringWith(
        byteStream,
        (exit) => Scope.close(scope.value as Scope.CloseableScope, exit),
      )
    }

    return new Response(Stream.toReadableStreamRuntime(byteStream, runtime), {
      status,
      headers,
    })
  })
}

function toHeaders(
  entityHeaders: Entity.Headers,
  contentType: string,
): globalThis.Headers {
  const headers = new Headers()
  for (const key in entityHeaders) {
    const value = entityHeaders[key]
    if (value == null) continue
    if (typeof value === "string") {
      headers.set(key, value)
    } else {
      for (const v of value) headers.append(key, v)
    }
  }
  if (!headers.has("content-type")) {
    headers.set("content-type", contentType)
  }
  return headers
}

function toResponse(
  entity: Entity.Entity<any>,
  format: string | undefined,
): Effect.Effect<Response, ParseResult.ParseError> {
  const contentType = Entity.type(entity)
  const status = entity.status ?? 200
  const headers = toHeaders(entity.headers, contentType)

  if (StreamExtra.isStream(entity.body)) {
    return streamResponse(entity.body, headers, status)
  }

  if (format === "json") {
    return Effect.map(
      entity.json as Effect.Effect<object, ParseResult.ParseError>,
      (data) => new Response(JSON.stringify(data), { status, headers }),
    )
  }

  if (format === "text" || format === "html" || format === "sse") {
    return Effect.map(
      entity.text as Effect.Effect<string, ParseResult.ParseError>,
      (text) => new Response(text, { status, headers }),
    )
  }

  if (format === "bytes") {
    return Effect.map(
      entity.bytes as Effect.Effect<Uint8Array, ParseResult.ParseError>,
      (bytes) => new Response(bytes as BodyInit, { status, headers }),
    )
  }

  return streamResponse(entity.stream, headers, status)
}

type Handler = (
  context: any,
  next: Entity.Entity<any, any>,
) => Effect.Effect<Entity.Entity<any>, any, any>

interface MethodPlan {
  hasMethodRoutes: boolean
  upgradeRequired: boolean
  matchingRoutes: Array<UnboundedRouteWithMethod>
  // Offered formats in default priority order (formatToMediaType key order).
  formats: Array<Exclude<RouteBody.Format, "*">>
  mediaTypes: Array<string>
  hasSpecificFormatRoutes: boolean
  hasWildcardFormatRoutes: boolean
  varyAccept: boolean
  routePath: string | undefined
}

function makeMethodPlan(
  allRoutes: Array<UnboundedRouteWithMethod>,
  method: string,
  isUpgrade: boolean,
): MethodPlan {
  const methodRoutes = allRoutes.filter((route) => {
    const m = Route.descriptor(route).method?.toUpperCase()
    return m === "*" || m === method || (method === "HEAD" && m === "GET")
  })

  const isWildcard = (route: UnboundedRouteWithMethod) => Route.descriptor<{ method?: string }>(route).method === "*"
  const protocolMatches = (route: UnboundedRouteWithMethod) =>
    (Route.descriptor<{ protocol?: "ws" }>(route).protocol === "ws") ===
      isUpgrade
  const matchingRoutes = methodRoutes.filter(
    (route) => isWildcard(route) || protocolMatches(route),
  )
  const concreteRoutes = methodRoutes.filter((route) => !isWildcard(route))

  const negotiable = new Set(
    matchingRoutes
      .filter((r) => !isWildcard(r))
      .map((r) => Route.descriptor(r).format)
      .filter((f): f is Exclude<RouteBody.Format, "*"> => Boolean(f) && f !== "*"),
  )
  const formats = (Object.keys(formatToMediaType) as Array<
    keyof typeof formatToMediaType
  >)
    .filter((f) => negotiable.has(f))

  const specificFormats = new Set<string>()
  let hasWildcardFormatRoutes = false
  for (const r of matchingRoutes) {
    const format = Route.descriptor(r).format
    if (format === "*") hasWildcardFormatRoutes = true
    else if (format) specificFormats.add(format)
  }

  return {
    hasMethodRoutes: methodRoutes.length > 0,
    upgradeRequired: concreteRoutes.length > 0 &&
      !concreteRoutes.some(protocolMatches),
    matchingRoutes,
    formats,
    mediaTypes: formats.map((f) => formatToMediaType[f]),
    hasSpecificFormatRoutes: specificFormats.size > 0,
    hasWildcardFormatRoutes,
    varyAccept: specificFormats.size > 1,
    // All routes in a chain share the same path (RouteMap groups them).
    routePath: matchingRoutes.length > 0
      ? Route.descriptor<{ path?: string }>(matchingRoutes[0]).path
      : undefined,
  }
}

function determineSelectedFormat(
  accept: string | null,
  plan: MethodPlan,
): RouteBody.Format | undefined {
  if (plan.mediaTypes.length === 0) {
    return undefined
  }

  if (!accept) {
    return plan.formats[0]
  }

  const negotiated = ContentNegotiation.media(accept, plan.mediaTypes)
  if (negotiated.length > 0) {
    return mediaTypeToFormat[negotiated[0]]
  }

  return undefined
}

export const toWebHandlerRuntime = <R>(runtime: Runtime.Runtime<R>) => {
  const runFork = Runtime.runFork(runtime)
  const runSync = Runtime.runSync(runtime)
  const inDevelopment = Option.isSome(runSync(Development.option))

  return (routes: Iterable<UnboundedRouteWithMethod>): Http.WebHandler => {
    const allRoutes = Array.from(routes)
    const methods = new Set<string>()
    for (const route of allRoutes) {
      const m = Route.descriptor(route).method?.toUpperCase()
      if (m && m !== "*") methods.add(m)
    }
    if (methods.has("GET") && !methods.has("HEAD")) {
      methods.add("HEAD")
    }
    const allowedMethods = Array.from(methods).join(", ")

    const plans = new Map<string, MethodPlan>()
    const planFor = (method: string, isUpgrade: boolean): MethodPlan => {
      // Unknown methods are only ever served by wildcard routes and all
      // produce the same plan, so they share one cache entry.
      const key = (methods.has(method) ? method : "*") +
        (isUpgrade ? "+upgrade" : "")
      let plan = plans.get(key)
      if (plan === undefined) {
        plan = makeMethodPlan(allRoutes, method, isUpgrade)
        plans.set(key, plan)
      }
      return plan
    }

    return (request) =>
      new Promise((resolve) => {
        // Captured when the request span is created so error responses built
        // after the span has ended can still reference the trace.
        let requestSpan: Tracer.Span | undefined
        const method = request.method.toUpperCase()
        const accept = request.headers.get("accept")
        const isUpgrade = method === "GET" &&
          (request.headers.get("upgrade") ?? "").toLowerCase() === "websocket"
        const plan = planFor(method, isUpgrade)

        if (!plan.hasMethodRoutes) {
          if (method === "OPTIONS" || methods.size === 0) {
            return resolve(
              new Response(null, {
                status: 204,
                headers: { allow: allowedMethods },
              }),
            )
          }

          return resolve(
            respondError({ status: 405, message: "method not allowed" }, {
              allow: allowedMethods,
            }),
          )
        }

        // 426 only when concrete method routes existed but the protocol
        // partition dropped all of them (e.g. a plain GET to a ws-only path or
        // an upgrade to a non-ws path). Wildcard-only paths run normally.
        if (plan.upgradeRequired) {
          return resolve(
            new Response(null, {
              status: 426,
              headers: { upgrade: "websocket" },
            }),
          )
        }
        const selectedFormat = determineSelectedFormat(accept, plan)

        if (
          !isUpgrade &&
          selectedFormat === undefined &&
          plan.hasSpecificFormatRoutes &&
          !plan.hasWildcardFormatRoutes
        ) {
          return resolve(
            respondError({ status: 406, message: "not acceptable" }),
          )
        }

        const createChain = (): Effect.Effect<Entity.Entity<any>, any, any> => {
          let index = 0

          const runNext = (): Effect.Effect<Entity.Entity<any>, any, any> => {
            if (index >= plan.matchingRoutes.length) {
              return Effect.succeed(
                Entity.make({ status: 404, message: "route not found" }, {
                  status: 404,
                }),
              )
            }

            const route = plan.matchingRoutes[index++]
            const descriptor = Route.descriptor(route)
            const format = descriptor.format
            const handler = route.handler as Handler

            if (format && format !== "*" && format !== selectedFormat) {
              return runNext()
            }

            return Effect.gen(function*() {
              const ref = yield* Route.RouteContext
              ref.context = { ...ref.context, ...descriptor }
              const nextEntity = Entity.effect(Effect.suspend(runNext))
              return yield* handler(ref.context, nextEntity)
            })
          }

          return runNext()
        }

        const effect = Effect.withFiberRuntime<
          Response,
          unknown,
          R | Scope.Scope
        >(
          (fiber) => {
            const tracerDisabled = !fiber
              .getFiberRef(FiberRef.currentTracerEnabled) ||
              fiber.getFiberRef(RouteHttpTracer.currentTracerDisabledWhen)(
                request,
              )

            const url = new URL(request.url)

            const innerEffect = Effect
              .gen(function*() {
                const result = yield* createChain()

                const entity = Entity.isEntity(result)
                  ? result
                  : Entity.make(result, { status: 200 })

                if (entity.status === 404 && entity.body === undefined) {
                  return respondError({
                    status: 406,
                    message: "not acceptable",
                  })
                }

                const response = yield* toResponse(entity, selectedFormat)
                if (plan.varyAccept) {
                  response.headers.set("vary", "Accept")
                }
                return response
              })
              .pipe(
                Effect.provideService(Route.Request, request),
                Effect.provideService(Route.RouteContext, { context: {} }),
              )

            if (tracerDisabled) {
              return innerEffect
            }

            const spanNameGenerator = fiber.getFiberRef(
              RouteHttpTracer.currentSpanNameGenerator,
            )

            // The span is bound to the request scope instead of the request
            // effect: for stream responses the scope closes when the body
            // finishes streaming, so the span covers the full response
            // instead of the handler execution time.
            return Effect.flatMap(
              Effect.makeSpanScoped(spanNameGenerator(request), {
                parent: Option.getOrUndefined(
                  RouteHttpTracer.parentSpanFromHeaders(request.headers),
                ),
                kind: "server",
                captureStackTrace: false,
              }),
              (span) => {
                requestSpan = span
                span.attribute("http.request.method", request.method)
                span.attribute("url.full", url.toString())
                span.attribute("url.path", url.pathname)
                if (plan.routePath !== undefined) {
                  span.attribute("http.route", plan.routePath)
                }
                const query = url.search.slice(1)
                if (query !== "") {
                  span.attribute("url.query", query)
                }
                span.attribute("url.scheme", url.protocol.slice(0, -1))

                const userAgent = request.headers.get("user-agent")
                if (userAgent !== null) {
                  span.attribute("user_agent.original", userAgent)
                }

                const requestContentType = request.headers.get("content-type")
                if (requestContentType !== null) {
                  span.attribute(
                    "http.request.header.content-type",
                    [requestContentType],
                  )
                }

                return Effect.flatMap(
                  Effect.exit(Effect.withParentSpan(innerEffect, span)),
                  (exit) => {
                    if (exit._tag === "Success") {
                      exit.value.headers.append("server-timing", serverTimingTrace(span))
                      span.attribute(
                        "http.response.status_code",
                        exit.value.status,
                      )
                      const contentType = exit.value.headers.get("content-type")
                      if (contentType !== null) {
                        span.attribute(
                          "http.response.header.content-type",
                          [contentType],
                        )
                      }
                    }
                    return exit
                  },
                )
              },
            )
          },
        )

        const fiber = runFork(
          Effect
            .flatMap(Scope.make(), (scope) =>
              Effect.onExit(
                Scope.extend(effect, scope),
                (exit) =>
                  Effect.suspend(() => {
                    // The error responses below are produced after the scope
                    // has closed and the span has ended, so the status they
                    // will carry has to be recorded on the span here.
                    if (requestSpan !== undefined && exit._tag === "Failure") {
                      requestSpan.attribute(
                        "http.response.status_code",
                        isClientAbort(exit.cause)
                          ? 499
                          : getStatusFromCause(exit.cause),
                      )
                    }
                    return streamOwnedScopes.has(scope)
                      ? Effect.void
                      : Scope.close(scope, exit)
                  }),
              ))
            .pipe(
              Effect.catchAllCause((cause) =>
                Effect.gen(function*() {
                  yield* Effect.logError(cause)
                  const status = getStatusFromCause(cause)
                  const message = inDevelopment
                    ? Cause.pretty(cause, { renderErrorCause: true })
                    : "Internal Server Error"
                  return respondError(
                    { status, message },
                    requestSpan && { "server-timing": serverTimingTrace(requestSpan) },
                  )
                })
              ),
            ),
        )

        // An already-aborted signal never fires the abort event.
        if (request.signal?.aborted) {
          fiber.unsafeInterruptAsFork(clientAbortFiberId)
        } else {
          request.signal?.addEventListener(
            "abort",
            () => {
              fiber.unsafeInterruptAsFork(clientAbortFiberId)
            },
            { once: true },
          )
        }

        const resolveForMethod = method === "HEAD"
          ? (response: Response) => {
            // The body is discarded for HEAD; cancel it so a stream that owns
            // the request scope still closes it.
            void response.body?.cancel()
            resolve(
              new Response(null, {
                status: response.status,
                headers: response.headers,
              }),
            )
          }
          : resolve

        fiber.addObserver((exit) => {
          const traceHeaders = requestSpan &&
            { "server-timing": serverTimingTrace(requestSpan) }
          if (exit._tag === "Success") {
            resolveForMethod(exit.value)
          } else if (isClientAbort(exit.cause)) {
            resolve(
              respondError(
                { status: 499, message: "client closed request" },
                traceHeaders,
              ),
            )
          } else {
            const status = getStatusFromCause(exit.cause)
            const message = inDevelopment
              ? Cause.pretty(exit.cause, { renderErrorCause: true })
              : "Internal Server Error"
            resolve(respondError({ status, message }, traceHeaders))
          }
        })
      })
  }
}

export const toWebHandler: (
  routes: Iterable<UnboundedRouteWithMethod>,
) => Http.WebHandler = toWebHandlerRuntime(Runtime.defaultRuntime)

export function* walkHandles(
  map: RouteMap.RouteMap,
  runtime: Runtime.Runtime<never> = Runtime.defaultRuntime,
): Generator<[path: string, handler: Http.WebHandler]> {
  const pathGroups = new Map<string, Array<RouteMount.MountedRoute>>()
  const runSync = Runtime.runSync(runtime)
  const inDevelopment = Option.isSome(runSync(Development.option))
  const developmentPaths = new Set<string>()

  for (const route of RouteMap.walk(map)) {
    const descriptor = Route.descriptor<{ path: string; dev?: boolean }>(route)
    if (descriptor.dev === true) {
      developmentPaths.add(descriptor.path)
    }
  }

  for (const route of RouteMap.walk(map)) {
    const descriptor = Route.descriptor<{ path: string; dev?: boolean }>(route)
    if (descriptor.dev === true) {
      continue
    }
    const path = descriptor.path
    if (!inDevelopment && developmentPaths.has(path)) {
      continue
    }
    const group = pathGroups.get(path) ?? []
    group.push(route)
    pathGroups.set(path, group)
  }

  const toHandler = toWebHandlerRuntime(runtime)
  for (const [path, routes] of pathGroups) {
    yield [path, toHandler(routes)]
  }
}
