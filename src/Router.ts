import * as Data from "effect/Data"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Route from "./Route.ts"

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

export type RouterEntry = {
  path: `/${string}`
  route: Route.RouteSet.Default
  middlewareRoutes: Route.Route.Default[]
}

type Methods = {
  use: typeof use
  mount: typeof mount
}

export interface Router<
  out E = never,
  out R = never,
> extends Pipeable.Pipeable, Methods {
  [TypeId]: typeof TypeId
  readonly entries: readonly RouterEntry[]
  readonly globalMiddleware: readonly Route.Route.Default[]
  readonly mounts: Record<`/${string}`, Route.RouteSet.Default>
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
  pipe: Pipeable.Pipeable["pipe"]
} = {
  [TypeId]: TypeId,

  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },

  use,
  mount,
}

type ExtractRouteSetError<T> = T extends Route.RouteSet<infer Routes, any>
  ? Routes[number] extends Route.Route<any, any, infer H, any>
    ? H extends Route.RouteHandler<any, infer E, any> ? E : never
  : never
  : never

type ExtractRouteSetContext<T> = T extends Route.RouteSet<infer Routes, any>
  ? Routes[number] extends Route.Route<any, any, infer H, any>
    ? H extends Route.RouteHandler<any, any, infer R> ? R : never
  : never
  : never

/**
 * Calculates a specificity score for a route path.
 *
 * Rules:
 * - Static segments are most specific
 * - Required params are less specific
 * - Optional params are even less specific
 * - Wildcards/catch-alls are least specific
 *
 * Examples:
 * - `/admin/users` → high specificity (all static)
 * - `/users/[id]` → medium specificity (has param)
 * - `/[[...slug]]` → low specificity (optional catch-all)
 */
function pathSpecificity(path: string): number {
  const segments = path.split("/").filter(Boolean)
  if (segments.length === 0) return 1000 // Root path `/` is very specific

  let score = 0
  for (const segment of segments) {
    if (segment.startsWith("[[...")) {
      // Optional catch-all: least specific
      score += 1
    } else if (segment.startsWith("[...")) {
      // Required catch-all: very low specificity
      score += 10
    } else if (segment.startsWith("[[")) {
      // Optional param
      score += 50
    } else if (segment.startsWith("[")) {
      // Required param
      score += 100
    } else {
      // Static segment: most specific
      score += 1000
    }
  }
  return score
}

/**
 * Inserts an entry into the entries array, maintaining sorted order by specificity.
 * More specific routes (higher score) come first.
 */
function insertSorted(
  entries: readonly RouterEntry[],
  newEntry: RouterEntry,
): RouterEntry[] {
  const newScore = pathSpecificity(newEntry.path)
  const result = [...entries]

  // Find insertion point (first entry with lower specificity)
  const insertIndex = result.findIndex(
    (e) => pathSpecificity(e.path) < newScore,
  )

  if (insertIndex === -1) {
    result.push(newEntry)
  } else {
    result.splice(insertIndex, 0, newEntry)
  }

  return result
}

function addRoute<
  E,
  R,
  RouteE,
  RouteR,
>(
  builder: Router<E, R>,
  path: `/${string}`,
  route: Route.RouteSet.Default,
): Router<E | RouteE, R | RouteR> {
  const existingEntry = builder.entries.find((e) => e.path === path)
  if (existingEntry) {
    const updatedEntry: RouterEntry = {
      ...existingEntry,
      route: Route.merge(existingEntry.route, route),
    }
    return make(
      builder.entries.map((e) => (e.path === path ? updatedEntry : e)),
      builder.globalMiddleware,
    )
  }

  const newEntry: RouterEntry = {
    path,
    route,
    middlewareRoutes: [...builder.globalMiddleware],
  }

  return make(insertSorted(builder.entries, newEntry), builder.globalMiddleware)
}

function addGlobalMiddleware<E, R>(
  builder: Router<E, R>,
  middlewareRoutes: Route.Route.Default[],
): Router<E, R> {
  const newGlobalMiddleware = [...builder.globalMiddleware, ...middlewareRoutes]
  return make(builder.entries, newGlobalMiddleware)
}

function findMatchingMiddlewareRoutes(
  route: Route.Route.Default,
  middlewareRoutes: readonly Route.Route.Default[],
): Route.Route.Default[] {
  const matchingRoutes: Route.Route.Default[] = []
  for (const mwRoute of middlewareRoutes) {
    // Skip HTTP middleware routes - they're applied at HttpApp level, not route handler level
    if (Route.isHttpMiddlewareHandler(mwRoute.handler)) {
      continue
    }
    if (Route.matches(mwRoute, route)) {
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
  routeSet: Route.RouteSet.Default,
  middlewareRoutes: readonly Route.Route.Default[],
): Route.RouteSet.Default {
  if (middlewareRoutes.length === 0) {
    return routeSet
  }

  // Filter out middleware and raw HTTP routes from the route set - only wrap content routes
  const contentRoutes = routeSet.set.filter((r) =>
    !Route.isHttpMiddlewareHandler(r.handler) && !Route.isHttpHandler(r.handler)
  )

  const wrappedRoutes = contentRoutes.map((route) =>
    applyMiddlewareToRoute(route, middlewareRoutes)
  )

  return {
    set: wrappedRoutes,
    schema: routeSet.schema,
  } as unknown as Route.RouteSet.Default
}

export function make<E, R>(
  entries: readonly RouterEntry[],
  globalMiddleware: readonly Route.Route.Default[] = [],
): Router<E, R> {
  const mounts: Record<`/${string}`, Route.RouteSet.Default> = {}

  // Entries are already sorted by specificity (via insertSorted in addRoute)
  for (const entry of entries) {
    if (entry.route.set.length > 0) {
      mounts[entry.path] = applyMiddlewareToRouteSet(
        entry.route,
        entry.middlewareRoutes,
      )
    }
  }

  return Object.assign(
    Object.create(Proto),
    {
      entries,
      globalMiddleware,
      mounts,
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
  routeSet: Route.RouteSet<Routes, Schemas>,
): S extends Router<infer E, infer R> ? Router<
    E | ExtractRouteSetError<Route.RouteSet<Routes, Schemas>>,
    R | ExtractRouteSetContext<Route.RouteSet<Routes, Schemas>>
  >
  : Router<
    ExtractRouteSetError<Route.RouteSet<Routes, Schemas>>,
    ExtractRouteSetContext<Route.RouteSet<Routes, Schemas>>
  >
{
  const router = isRouter(this)
    ? this
    : make<never, never>([], [])

  return addGlobalMiddleware(router, [...routeSet.set]) as any
}

export function mount<
  S extends Self,
  Routes extends Route.Route.Tuple,
  Schemas extends Route.RouteSchemas,
>(
  this: S,
  path: `/${string}`,
  route: Route.RouteSet<Routes, Schemas>,
): S extends Router<infer E, infer R> ? Router<
    E | ExtractRouteSetError<Route.RouteSet<Routes, Schemas>>,
    R | ExtractRouteSetContext<Route.RouteSet<Routes, Schemas>>
  >
  : Router<
    ExtractRouteSetError<Route.RouteSet<Routes, Schemas>>,
    ExtractRouteSetContext<Route.RouteSet<Routes, Schemas>>
  >
{
  const router = isRouter(this)
    ? this
    : make<never, never>([], [])

  return addRoute(
    router,
    path,
    route as Route.RouteSet.Default,
  ) as any
}
