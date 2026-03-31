import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as FiberId from "effect/FiberId"
import * as FiberRef from "effect/FiberRef"
import * as HashSet from "effect/HashSet"
import * as Option from "effect/Option"
import type * as ParseResult from "effect/ParseResult"
import * as Runtime from "effect/Runtime"
import * as Stream from "effect/Stream"
import * as ContentNegotiation from "./_ContentNegotiation.ts"
import * as Development from "./Development.ts"
import * as Entity from "./Entity.ts"
import type * as Http from "./_Http.ts"
import * as Route from "./Route.ts"
import type * as RouteBody from "./RouteBody.ts"
import * as RouteHttpTracer from "./RouteHttpTracer.ts"
import type * as RouteMount from "./RouteMount.ts"
import * as RouteTree from "./RouteTree.ts"
import * as StreamExtra from "./_StreamExtra.ts"

type UnboundedRouteWithMethod = Route.Route.With<{
  method: RouteMount.RouteMount.Method
  format?: RouteBody.Format
}>

// Used to match Accept headers against available route formats.
const formatToMediaType = {
  text: "text/*",
  html: "text/html",
  json: "application/json",
  bytes: "application/octet-stream",
  sse: "text/event-stream",
} as const

// Used after content negotiation to determine which format was selected.
const mediaTypeToFormat = {
  "text/*": "text",
  "text/html": "html",
  "application/json": "json",
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

function streamResponse(
  stream: Stream.Stream<unknown, unknown, unknown>,
  headers: globalThis.Headers,
  status: number,
  runtime: Runtime.Runtime<any>,
): Response {
  const encoder = new TextEncoder()
  const byteStream = (stream as Stream.Stream<unknown, unknown, never>).pipe(
    Stream.map(
      (chunk): Uint8Array =>
        typeof chunk === "string" ? encoder.encode(chunk) : (chunk as Uint8Array),
    ),
    Stream.catchAll((error) =>
      Stream.fail(error instanceof Error ? error : new Error(String(error))),
    ),
  )
  return new Response(Stream.toReadableStreamRuntime(byteStream, runtime), {
    status,
    headers,
  })
}

function toHeaders(entityHeaders: Entity.Headers, contentType: string): globalThis.Headers {
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
  runtime: Runtime.Runtime<any>,
): Effect.Effect<Response, ParseResult.ParseError> {
  const contentType = Entity.type(entity)
  const status = entity.status ?? 200
  const headers = toHeaders(entity.headers, contentType)

  if (StreamExtra.isStream(entity.body)) {
    return Effect.succeed(streamResponse(entity.body, headers, status, runtime))
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

  return Effect.succeed(streamResponse(entity.stream, headers, status, runtime))
}

type Handler = (
  context: any,
  next: (context?: Record<string, unknown>) => Entity.Entity<any, any>,
) => Effect.Effect<Entity.Entity<any>, any, any>

function determineSelectedFormat(
  accept: string | null,
  routes: Array<UnboundedRouteWithMethod>,
): RouteBody.Format | undefined {
  const formats = routes
    .filter((r) => Route.descriptor(r).method !== "*")
    .map((r) => Route.descriptor(r).format)
    .filter((f): f is Exclude<RouteBody.Format, "*"> => Boolean(f) && f !== "*")

  const uniqueFormats = [...new Set(formats)]
  const mediaTypes = uniqueFormats.map((f) => formatToMediaType[f]).filter(Boolean)

  if (mediaTypes.length === 0) {
    return undefined
  }

  if (!accept) {
    return uniqueFormats[0]
  }

  const negotiated = ContentNegotiation.media(accept, mediaTypes)
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

    return (request) =>
      new Promise((resolve) => {
        const method = request.method.toUpperCase()
        const accept = request.headers.get("accept")
        const matchingRoutes = allRoutes.filter((route) => {
          const m = Route.descriptor(route).method?.toUpperCase()
          return m === "*" || m === method || (method === "HEAD" && m === "GET")
        })

        if (matchingRoutes.length === 0) {
          if (method === "OPTIONS" || methods.size === 0) {
            return resolve(
              new Response(null, {
                status: 204,
                headers: { allow: allowedMethods },
              }),
            )
          }

          return resolve(
            respondError({ status: 405, message: "method not allowed" }, { allow: allowedMethods }),
          )
        }
        const selectedFormat = determineSelectedFormat(accept, matchingRoutes)

        const specificFormats = new Set<string>()
        let hasWildcardFormatRoutes = false
        for (const r of matchingRoutes) {
          const format = Route.descriptor(r).format
          if (format === "*") hasWildcardFormatRoutes = true
          else if (format) specificFormats.add(format)
        }
        const hasSpecificFormatRoutes = specificFormats.size > 0
        const varyAccept = specificFormats.size > 1

        if (selectedFormat === undefined && hasSpecificFormatRoutes && !hasWildcardFormatRoutes) {
          return resolve(respondError({ status: 406, message: "not acceptable" }))
        }

        const createChain = (initialContext: any): Effect.Effect<Entity.Entity<any>, any, any> => {
          let index = 0
          let currentContext = initialContext
          let routePathSet = false

          const runNext = (passedContext?: any): Effect.Effect<Entity.Entity<any>, any, any> => {
            if (passedContext !== undefined) {
              currentContext = passedContext
            }

            if (index >= matchingRoutes.length) {
              return Effect.succeed(
                Entity.make({ status: 404, message: "route not found" }, { status: 404 }),
              )
            }

            const route = matchingRoutes[index++]
            const descriptor = Route.descriptor(route)
            const format = descriptor.format
            const handler = route.handler as unknown as Handler

            if (format && format !== "*" && format !== selectedFormat) {
              return runNext()
            }

            currentContext = { ...currentContext, ...descriptor }

            const nextArg = (ctx?: any) => Entity.effect(Effect.suspend(() => runNext(ctx)))

            const routePath = descriptor["path"]
            if (!routePathSet && routePath !== undefined) {
              routePathSet = true
              return Effect.flatMap(Effect.currentSpan.pipe(Effect.option), (spanOption) => {
                if (Option.isSome(spanOption)) {
                  spanOption.value.attribute("http.route", routePath)
                }
                return handler(currentContext, nextArg)
              })
            }

            return handler(currentContext, nextArg)
          }

          return runNext()
        }

        const effect = Effect.withFiberRuntime<Response, unknown, R>((fiber) => {
          const tracerDisabled =
            !fiber.getFiberRef(FiberRef.currentTracerEnabled) ||
            fiber.getFiberRef(RouteHttpTracer.currentTracerDisabledWhen)(request)

          const url = new URL(request.url)

          const innerEffect = Effect.gen(function* () {
            const result = yield* createChain({ request, selectedFormat })

            const entity = Entity.isEntity(result) ? result : Entity.make(result, { status: 200 })

            if (entity.status === 404 && entity.body === undefined) {
              return respondError({ status: 406, message: "not acceptable" })
            }

            const response = yield* toResponse(entity, selectedFormat, runtime)
            if (varyAccept) {
              response.headers.set("vary", "Accept")
            }
            return response
          })

          if (tracerDisabled) {
            return innerEffect
          }

          const spanNameGenerator = fiber.getFiberRef(RouteHttpTracer.currentSpanNameGenerator)

          return Effect.useSpan(
            spanNameGenerator(request),
            {
              parent: Option.getOrUndefined(RouteHttpTracer.parentSpanFromHeaders(request.headers)),
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
                    span.attribute("http.response.status_code", exit.value.status)
                  }
                  return exit
                },
              )
            },
          )
        })

        const fiber = runFork(
          effect.pipe(
            Effect.scoped,
            Effect.catchAllCause((cause) =>
              Effect.gen(function* () {
                yield* Effect.logError(cause)
                const status = getStatusFromCause(cause)
                const message = inDevelopment
                  ? Cause.pretty(cause, { renderErrorCause: true })
                  : "Internal Server Error"
                return respondError({ status, message })
              }),
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

        const resolveForMethod =
          method === "HEAD"
            ? (response: Response) =>
                resolve(new Response(null, { status: response.status, headers: response.headers }))
            : resolve

        fiber.addObserver((exit) => {
          if (exit._tag === "Success") {
            resolveForMethod(exit.value)
          } else if (isClientAbort(exit.cause)) {
            resolve(respondError({ status: 499, message: "client closed request" }))
          } else {
            const status = getStatusFromCause(exit.cause)
            const message = inDevelopment
              ? Cause.pretty(exit.cause, { renderErrorCause: true })
              : "Internal Server Error"
            resolve(respondError({ status, message }))
          }
        })
      })
  }
}

export const toWebHandler: (routes: Iterable<UnboundedRouteWithMethod>) => Http.WebHandler =
  toWebHandlerRuntime(Runtime.defaultRuntime)

export function* walkHandles(
  tree: RouteTree.RouteTree,
  runtime: Runtime.Runtime<never> = Runtime.defaultRuntime,
): Generator<[path: string, handler: Http.WebHandler]> {
  const pathGroups = new Map<string, Array<RouteMount.MountedRoute>>()
  const runSync = Runtime.runSync(runtime)
  const inDevelopment = Option.isSome(runSync(Development.option))
  const developmentPaths = new Set<string>()

  for (const route of RouteTree.walk(tree)) {
    const descriptor = Route.descriptor<{ path: string; dev?: boolean }>(route)
    if (descriptor.dev === true) {
      developmentPaths.add(descriptor.path)
    }
  }

  for (const route of RouteTree.walk(tree)) {
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
