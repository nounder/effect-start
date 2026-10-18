import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Cookies from "effect/http/Cookies"
import * as HttpEffect from "effect/http/HttpEffect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServer from "effect/http/HttpServer"
import * as HttpServerError from "effect/http/HttpServerError"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import * as Development from "./Development.ts"
import * as Entity from "./Entity.ts"
import * as ContentNegotiation from "./internal/ContentNegotiation.ts"
import type * as Http from "./internal/Http.ts"
import type * as PathPattern from "./internal/PathPattern.ts"
import type * as RouteBody from "./internal/RouteBody.ts"
import * as RouteMap from "./internal/RouteMap.ts"
import type * as RouteMount from "./internal/RouteMount.ts"
import * as StreamExtra from "./internal/StreamExtra.ts"
import * as Route from "./Route.ts"

type UnboundedRouteWithMethod = Route.Route.With<{
  method: RouteMount.RouteMount.Method
  format?: RouteBody.Format
}>

type RouteRequirements<Routes> = Routes extends Iterable<infer Item>
  ? Item extends Route.Route<any, any, any, any, infer R> ? Exclude<
      R,
      RouteMap.Provided
    >
  : never
  : never

type IsAny<A> = 0 extends 1 & A ? true : false

type RoutesProvidedBy<Routes, Provided> =
  & Routes
  & (
    IsAny<RouteRequirements<Routes>> extends true ? unknown
      : [Exclude<RouteRequirements<Routes>, Provided>] extends [never] ? unknown
      : never
  )

const mediaTypeToFormat: Readonly<Record<string, Exclude<RouteBody.Format, "*"> | undefined>> = {
  "application/json": "json",
  "text/*": "text",
  "text/html": "html",
  "application/octet-stream": "bytes",
  "text/event-stream": "sse",
}

const errorResponse = (status: number, message: string) =>
  HttpServerResponse.text(JSON.stringify({ status, message }, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  })

const responseOptions = (entity: Entity.Entity<any>, contentType: string) => {
  const headers: Record<string, string | Array<string>> = {}
  let cookies = Cookies.empty
  for (const name in entity.headers) {
    const value = entity.headers[name]
    if (value == null) continue
    if (name.toLowerCase() === "set-cookie") {
      cookies = Cookies.fromSetCookie(value)
    } else {
      headers[name] = typeof value === "string" ? value : Array.from(value)
    }
  }
  return { status: entity.status ?? 200, headers, contentType, cookies }
}

const withCookies = (
  response: HttpServerResponse.HttpServerResponse,
  cookies: Cookies.Cookies,
): HttpServerResponse.HttpServerResponse =>
  Cookies.isEmpty(cookies) ? response : HttpServerResponse.mergeCookies(response, cookies)

const toResponse = (
  entity: Entity.Entity<any>,
  format: RouteBody.Format | undefined,
  context: Context.Context<any>,
): Effect.Effect<HttpServerResponse.HttpServerResponse, unknown> => {
  const contentType = Entity.type(entity)
  const options = responseOptions(entity, contentType)
  if (options.status === 304) {
    return Effect.succeed(withCookies(
      HttpServerResponse.empty({ status: options.status, headers: options.headers }),
      options.cookies,
    ))
  }
  if (StreamExtra.isStream(entity.body)) {
    const encoder = new TextEncoder()
    return Effect.succeed(withCookies(
      HttpServerResponse.stream(
        Stream.map(
          Stream.provideContext(entity.body as Stream.Stream<unknown, unknown>, context),
          (chunk) => typeof chunk === "string" ? encoder.encode(chunk) : chunk as Uint8Array,
        ),
        options,
      ),
      options.cookies,
    ))
  }
  if (format === "json") {
    return Effect.map(
      entity.json,
      (body) => withCookies(HttpServerResponse.text(JSON.stringify(body), options), options.cookies),
    )
  }
  if (format === "text" || format === "html" || format === "sse") {
    return Effect.map(entity.text, (body) => withCookies(HttpServerResponse.text(body, options), options.cookies))
  }
  if (format === "bytes") {
    return Effect.map(
      entity.bytes,
      (body) => withCookies(HttpServerResponse.uint8Array(body, options), options.cookies),
    )
  }
  return Effect.succeed(withCookies(
    HttpServerResponse.stream(
      Stream.provideContext(entity.stream as Stream.Stream<Uint8Array, unknown>, context),
      options,
    ),
    options.cookies,
  ))
}

