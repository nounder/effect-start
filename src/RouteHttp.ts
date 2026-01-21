import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as FiberId from "effect/FiberId"
import * as HashSet from "effect/HashSet"
import * as ParseResult from "effect/ParseResult"
import * as Runtime from "effect/Runtime"
import * as Stream from "effect/Stream"
import * as ContentNegotiation from "./ContentNegotiation.ts"
import * as Http from "./Http.ts"
import * as Route from "./Route.ts"
import * as RouteBody from "./RouteBody.ts"
import * as RouteMount from "./RouteMount.ts"
import * as RouteSchema from "./RouteSchema.ts"
import * as RouteTree from "./RouteTree.ts"
import * as StreamExtra from "./StreamExtra.ts"

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

const getStatusFromCause = (
  cause: Cause.Cause<RouteSchema.RequestBodyError | ParseResult.ParseError>,
): number => {
  const failure = Cause.failureOption(cause)

  if (failure._tag === "Some") {
    const error = failure.value
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
          return handler(currentContext, next)
        }

        return next()
      }

      const effect = Effect.gen(function*() {
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
