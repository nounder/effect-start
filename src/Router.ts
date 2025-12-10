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
  layers: Route.RouteLayer[]
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
  readonly globalLayers: readonly Route.RouteLayer[]
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
      builder.globalLayers,
    )
  }

  const newEntry: RouterEntry = {
    path,
    route,
    layers: [...builder.globalLayers],
  }

  return make([...builder.entries, newEntry], builder.globalLayers)
}

function addGlobalLayer<E, R>(
  builder: Router<E, R>,
  layerRoute: Route.RouteLayer,
): Router<E, R> {
  const newGlobalLayers = [...builder.globalLayers, layerRoute]
  return make(builder.entries, newGlobalLayers)
}

function findMatchingLayerRoutes(
  route: Route.Route.Default,
  layers: readonly Route.RouteLayer[],
): Route.Route.Default[] {
  const matchingRoutes: Route.Route.Default[] = []
  for (const layer of layers) {
    for (const layerRoute of layer.set) {
      if (Route.matches(layerRoute, route)) {
        matchingRoutes.push(layerRoute)
      }
    }
  }
  return matchingRoutes
}

function wrapWithLayerRoute(
  innerRoute: Route.Route.Default,
  layerRoute: Route.Route.Default,
): Route.Route.Default {
  const handler: Route.RouteHandler = (context) => {
    const contextWithNext: Route.RouteContext = {
      ...context,
      next: () => innerRoute.handler(context),
    }
    return layerRoute.handler(contextWithNext)
  }

  return Route.make({
    method: layerRoute.method,
    media: layerRoute.media,
    handler,
    schemas: {},
  })
}

function applyLayersToRoute(
  route: Route.Route.Default,
  layers: readonly Route.RouteLayer[],
): Route.Route.Default {
  const matchingLayerRoutes = findMatchingLayerRoutes(route, layers)
  let wrappedRoute = route

  for (const layerRoute of matchingLayerRoutes.reverse()) {
    wrappedRoute = wrapWithLayerRoute(wrappedRoute, layerRoute)
  }

  return wrappedRoute
}

function applyLayersToRouteSet(
  routeSet: Route.RouteSet.Default,
  layers: readonly Route.RouteLayer[],
): Route.RouteSet.Default {
  if (layers.length === 0) {
    return routeSet
  }

  const wrappedRoutes = routeSet.set.map((route) =>
    applyLayersToRoute(route, layers)
  )

  return {
    set: wrappedRoutes,
    schema: routeSet.schema,
  } as unknown as Route.RouteSet.Default
}

export function make<E, R>(
  entries: readonly RouterEntry[],
  globalLayers: readonly Route.RouteLayer[] = [],
): Router<E, R> {
  const mounts: Record<`/${string}`, Route.RouteSet.Default> = {}

  for (const entry of entries) {
    if (entry.route.set.length > 0) {
      mounts[entry.path] = applyLayersToRouteSet(entry.route, entry.layers)
    }
  }

  return Object.assign(
    Object.create(Proto),
    {
      entries,
      globalLayers,
      mounts,
    },
  )
}

export function isRouter(input: unknown): input is Router.Any {
  return Predicate.hasProperty(input, TypeId)
}

export function use<
  S extends Self,
>(
  this: S,
  layerRoute: Route.RouteLayer,
): S extends Router<infer E, infer R> ? Router<E, R>
  : Router<never, never>
{
  const router = isRouter(this)
    ? this
    : make<never, never>([], [])

  return addGlobalLayer(router, layerRoute) as any
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
