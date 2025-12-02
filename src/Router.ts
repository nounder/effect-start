import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as FileRouter from "./FileRouter.ts"
import * as Route from "./Route"

export type ServerModule = {
  default: Route.RouteSet.Default
}

export type LazyRoute = {
  path: `/${string}`
  load: () => Promise<ServerModule>
  layers?: ReadonlyArray<() => Promise<unknown>>
}

export type RouterManifest = {
  routes: readonly LazyRoute[]
  layers?: any[]
}

export type RouterContext = RouterManifest

export class Router extends Context.Tag("effect-start/Router")<
  Router,
  RouterContext
>() {}

export function layer(
  manifest: RouterManifest,
): Layer.Layer<Router, never, never> {
  return Layer.effect(
    Router,
    Effect.gen(function*() {
      return {
        ...manifest,
      }
    }),
  )
}

export const layerFiles = FileRouter.layer

export function layerPromise(
  load: () => Promise<RouterManifest>,
): Layer.Layer<Router, never, never> {
  return Layer.unwrapEffect(
    Effect.gen(function*() {
      const importedModule = yield* Function.pipe(
        Effect.promise(() => load()),
        Effect.orDie,
      )

      return layer(importedModule)
    }),
  )
}

const RouterBuilderTypeId: unique symbol = Symbol.for(
  "effect-start/RouterBuilder",
)

type RouterModule = typeof import("./Router.ts")

type Self =
  | RouterBuilder<any, any>
  | RouterModule
  | undefined

export type RouterEntry = {
  path: `/${string}`
  route: Route.RouteSet.Default
  layers: Route.RouteLayer[]
}

type RouterBuilderMethods = {
  use: typeof use
  mount: typeof mount
}

export interface RouterBuilder<
  out E = never,
  out R = never,
> extends Pipeable.Pipeable, RouterBuilderMethods {
  [RouterBuilderTypeId]: typeof RouterBuilderTypeId
  readonly entries: readonly RouterEntry[]
  readonly globalLayers: readonly Route.RouteLayer[]
  readonly mounts: Record<`/${string}`, Route.RouteSet.Default>
  readonly _E: () => E
  readonly _R: () => R
}

export namespace RouterBuilder {
  export type Any = RouterBuilder<any, any>

  export type Error<T> = T extends RouterBuilder<infer E, any> ? E : never
  export type Context<T> = T extends RouterBuilder<any, infer R> ? R : never
}

const RouterBuilderProto: RouterBuilderMethods & {
  [RouterBuilderTypeId]: typeof RouterBuilderTypeId
  pipe: Pipeable.Pipeable["pipe"]
} = {
  [RouterBuilderTypeId]: RouterBuilderTypeId,

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
  builder: RouterBuilder<E, R>,
  path: `/${string}`,
  route: Route.RouteSet.Default,
): RouterBuilder<E | RouteE, R | RouteR> {
  const existingEntry = builder.entries.find((e) => e.path === path)
  if (existingEntry) {
    const updatedEntry: RouterEntry = {
      ...existingEntry,
      route: Route.merge(existingEntry.route, route),
    }
    return makeBuilder(
      builder.entries.map((e) => (e.path === path ? updatedEntry : e)),
      builder.globalLayers,
    )
  }

  const newEntry: RouterEntry = {
    path,
    route,
    layers: [...builder.globalLayers],
  }

  return makeBuilder([...builder.entries, newEntry], builder.globalLayers)
}

function addGlobalLayer<E, R>(
  builder: RouterBuilder<E, R>,
  layerRoute: Route.RouteLayer,
): RouterBuilder<E, R> {
  const newGlobalLayers = [...builder.globalLayers, layerRoute]

  const updatedEntries = builder.entries.map((entry) => ({
    ...entry,
    layers: [...entry.layers, layerRoute],
  }))

  return makeBuilder(updatedEntries, newGlobalLayers)
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

function makeBuilder<E, R>(
  entries: readonly RouterEntry[],
  globalLayers: readonly Route.RouteLayer[] = [],
): RouterBuilder<E, R> {
  const mounts: Record<`/${string}`, Route.RouteSet.Default> = {}

  for (const entry of entries) {
    if (entry.route.set.length > 0) {
      mounts[entry.path] = applyLayersToRouteSet(entry.route, entry.layers)
    }
  }

  return Object.assign(Object.create(RouterBuilderProto), {
    entries,
    globalLayers,
    mounts,
  })
}

export function isRouterBuilder(input: unknown): input is RouterBuilder.Any {
  return Predicate.hasProperty(input, RouterBuilderTypeId)
}

export function use<
  S extends Self,
>(
  this: S,
  layerRoute: Route.RouteLayer,
): S extends RouterBuilder<infer E, infer R> ? RouterBuilder<E, R>
  : RouterBuilder<never, never>
{
  const builder = isRouterBuilder(this)
    ? this
    : makeBuilder<never, never>([], [])
  return addGlobalLayer(builder, layerRoute) as any
}

export function mount<
  S extends Self,
  Routes extends Route.Route.Tuple,
  Schemas extends Route.RouteSchemas,
>(
  this: S,
  path: `/${string}`,
  route: Route.RouteSet<Routes, Schemas>,
): S extends RouterBuilder<infer E, infer R> ? RouterBuilder<
    E | ExtractRouteSetError<Route.RouteSet<Routes, Schemas>>,
    R | ExtractRouteSetContext<Route.RouteSet<Routes, Schemas>>
  >
  : RouterBuilder<
    ExtractRouteSetError<Route.RouteSet<Routes, Schemas>>,
    ExtractRouteSetContext<Route.RouteSet<Routes, Schemas>>
  >
{
  const builder = isRouterBuilder(this)
    ? this
    : makeBuilder<never, never>([], [])
  return addRoute(builder, path, route as Route.RouteSet.Default) as any
}

export function fromManifest(
  manifest: RouterManifest,
): Effect.Effect<RouterBuilder.Any> {
  return Effect.gen(function*() {
    const loadedEntries = yield* Effect.forEach(
      manifest.routes,
      (lazyRoute) =>
        Effect.gen(function*() {
          const routeModule = yield* Effect.promise(() => lazyRoute.load())
          const layerModules = lazyRoute.layers
            ? yield* Effect.forEach(
              lazyRoute.layers,
              (loadLayer) => Effect.promise(() => loadLayer()),
            )
            : []

          const layers = layerModules
            .map((m: any) => m.default)
            .filter(Route.isRouteLayer)

          return {
            path: lazyRoute.path,
            route: routeModule.default,
            layers,
          }
        }),
    )

    return makeBuilder(loadedEntries, [])
  })
}
