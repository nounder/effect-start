import * as Predicate from "effect/Predicate"
import * as PathPattern from "./PathPattern.ts"
import * as Route from "./Route.ts"
import * as RouteMount from "./RouteMount.ts"

const TypeId: unique symbol = Symbol.for("effect-start/RouteTree")
const RouteTreeRoutes: unique symbol = Symbol()

export type RouteMap = {
  [path: PathPattern.PathPattern]: Iterable<
    Route.Route.With<{
      method: RouteMount.RouteMount.Method
      format?: string
    }>
  >
}

export type Routes<
  T extends RouteTree<any>,
> = T[typeof RouteTreeRoutes]

export interface RouteTree<
  Routes extends RouteMap = {},
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

export function make<
  const Routes extends RouteMap,
>(
  routes: Routes,
): RouteTree<
  {
    [K in keyof Routes]: Route.RouteSet.Infer<Routes[K]>
  }
> {
  return {
    [TypeId]: TypeId,
    [RouteTreeRoutes]: sortRoutes(routes),
  } as RouteTree<{ [K in keyof Routes]: Route.RouteSet.Infer<Routes[K]> }>
}

export type WalkDescriptor = {
  path: PathPattern.PathPattern
  method: string
} & Route.RouteDescriptor.Any

function* flattenItems(
  path: PathPattern.PathPattern,
  items: Route.Route.Tuple,
  parentDescriptor: { method: string } & Route.RouteDescriptor.Any,
): Generator<RouteMount.MountedRoute> {
  for (const item of items) {
    if (Route.isRoute(item)) {
      const mergedDescriptor = {
        ...parentDescriptor,
        ...Route.descriptor(item),
        path,
      }
      yield Route.make(
        // handler receives mergedDescriptor (which includes path) at runtime
        item.handler as any,
        mergedDescriptor,
      ) as RouteMount.MountedRoute
    } else if (Route.isRouteSet(item)) {
      const mergedDescriptor = {
        ...parentDescriptor,
        ...Route.descriptor(item),
      }
      yield* flattenItems(path, Route.items(item), mergedDescriptor)
    }
  }
}

export function* walk(
  tree: RouteTree,
): Generator<RouteMount.MountedRoute> {
  const _routes = routes(tree)
  for (const path of Object.keys(_routes) as PathPattern.PathPattern[]) {
    const routeSet = _routes[path]
    yield* flattenItems(
      path,
      Route.items(routeSet),
      Route.descriptor(routeSet),
    )
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
