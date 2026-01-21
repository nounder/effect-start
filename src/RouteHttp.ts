import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Runtime from "effect/Runtime"
import * as ContentNegotiation from "./ContentNegotiation.ts"
import * as Http from "./Http.ts"
import * as Route from "./Route.ts"
import * as RouteBody from "./RouteBody.ts"
import * as RouteMount from "./RouteMount.ts"
import * as RouteTree from "./RouteTree.ts"

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

function getMediaType(format: string | undefined): string | undefined {
  return format && format in formatToMediaType
    ? formatToMediaType[format]
    : undefined
}

function acceptsFormat(
  accept: string | null,
  format: string | undefined,
): boolean {
  if (!format) return true
  const mediaType = getMediaType(format)
  if (!mediaType) return true
  if (!accept) return true
  return ContentNegotiation.media(accept, [mediaType]).length > 0
}

type Handler = (
  context: any,
  next: (context: any) => Effect.Effect<any, any, any>,
) => Effect.Effect<any, any, any>

type Next = (context: any) => Effect.Effect<any, any, any>

const composeHandlers = (handlers: Handler[]): Handler =>
  (context, finalNext) =>
    handlers.reduceRight<Next>(
      (next, handler) => (ctx) => handler(ctx, next),
      finalNext,
    )(context)

export const toWebHandlerRuntime = <R>(
  runtime: Runtime.Runtime<R>,
) => {
  const run = Runtime.runPromise(runtime)

  return (
    routes: Iterable<
      UnboundedRouteWithMethod
    >,
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

      const wrapHandler = (route: UnboundedRouteWithMethod): Handler => {
        const descriptor = Route.descriptor(route)
        const format = descriptor.format
        const handler = route.handler as Handler

        return (context, next) => {
          if (!acceptsFormat(accept, format)) {
            return next(context)
          }

          const enrichedContext = { ...context, ...descriptor }
          return Effect.map(
            handler(enrichedContext, next),
            (result) => toResponse(result, format),
          )
        }
      }

      const notAcceptableHandler: Handler = () =>
        Effect.succeed(new Response("Not Acceptable", { status: 406 }))

      const composedHandler = composeHandlers([
        ...wildcards.map(wrapHandler),
        ...methodRoutes.map(wrapHandler),
        notAcceptableHandler,
      ])

      const effect = composedHandler(
        { request } as any,
        () => Effect.succeed(undefined),
      )

      const httpServerRequest = HttpServerRequest.fromWeb(request)

      return run(
        effect.pipe(
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            httpServerRequest,
          ),
          Effect.catchAllCause((cause) =>
            Effect.succeed(
              new Response(Cause.pretty(cause), { status: 500 }),
            )
          ),
        ),
      )
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


