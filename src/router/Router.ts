import * as Data from "effect/Data"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as ContentNegotiation from "../ContentNegotiation.ts"
import * as Route from "./Route.ts"
import * as RouteSet from "./RouteSet.ts"
import {
  isHttpMiddlewareHandler,
  type IsHttpMiddlewareRouteSet,
} from "./RouteSet_http.ts"

type RouterModule = typeof import("./Router.ts")

type Self =
  | Router.Any
  | RouterModule
  | undefined

export type RouterErrorReason =
  | "UnsupportedPattern"
  | "ProxyError"

export class RouterError extends Data.TaggedError("RouterError")<{
  reason: RouterErrorReason
  pattern: string
  message: string
}> {}

const TypeId: unique symbol = Symbol.for(
  "effect-start/Router",
)

type Methods = {
  use: typeof use
  mount: typeof mount
}

export interface Router<
  out E = never,
  out R = never,
> extends Pipeable.Pipeable, Methods {
  [TypeId]: typeof TypeId
  [RouteSet.TypeId]: typeof RouteSet.TypeId
  readonly mounts: Record<`/${string}`, RouteSet.RouteSet.Default>
  readonly layer: RouteSet.RouteSet.Default
  readonly set: Route.Route.Default[]
  readonly schema: Route.RouteSchemas
  readonly _E: () => E
  readonly _R: () => R
}

export namespace Router {
  export type Any = Router<any, any>
  export type Error<T> = T extends Router<infer E, any> ? E : never
  export type Requirements<T> = T extends Router<any, infer R> ? R : never
}

const Proto: Methods & {
  [TypeId]: typeof TypeId
  [RouteSet.TypeId]: typeof RouteSet.TypeId
  pipe: Pipeable.Pipeable["pipe"]
  set: Route.Route.Default[]
  schema: Route.RouteSchemas
} = {
  [TypeId]: TypeId,
  [RouteSet.TypeId]: RouteSet.TypeId,

  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },

  get set(): Route.Route.Default[] {
    const self = this as unknown as Router.Any
    const allRoutes: Route.Route.Default[] = []
    for (const routeSet of Object.values(self.mounts)) {
      allRoutes.push(...RouteSet.items(routeSet))
    }
    return allRoutes
  },

  get schema(): Route.RouteSchemas {
    return {}
  },

  use,
  mount,
}

type ExtractRouteSetError<T> = T extends RouteSet.RouteSet<infer Routes, any>
  ? Routes[number] extends Route.Route<any, any, infer H, any>
    ? H extends Route.RouteHandler<any, infer E, any> ? E : never
  : never
  : never

type ExtractRouteSetContext<T> = T extends RouteSet.RouteSet<infer Routes, any>
  ? Routes[number] extends Route.Route<any, any, infer H, any>
    ? H extends Route.RouteHandler<any, any, infer R> ? R : never
  : never
  : never

function findMatchingMiddlewareRoutes(
  route: Route.Route.Default,
  middlewareRoutes: readonly Route.Route.Default[],
): Route.Route.Default[] {
  const matchingRoutes: Route.Route.Default[] = []
  for (const mwRoute of middlewareRoutes) {
    // Skip HTTP middleware routes - they're applied at HttpApp level, not route handler level
    if (isHttpMiddlewareHandler(mwRoute.handler)) {
      continue
    }
    if (Route.overlaps(mwRoute, route)) {
      matchingRoutes.push(mwRoute)
    }
  }
  return matchingRoutes
}

function wrapWithMiddlewareRoute(
  innerRoute: Route.Route.Default,
  middlewareRoute: Route.Route.Default,
): Route.Route.Default {
  // Check if routes have BunHandlers (identified by internalPathPrefix on handler)
  const innerHasBunHandler = "internalPathPrefix" in innerRoute.handler
  const mwHasBunHandler = "internalPathPrefix" in middlewareRoute.handler

  // Skip wrapping when both inner route and middleware have BunHandlers.
  //
  // BunHandlers fetch HTML from Bun's internal HTMLBundle server and replace
  // %yield% with child content. If we wrap a BunHandler with another BunHandler,
  // both would:
  // 1. Fetch the same (or different) HTML bundle
  // 2. Try to replace %yield% with the other's output
  // 3. Result in nested <!DOCTYPE html> documents
  //
  // By returning the inner route unchanged, we let the innermost BunHandler
  // handle the HTML bundle while outer middleware is effectively skipped.
  if (innerHasBunHandler && mwHasBunHandler) {
    return innerRoute
  }

  const innerHandlerAtWrapTime = innerRoute.handler

  const handler: Route.RouteHandler = (context) => {
    const contextWithNext: Route.RouteContext = {
      ...context,
      next: () => innerHandlerAtWrapTime(context),
    }
    return middlewareRoute.handler(contextWithNext)
  }

  return Route.make({
    method: middlewareRoute.method,
    media: middlewareRoute.media,
    handler,
    schemas: {},
  })
}

