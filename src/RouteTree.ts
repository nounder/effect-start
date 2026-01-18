import type * as PathPattern from "./PathPattern.ts"
import * as Route from "./Route.ts"

const RouteTreeRoutes: unique symbol = Symbol()
const RouteTreeKeys: unique symbol = Symbol()

export interface RouteTree<
  Routes extends Record<PathPattern.PathPattern, Route.RouteSet.Any> = {},
> {
  [RouteTreeRoutes]: Routes
  [RouteTreeKeys]: PathPattern.PathPattern[]

  add<P extends PathPattern.PathPattern, R extends Route.RouteSet.Any>(
    path: P,
    route: R,
  ): RouteTree<
    {
      [K in keyof Routes | P]: K extends keyof Routes ? Routes[K]
        : Route.RouteSet.Infer<R>
    }
  >
}

export type Routes<T extends RouteTree<any>> = T[typeof RouteTreeRoutes]

function routes<
  Routes extends Record<PathPattern.PathPattern, Route.RouteSet.Any>,
>(
  tree: RouteTree<Routes>,
): Routes {
  return tree[RouteTreeRoutes]
}

function keys(
  tree: RouteTree<any>,
): PathPattern.PathPattern[] {
  return tree[RouteTreeKeys]
}

const TreeProto = {
  add<P extends PathPattern.PathPattern, R extends Route.RouteSet.Any>(
    this: RouteTree<any>,
    path: P,
    route: R,
  ): RouteTree<any> {
    return make({
      ...routes(this),
      [path]: route,
    })
  },
}

export function make<
  const Routes extends Record<PathPattern.PathPattern, Route.RouteSet.Any>,
>(
  routes: Routes,
): RouteTree<
  {
    [K in keyof Routes]: Route.RouteSet.Infer<Routes[K]>
  }
> {
  return Object.assign(Object.create(TreeProto), {
    [RouteTreeRoutes]: routes,
    [RouteTreeKeys]: Object.keys(routes) as PathPattern.PathPattern[],
  })
}

export function add<
  P extends PathPattern.PathPattern,
  R extends Route.RouteSet.Any,
>(
  path: P,
  route: R,
): RouteTree<{ [K in P]: Route.RouteSet.Infer<R> }> {
  return make({ [path]: route } as { [K in P]: R })
}

function* flattenItems(
  path: string,
  items: Route.RouteSet.Tuple,
  parentDescriptor: Record<string, unknown>,
): Generator<Route.Route.Route<any, any, any, any, any>> {
  for (const item of items) {
    if (Route.isRoute(item)) {
      const itemDescriptor = Route.descriptor(item)
      const mergedDescriptor = {
        ...parentDescriptor,
        ...itemDescriptor,
        path,
      }
      yield Route.make(item.handler, mergedDescriptor)
    } else if (Route.isRouteSet(item)) {
      const itemDescriptor = Route.descriptor(item)
      const mergedDescriptor = {
        ...parentDescriptor,
        ...itemDescriptor,
      }
      yield* flattenItems(path, Route.items(item), mergedDescriptor)
    }
  }
}

export function* walk(
  tree: RouteTree<any>,
): Generator<Route.Route.Route<any, any, any, any, any>> {
  const _routes = routes(tree)
  for (const path of keys(tree)) {
    const routeSet = _routes[path] as Route.RouteSet.Any
    const items = Route.items(routeSet)
    const descriptor = Route.descriptor(routeSet)
    yield* flattenItems(path, items, descriptor)
  }
}
