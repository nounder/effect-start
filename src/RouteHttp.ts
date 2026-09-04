import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import * as Cookies from "effect/unstable/http/Cookies"
import * as HttpEffect from "effect/unstable/http/HttpEffect"
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
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

type RouteRequirements<Routes> = Routes extends Iterable<infer Item>
  ? Item extends Route.Route<any, any, any, any, infer R> ? Exclude<
      R,
      | { readonly [Route.IntrinsicService]?: any }
      | HttpServerRequest.HttpServerRequest
      | Scope.Scope
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

const formatToMediaType = {
  json: "application/json",
  text: "text/*",
  html: "text/html",
  bytes: "application/octet-stream",
  sse: "text/event-stream",
} as const

const mediaTypeToFormat = {
  "application/json": "json",
  "text/*": "text",
  "text/html": "html",
  "application/octet-stream": "bytes",
  "text/event-stream": "sse",
} as const

const getStatusFromCause = (cause: Cause.Cause<unknown>): number => {
  for (const reason of cause.reasons) {
    if (!Cause.isFailReason(reason)) continue
    const error = reason.error as { _tag?: string }
    if (error._tag === "ParseError" || error._tag === "RequestBodyError" || error._tag === "SchemaError") return 400
  }
  return 500
}

const errorResponse = (status: number, message: string, headers?: Record<string, string>) =>
  HttpServerResponse.text(JSON.stringify({ status, message }, null, 2), {
    status,
    headers: { "content-type": "application/json", ...headers },
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

interface MethodPlan {
  readonly hasMethodRoutes: boolean
  readonly upgradeRequired: boolean
  readonly matchingRoutes: Array<UnboundedRouteWithMethod>
  readonly formats: Array<Exclude<RouteBody.Format, "*">>
  readonly mediaTypes: Array<string>
  readonly hasSpecificFormatRoutes: boolean
  readonly hasWildcardFormatRoutes: boolean
  readonly varyAccept: boolean
  readonly routePath: string | undefined
}

const makeMethodPlan = (
  allRoutes: Array<UnboundedRouteWithMethod>,
  method: string,
  isUpgrade: boolean,
): MethodPlan => {
  const methodRoutes = allRoutes.filter((route) => {
    const routeMethod = Route.descriptor(route).method?.toUpperCase()
    return routeMethod === "*" || routeMethod === method || (method === "HEAD" && routeMethod === "GET")
  })
  const isWildcard = (route: UnboundedRouteWithMethod) => Route.descriptor<{ method?: string }>(route).method === "*"
  const protocolMatches = (route: UnboundedRouteWithMethod) =>
    (Route.descriptor<{ protocol?: "ws" }>(route).protocol === "ws") === isUpgrade
  const matchingRoutes = methodRoutes.filter((route) => isWildcard(route) || protocolMatches(route))
  const concreteRoutes = methodRoutes.filter((route) => !isWildcard(route))
  const negotiable = new Set(
    matchingRoutes
      .filter((route) => !isWildcard(route))
      .map((route) => Route.descriptor(route).format)
      .filter((format): format is Exclude<RouteBody.Format, "*"> => Boolean(format) && format !== "*"),
  )
  const formats = (Object.keys(formatToMediaType) as Array<keyof typeof formatToMediaType>)
    .filter((format) => negotiable.has(format))
  const specificFormats = new Set<string>()
  let hasWildcardFormatRoutes = false
  for (const route of matchingRoutes) {
    const format = Route.descriptor(route).format
    if (format === "*") hasWildcardFormatRoutes = true
    else if (format) specificFormats.add(format)
  }
  return {
    hasMethodRoutes: methodRoutes.length > 0,
    upgradeRequired: concreteRoutes.length > 0 && !concreteRoutes.some(protocolMatches),
    matchingRoutes,
    formats,
    mediaTypes: formats.map((format) => formatToMediaType[format]),
    hasSpecificFormatRoutes: specificFormats.size > 0,
    hasWildcardFormatRoutes,
    varyAccept: specificFormats.size > 1,
    routePath: matchingRoutes.length === 0 ? undefined : Route.descriptor<{ path?: string }>(matchingRoutes[0]).path,
  }
}

const selectedFormat = (accept: string | undefined, plan: MethodPlan): RouteBody.Format | undefined => {
  if (plan.mediaTypes.length === 0) return undefined
  if (!accept) return plan.formats[0]
  const negotiated = ContentNegotiation.media(accept, plan.mediaTypes)
  return negotiated.length === 0 ? undefined : mediaTypeToFormat[negotiated[0]]
}

export const handler = <R>(routes: Iterable<UnboundedRouteWithMethod>): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  never,
  HttpServerRequest.HttpServerRequest | Exclude<R, Route.Request>
> => {
  const allRoutes = Array.from(routes)
  const methods = new Set<string>()
  for (const route of allRoutes) {
    const method = Route.descriptor(route).method?.toUpperCase()
    if (method && method !== "*") methods.add(method)
  }
  if (methods.has("GET")) methods.add("HEAD")
  const allow = Array.from(methods).join(", ")

  return Effect
    .gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const method = request.method.toUpperCase()
      const isUpgrade = method === "GET" && (request.headers.upgrade ?? "").toLowerCase() === "websocket"
      const plan = makeMethodPlan(allRoutes, method, isUpgrade)
      if (!plan.hasMethodRoutes) {
        return method === "OPTIONS" || methods.size === 0
          ? HttpServerResponse.empty({ status: 204, headers: { allow } })
          : errorResponse(405, "method not allowed", { allow })
      }
      if (plan.upgradeRequired) return HttpServerResponse.empty({ status: 426, headers: { upgrade: "websocket" } })
      const format = selectedFormat(request.headers.accept, plan)
      if (!isUpgrade && format === undefined && plan.hasSpecificFormatRoutes && !plan.hasWildcardFormatRoutes) {
        return errorResponse(406, "not acceptable")
      }

      let index = 0
      const runNext = (): Effect.Effect<Entity.Entity<any>, any, any> => {
        if (index >= plan.matchingRoutes.length) {
          return Effect.succeed(Entity.make({ status: 404, message: "route not found" }, { status: 404 }))
        }
        const route = plan.matchingRoutes[index++]
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
          if (plan.varyAccept) response = HttpServerResponse.setHeader(response, "vary", "Accept")
          if (plan.routePath !== undefined) yield* Effect.annotateCurrentSpan("http.route", plan.routePath)
          if (method === "HEAD" && response.body._tag === "Stream") {
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
            const status = getStatusFromCause(cause)
            const development = yield* Development.option
            return errorResponse(status, Option.isSome(development) ? Cause.pretty(cause) : "Internal Server Error")
          })
      ),
    )
}