function applyMiddlewareToRoute(
  route: Route.Route.Default,
  middlewareRoutes: readonly Route.Route.Default[],
): Route.Route.Default {
  const matchingMiddleware = findMatchingMiddlewareRoutes(
    route,
    middlewareRoutes,
  )
  let wrappedRoute = route

  for (const mwRoute of matchingMiddleware.reverse()) {
    wrappedRoute = wrapWithMiddlewareRoute(wrappedRoute, mwRoute)
  }

  return wrappedRoute
}

function applyMiddlewareToRouteSet(
  routeSet: RouteSet.RouteSet.Default,
): RouteSet.RouteSet.Default {
  const routes = RouteSet.items(routeSet)

  // Keep HTTP middleware routes unchanged (they're applied at HttpApp level)
  const httpMiddlewareRoutes = routes.filter((r) =>
    isHttpMiddlewareHandler(r.handler)
  )

  // Non-HTTP routes (candidates for middleware wrapping)
  const nonHttpRoutes = routes.filter((r) =>
    !isHttpMiddlewareHandler(r.handler)
  )

  if (nonHttpRoutes.length <= 1) {
    return RouteSet.make(
      [
        ...httpMiddlewareRoutes,
        ...nonHttpRoutes,
      ] as unknown as Route.Route.Tuple,
      RouteSet.schemas(routeSet),
    )
  }

  // Determine which routes are middleware vs content based on position.
  // A route is middleware if there's a LATER route in the set that it matches.
  // This works because RouteSet composition puts wrapper routes before content.
  const middlewareRoutes: Route.Route.Default[] = []
  const contentRoutes: Route.Route.Default[] = []

  for (let i = 0; i < nonHttpRoutes.length; i++) {
    const route = nonHttpRoutes[i]
    let isMiddleware = false

    for (let j = i + 1; j < nonHttpRoutes.length; j++) {
      if (Route.overlaps(route, nonHttpRoutes[j])) {
        isMiddleware = true
        break
      }
    }

    if (isMiddleware) {
      middlewareRoutes.push(route)
    } else {
      contentRoutes.push(route)
    }
  }

  if (middlewareRoutes.length === 0) {
    return RouteSet.make(
      [
        ...httpMiddlewareRoutes,
        ...contentRoutes,
      ] as unknown as Route.Route.Tuple,
      RouteSet.schemas(routeSet),
    )
  }

  const wrappedRoutes = contentRoutes.map((route) =>
    applyMiddlewareToRoute(route, middlewareRoutes)
  )

  return RouteSet.make(
    [...httpMiddlewareRoutes, ...wrappedRoutes] as unknown as Route.Route.Tuple,
    RouteSet.schemas(routeSet),
  )
}

export function make<E, R>(
  mounts: Record<`/${string}`, RouteSet.RouteSet.Default>,
  layer: RouteSet.RouteSet.Default = RouteSet.make(),
): Router<E, R> {
  // Process each mount - apply route-level middleware from its RouteSet
  const processedMounts: Record<`/${string}`, RouteSet.RouteSet.Default> = {}

  for (const [path, routeSet] of Object.entries(mounts)) {
    if (RouteSet.items(routeSet).length > 0) {
      processedMounts[path as `/${string}`] = applyMiddlewareToRouteSet(
        routeSet,
      )
    }
  }

  return Object.assign(
    Object.create(Proto),
    {
      mounts: processedMounts,
      layer,
    },
  )
}

export function isRouter(input: unknown): input is Router.Any {
  return Predicate.hasProperty(input, TypeId)
}

export function use<
  S extends Self,
  Routes extends Route.Route.Tuple,
  Schemas extends Route.RouteSchemas,
