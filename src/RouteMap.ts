import type * as PathPattern from "./internal/PathPattern.ts"
import type * as Values from "./internal/Values.ts"
import * as Route from "./Route.ts"
import type * as RouteMount from "./RouteMount.ts"

type MethodRoute = Route.Route.With<{ method: string }>

const LayerKey = "*"

/**
 * Map routes to its path. Under a wildcard path ("*"), the routes
 * are layer routes which are applied to all routes underneath it,
 * similar to how middlewares work.
 */
export type RouteMapInput = {
  [LayerKey]?: Iterable<Route.Route.With<{ method: "*" }>>
} & {
  [path: PathPattern.PathPattern]: Iterable<MethodRoute> | RouteMapInput
}

export type RouteMap = {
  [path: PathPattern.PathPattern]: Route.Route.Tuple
}

type PrefixKeys<T, Prefix extends string> = {
  [K in keyof T as K extends string ? `${Prefix}${K}` : never]: T[K]
}

type InferItems<T> =
  T extends Route.RouteSet.Data<any, any, infer M> ? M : T extends Route.Route.Tuple ? T : []

type LayerItems<T extends RouteMapInput> = "*" extends keyof T ? InferItems<T["*"]> : []

type IsLeaf<T> = T extends Iterable<any> ? true : false

type FlattenRouteMap<T extends RouteMapInput> = string extends keyof T
  ? RouteMap
  : {
      [K in Exclude<keyof T, "*"> as IsLeaf<T[K]> extends true ? K : never]: [
        ...LayerItems<T>,
        ...InferItems<T[K]>,
      ]
    } & UnionToIntersection<FlattenNested<T, Exclude<keyof T, "*">, LayerItems<T>>>

type FlattenNested<T, K, L extends Route.Route.Tuple> = K extends keyof T
  ? IsLeaf<T[K]> extends true
    ? {}
    : T[K] extends RouteMapInput
      ? PrefixKeys<PrependLayers<FlattenRouteMap<T[K]>, L>, K & string>
      : {}
  : {}

type PrependLayers<T extends RouteMap, L extends Route.Route.Tuple> = {
  [K in keyof T]: T[K] extends Route.Route.Tuple ? [...L, ...T[K]] : never
}

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void
  ? I
  : never

export function make<const Input extends RouteMapInput>(input: Input): FlattenRouteMap<Input> {
  const merged: RouteMap = {}
  flatten(input, "", [], merged)
  return sortRoutes(merged) as FlattenRouteMap<Input>
}

function flatten(
  map: RouteMapInput,
  prefix: string,
  parentLayers: Array<MethodRoute>,
  out: RouteMap,
): void {
  const layers = [...parentLayers, ...((map[LayerKey] ?? []) as Iterable<MethodRoute>)]

  for (const key of Object.keys(map)) {
    if (key === LayerKey) continue
    const path = key as PathPattern.PathPattern
    const entry = map[path]
    const fullPath = `${prefix}${path}` as PathPattern.PathPattern

    if (Symbol.iterator in (entry as object)) {
      out[fullPath] = [...layers, ...(entry as Iterable<MethodRoute>)]
    } else {
      flatten(entry as RouteMapInput, fullPath, layers, out)
    }
  }
}

export function* walk(map: RouteMap): Generator<RouteMount.MountedRoute> {
  for (const path of Object.keys(map) as Array<PathPattern.PathPattern>) {
    yield* flattenRoutes(path, map[path])
  }
}

/**
 * Merges two route maps.
 * Overlapping paths concatenate their routes rather so routes under same
 * path are merged, too.
 */
export function merge(a: RouteMap, b: RouteMap): RouteMap {
  const combined: RouteMap = { ...a }
  for (const [path, items] of Object.entries(b)) {
    const key = path as PathPattern.PathPattern
    combined[key] = combined[key] ? [...combined[key], ...items] : items
  }
  return sortRoutes(combined)
}

// segment priority: static (0) < :param (1) < :param? (2) < :param+ (3) < :param* (4)
function sortScore(path: string): number {
  const segments = path.split("/")
  const greedyIdx = segments.findIndex((s) => s.endsWith("*") || s.endsWith("+"))
  const maxPriority = Math.max(
    ...segments.map((s) =>
      !s.startsWith(":") ? 0 : s.endsWith("*") ? 4 : s.endsWith("+") ? 3 : s.endsWith("?") ? 2 : 1,
    ),
    0,
  )

  return greedyIdx === -1
    ? // non-greedy: sort by depth, then by max segment priority
      (segments.length << 16) + (maxPriority << 8)
    : // greedy: sort after non-greedy, by greedy position (later = first), then priority
      (1 << 24) + ((16 - greedyIdx) << 16) + (maxPriority << 8)
}

function sortRoutes(input: RouteMap): RouteMap {
  const keys = Object.keys(input).sort((a, b) => sortScore(a) - sortScore(b) || a.localeCompare(b))
  const sorted: RouteMap = {}
  for (const key of keys) {
    sorted[key as PathPattern.PathPattern] = input[key as PathPattern.PathPattern]
  }
  return sorted
}

function* flattenRoutes(
  path: PathPattern.PathPattern,
  routes: Iterable<MethodRoute>,
): Generator<RouteMount.MountedRoute> {
  for (const route of routes) {
    const descriptor = {
      ...route[Route.RouteDescriptor],
      path,
    }
    yield Route.make(route.handler as any, descriptor) as RouteMount.MountedRoute
  }
}