type Handler = (context: any, next: Entity.Entity<any, any>) => Effect.Effect<Entity.Entity<any>, any, any>

const handler = (
  routes: Array<UnboundedRouteWithMethod>,
  isUpgrade = false,
): Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpRouter.Provided> => {
  const isWildcard = (route: UnboundedRouteWithMethod) => Route.descriptor(route).method === "*"
  const protocolMatches = (route: UnboundedRouteWithMethod) =>
    (Route.descriptor<{ protocol?: "ws" }>(route).protocol === "ws") === isUpgrade
  const matchingRoutes = routes.filter((route) => isWildcard(route) || protocolMatches(route))
  const concreteRoutes = routes.filter((route) => !isWildcard(route))
  if (concreteRoutes.length > 0 && !concreteRoutes.some(protocolMatches)) {
    return Effect.succeed(HttpServerResponse.empty({ status: 426, headers: { upgrade: "websocket" } }))
  }
  const negotiable = new Set<RouteBody.Format>()
  const specificFormats = new Set<RouteBody.Format>()
  let hasWildcardFormatRoutes = false
  for (const route of matchingRoutes) {
    const format = Route.descriptor(route).format
    if (format === "*") hasWildcardFormatRoutes = true
    else if (format) {
      specificFormats.add(format)
      if (!isWildcard(route) || concreteRoutes.length === 0) negotiable.add(format)
    }
  }
  const mediaTypes = Object.keys(mediaTypeToFormat).filter((mediaType) => negotiable.has(mediaTypeToFormat[mediaType]!))
  return Effect
    .gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const mediaType = request.headers.accept
        ? ContentNegotiation.media(request.headers.accept, mediaTypes)[0]
        : mediaTypes[0]
      const format = mediaTypeToFormat[mediaType]
      if (!isUpgrade && format === undefined && specificFormats.size > 0 && !hasWildcardFormatRoutes) {
        return errorResponse(406, "not acceptable")
      }

      let index = 0
      const runNext = (): Effect.Effect<Entity.Entity<any>, any, any> => {
        if (index >= matchingRoutes.length) {
          return Effect.succeed(Entity.make({ status: 404, message: "route not found" }, { status: 404 }))
        }
        const route = matchingRoutes[index++]
        const descriptor = Route.descriptor(route)
        if (descriptor.format && descriptor.format !== "*" && descriptor.format !== format) return runNext()
        return Effect.gen(function*() {
          const ref = yield* Route.RouteContext
          ref.context = { ...ref.context, ...descriptor }
          return yield* (route.handler as Handler)(ref.context, Entity.effect(Effect.suspend(runNext)))
        })
      }

      return yield* Effect
        .gen(function*() {
          const result = yield* runNext()
          const entity = Entity.isEntity(result) ? result : Entity.make(result, { status: 200 })
          if (entity.status === 404 && entity.body === undefined) return errorResponse(406, "not acceptable")
          const context = yield* Effect.context<any>()
          let response = yield* toResponse(
            entity,
            format,
            context,
          )
          if (specificFormats.size > 1) response = HttpServerResponse.setHeader(response, "vary", "Accept")
          if (request.method === "HEAD" && response.body._tag === "Stream") {
            response = HttpServerResponse.empty({
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
              cookies: response.cookies,
            })
          }
          return response
        })
        .pipe(
          Effect.provideService(Route.Request, request.source),
          Effect.provideService(Route.RouteContext, { context: {} }),
        )
    })
    .pipe(
      Effect.interruptible,
      Effect.catchCause((cause) =>
        Cause.hasInterruptsOnly(cause)
          ? Effect.failCause(Cause.fromReasons(cause.reasons.filter(Cause.isInterruptReason)))
          : Effect.gen(function*() {
            yield* Effect.logError(cause)
            const status = (yield* HttpServerError.causeResponse(cause))[0].status
            const development = yield* Development.option
            return errorResponse(status, Option.isSome(development) ? Cause.pretty(cause) : "Internal Server Error")
          })
      ),
    )
}