>(
  this: S,
  route: IsHttpMiddlewareRouteSet<RouteSet.RouteSet<Routes, Schemas>> extends
    true ? RouteSet.RouteSet<Routes, Schemas>
    : never,
): S extends Router<infer E, infer R> ? Router<
    E | ExtractRouteSetError<RouteSet.RouteSet<Routes, Schemas>>,
    R | ExtractRouteSetContext<RouteSet.RouteSet<Routes, Schemas>>
  >
  : Router<
    ExtractRouteSetError<RouteSet.RouteSet<Routes, Schemas>>,
    ExtractRouteSetContext<RouteSet.RouteSet<Routes, Schemas>>
  >
{
  const router = isRouter(this)
    ? this
    : make<never, never>({}, RouteSet.make())

  // Merge new HttpMiddleware into existing layer
  const newLayer = Route.merge(router.layer, route)

  // Return new router with same mounts but updated layer
  return make(router.mounts, newLayer) as any
}

export function mount<
  S extends Self,
  Routes extends Route.Route.Tuple,
  Schemas extends Route.RouteSchemas,
>(
  this: S,
  path: `/${string}`,
  route: RouteSet.RouteSet<Routes, Schemas>,
): S extends Router<infer E, infer R> ? Router<
    E | ExtractRouteSetError<RouteSet.RouteSet<Routes, Schemas>>,
    R | ExtractRouteSetContext<RouteSet.RouteSet<Routes, Schemas>>
  >
  : Router<
    ExtractRouteSetError<RouteSet.RouteSet<Routes, Schemas>>,
    ExtractRouteSetContext<RouteSet.RouteSet<Routes, Schemas>>
  >
{
  const router = isRouter(this)
    ? this
    : make<never, never>({}, RouteSet.make())

  // Merge current layer (HttpMiddleware) with the routes being mounted
  const mergedRouteSet = Route.merge(router.layer, route)

  // Add to mounts (merge if path already exists)
  const existingRouteSet = router.mounts[path]
  const finalRouteSet = existingRouteSet
    ? Route.merge(existingRouteSet, mergedRouteSet)
    : mergedRouteSet

  return make(
    { ...router.mounts, [path]: finalRouteSet },
    router.layer,
  ) as any
}

const MEDIA_PRIORITY: Route.RouteMedia[] = [
  "application/json",
  "text/plain",
  "text/html",
]

export function get(
  router: Router.Any,
  method: Route.RouteMethod,
  path: `/${string}`,
  media: Route.RouteMedia | "*/*" = "*/*",
): Route.Route.Default | undefined {
  const routeSet = router.mounts[path]
  if (!routeSet) return undefined

  const isMediaWildcard = media === "*" || media === "*/*"

  const methodMatching = RouteSet.items(routeSet).filter((route) => {
    return method === "*"
      || route.method === "*"
      || route.method === method
  })

  if (methodMatching.length === 0) return undefined

  if (isMediaWildcard) {
    // Content negotiation: return by priority order
    for (const priorityMedia of MEDIA_PRIORITY) {
      const route = methodMatching.find((r) => r.media === priorityMedia)
      if (route) return route
    }
    // Fallback to wildcard media route or first match
    return methodMatching.find((r) => r.media === "*") ?? methodMatching[0]
  }

  return methodMatching.find((route) => {
    return route.media === "*" || route.media === media
  })
}

export function matchMedia(
  routeSet: RouteSet.RouteSet.Data<
    Route.Route.Array,
    Route.RouteSchemas
  >,
  accept: string,
): Route.Route.Default | undefined {
  const routes = RouteSet.items(routeSet)

  const contentRoutes = routes.filter((r) =>
    !isHttpMiddlewareHandler(r.handler)
  )

  if (contentRoutes.length === 0) return undefined

  const availableMedia = contentRoutes
    .map((r) => r.media)
    .filter((m): m is Exclude<Route.RouteMedia, "*"> => m !== "*")

  const normalizedAccept = accept || "*/*"
  const hasWildcard = normalizedAccept.includes("*")
  const preferred = ContentNegotiation.media(normalizedAccept, availableMedia)

  if (preferred.length > 0) {
    if (hasWildcard) {
      for (const media of MEDIA_PRIORITY) {
        if (preferred.includes(media)) {
          return contentRoutes.find((r) => r.media === media)
        }
      }
    }
    return contentRoutes.find((r) => r.media === preferred[0])
  }

  return contentRoutes.find((r) => r.media === "*") ?? routes[0]
}