export const tracedHandler = <R>(routes: Iterable<UnboundedRouteWithMethod>) =>
  RouteHttpTracer.tracer(handler<R>(routes))

export const toWebHandlerWith =
  <R>(context: Context.Context<R>) =>
  <const Routes extends Iterable<UnboundedRouteWithMethod>>(routes: RoutesProvidedBy<Routes, R>): Http.WebHandler =>
    HttpEffect.toWebHandlerWith<
      R,
      R | HttpServerRequest.HttpServerRequest | Scope.Scope,
      never
    >(
      Context.add(context, HttpMiddleware.TracerDisabledWhen, () => true),
    )(tracedHandler<R>(routes))

export const toWebHandler = <const Routes extends Iterable<UnboundedRouteWithMethod>>(
  routes: RoutesProvidedBy<Routes, never>,
): Http.WebHandler => toWebHandlerWith(Context.empty())(routes)

export function* walkHandles(
  map: RouteMap.RouteMap,
  context: Context.Context<any> = Context.empty() as Context.Context<any>,
): Generator<[path: string, handler: Http.WebHandler]> {
  const pathGroups = new Map<string, Array<RouteMount.MountedRoute>>()
  const inDevelopment = Option.isSome(Context.getOption(context, Development.Development))
  const developmentPaths = new Set<string>()
  for (const route of RouteMap.walk(map)) {
    const descriptor = Route.descriptor<{ dev?: boolean; method?: string; path: string }>(route)
    if (descriptor.dev === true && descriptor.method === "*") developmentPaths.add(descriptor.path)
  }
  for (const route of RouteMap.walk(map)) {
    const descriptor = Route.descriptor<{ dev?: boolean; path: string }>(route)
    if (descriptor.dev === true || (!inDevelopment && developmentPaths.has(descriptor.path))) continue
    const path = descriptor.path
    const group = pathGroups.get(path) ?? []
    group.push(route)
    pathGroups.set(path, group)
  }
  const makeHandler = toWebHandlerWith(context)
  for (const [path, routes] of pathGroups) yield [path, makeHandler(routes)]
}
