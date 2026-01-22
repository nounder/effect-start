import * as Predicate from "effect/Predicate"
import * as PathPattern from "./PathPattern.ts"
import * as Route from "./Route.ts"
import * as RouteMount from "./RouteMount.ts"

const TypeId: unique symbol = Symbol.for("effect-start/RouteTree")
const RouteTreeRoutes: unique symbol = Symbol()

type MethodRoute = Route.Route.With<{ method: string }>

export type RouteTuple = Iterable<MethodRoute>

export type LayerRoute = Iterable<Route.Route.With<{ method: "*" }>>

type LayerKey = "*"
const LayerKey: LayerKey = "*"

export type InputRouteMap = {
  [LayerKey]?: LayerRoute
} & {
  [path: PathPattern.PathPattern]: RouteTuple | RouteTree
}

export type RouteMap = {
  [path: PathPattern.PathPattern]: Route.Route.Tuple
}

export type Routes<
  T extends RouteTree,
> = T[typeof RouteTreeRoutes]

export interface RouteTree<
  Routes extends RouteMap = RouteMap,
> {
  [TypeId]: typeof TypeId
  [RouteTreeRoutes]: Routes
}

function routes<
  Routes extends RouteMap,
>(
  tree: RouteTree<Routes>,
): Routes {
  return tree[RouteTreeRoutes]
}

// segment priority: static (0) < :param (1) < :param? (2) < :param+ (3) < :param* (4)
function sortScore(path: string): number {
  const segments = path.split("/")
  const greedyIdx = segments.findIndex((s) =>
    s.endsWith("*") || s.endsWith("+")
  )
  const maxPriority = Math.max(
    ...segments.map((s) =>
      !s.startsWith(":")
        ? 0
        : s.endsWith("*")
        ? 4
        : s.endsWith("+")
        ? 3
        : s.endsWith("?")
        ? 2
        : 1
    ),
    0,
  )

  return greedyIdx === -1
    // non-greedy: sort by depth, then by max segment priority
    ? (segments.length << 16) + (maxPriority << 8)
    // greedy: sort after non-greedy, by greedy position (later = first), then priority
    : (1 << 24) + ((16 - greedyIdx) << 16) + (maxPriority << 8)
}

function sortRoutes(input: RouteMap): RouteMap {
  const keys = Object.keys(input).sort((a, b) =>
    sortScore(a) - sortScore(b) || a.localeCompare(b)
  )
  const sorted: RouteMap = {}
  for (const key of keys) {
    sorted[key as PathPattern.PathPattern] =
      input[key as PathPattern.PathPattern]
  }
  return sorted
}

type PrefixKeys<T, Prefix extends string> = {
  [K in keyof T as K extends string ? `${Prefix}${K}` : never]: T[K]
}

type InferItems<T> = T extends Route.RouteSet.Data<any, any, infer M> ? M
  : []

type LayerItems<T extends InputRouteMap> = "*" extends keyof T
  ? InferItems<T["*"]>
  : []

type FlattenRouteMap<T extends InputRouteMap> =
  & {
    [K in Exclude<keyof T, "*"> as T[K] extends RouteTree ? never : K]: [
      ...LayerItems<T>,
      ...InferItems<T[K]>,
    ]
  }
  & UnionToIntersection<FlattenNested<T, Exclude<keyof T, "*">, LayerItems<T>>>

type FlattenNested<
  T,
  K,
  L extends Route.Route.Tuple,
> = K extends keyof T
  ? T[K] extends RouteTree<infer R>
    ? PrefixKeys<PrependLayers<R, L>, K & string>
  : {}
  : {}

type PrependLayers<T extends RouteMap, L extends Route.Route.Tuple> = {
  [K in keyof T]: T[K] extends Route.Route.Tuple ? [...L, ...T[K]] : never
}

type UnionToIntersection<U> = (
  U extends any ? (x: U) => void : never
) extends (x: infer I) => void ? I
  : never

export function make<
  const Routes extends InputRouteMap,
>(
  input: Routes,
): RouteTree<FlattenRouteMap<Routes>> {
  const layerRoutes = [...(input[LayerKey] ?? [])]
  const merged: RouteMap = {}

  function flatten(
    map: InputRouteMap,
    prefix: string,
    layers: MethodRoute[],
  ): void {
    for (const key of Object.keys(map)) {
      if (key === LayerKey) continue
      const path = key as PathPattern.PathPattern
      const entry = map[path]
      const fullPath = `${prefix}${path}` as PathPattern.PathPattern

      if (isRouteTree(entry)) {
        flatten(routes(entry), fullPath, layers)
      } else {
        merged[fullPath] = [...layers, ...(entry as RouteTuple)]
      }
    }
  }

  flatten(input, "", layerRoutes)

  return {
    [TypeId]: TypeId,
    [RouteTreeRoutes]: sortRoutes(merged),
  } as RouteTree<FlattenRouteMap<Routes>>
}

export type WalkDescriptor = {
  path: PathPattern.PathPattern
  method: string
} & Route.RouteDescriptor.Any

function* flattenRoutes(
  path: PathPattern.PathPattern,
  routes: Iterable<MethodRoute>,
): Generator<RouteMount.MountedRoute> {
  for (const route of routes) {
    const descriptor = {
      ...route[Route.RouteDescriptor],
      path,
    }
    yield Route.make(
      route.handler as any,
      descriptor,
    ) as RouteMount.MountedRoute
  }
}

export function* walk(
  tree: RouteTree,
): Generator<RouteMount.MountedRoute> {
  const _routes = routes(tree) as RouteMap

  for (const path of Object.keys(_routes) as PathPattern.PathPattern[]) {
    yield* flattenRoutes(path, _routes[path])
  }
}

export function isRouteTree(
  input: unknown,
): input is RouteTree {
  return Predicate.hasProperty(input, TypeId)
}

export interface LookupResult {
  route: RouteMount.MountedRoute
  params: Record<string, string>
}

export function lookup(
  tree: RouteTree,
  method: string,
  path: string,
): LookupResult | null {
  for (const route of walk(tree)) {
    const descriptor = Route.descriptor(route)

    if (descriptor.method !== "*" && descriptor.method !== method) continue

    const params = PathPattern.match(descriptor.path, path)
    if (params !== null) {
      return { route, params }
    }
  }
  return null
}