export const register = (map: RouteMap.RouteMap, router: HttpRouter.HttpRouter): Effect.Effect<void> =>
  Effect.gen(function*() {
    for (const path of Object.keys(map) as Array<PathPattern.PathPattern>) {
      const routes = Array.from(RouteMap.walk({ [path]: map[path] }))
      const methods = new Set<RouteMount.RouteMount.Method>(
        routes.map((route) => Route.descriptor(route).method).filter((method) => method && method !== "*"),
      )
      if (methods.size === 0 && routes.length > 0) methods.add("*")
      for (const method of methods) {
        const methodRoutes = routes.filter((route) => {
          const descriptor = Route.descriptor(route)
          return descriptor.method === "*" || descriptor.method === method
        })
        const http = handler(methodRoutes)
        const websocket = (method === "GET" || method === "*") &&
            methodRoutes.some((route) => Route.descriptor<{ protocol?: "ws" }>(route).protocol === "ws")
          ? handler(methodRoutes, true)
          : undefined
        yield* router.addAll([
          HttpRouter.route(
            method,
            path,
            (request) => {
              if (request.method === "GET" && request.headers.upgrade?.toLowerCase() === "websocket") {
                return websocket ?? Effect.succeed(HttpServerResponse.empty({
                  status: 426,
                  headers: { upgrade: "websocket" },
                }))
              }
              return http
            },
          ),
        ])
      }
    }
  })

export const toHttpRouter = (map: RouteMap.RouteMap): Effect.Effect<HttpRouter.HttpRouter> =>
  Effect.gen(function*() {
    const router = yield* HttpRouter.make.pipe(Effect.provideService(HttpRouter.RouterConfig, {
      caseSensitive: true,
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
      maxParamLength: Infinity,
    }))
    yield* register(map, router)
    return router
  })

export const toWebHandlerWith =
  <R>(context: Context.Context<R>) =>
  <const Routes extends Iterable<UnboundedRouteWithMethod>>(routes: RoutesProvidedBy<Routes, R>): Http.WebHandler => {
    const items = Array.from(routes)
    const path = items.length === 0 ? "/*" : Route.descriptor<{ path?: string }>(items[0]).path ?? "/*"
    const existing = Context.getOrUndefined(context, HttpRouter.HttpRouter)
    const router = existing ?? Effect.runSyncWith(context)(toHttpRouter({}))
    Effect.runSyncWith(context)(register({ [path]: items }, router))
    const services = Context.add(context, HttpRouter.HttpRouter, router)
    return HttpEffect.toWebHandlerWith<
      R | HttpRouter.HttpRouter,
      R | HttpServerRequest.HttpServerRequest | Scope.Scope,
      never
    >(services)(Effect.suspend(() => router.asHttpEffect()))
  }

export const toWebHandler = <const Routes extends Iterable<UnboundedRouteWithMethod>>(
  routes: RoutesProvidedBy<Routes, never>,
): Http.WebHandler => toWebHandlerWith(Context.empty())(routes)

export const layerRoutes = () =>
  Layer.effectDiscard(Effect.gen(function*() {
    const router = yield* HttpRouter.HttpRouter
    const routes = yield* Effect.serviceOption(Route.Routes)
    if (Option.isSome(routes)) yield* register(routes.value, router)
  }))

export const layer = () =>
  HttpServer
    .serve(HttpRouter.HttpRouter.use((router) => Effect.suspend(() => router.asHttpEffect())))
    .pipe(Layer.provideMerge(layerRouter()))

export const layerRouter = () =>
  Layer.effectContext(Effect.gen(function*() {
    const existing = yield* Effect.serviceOption(HttpRouter.HttpRouter)
    if (Option.isSome(existing)) {
      return Context.make(HttpRouter.HttpRouter, existing.value)
    }
    const routes = yield* Route.Routes
    return Context.make(HttpRouter.HttpRouter, yield* toHttpRouter(routes))
  }))
