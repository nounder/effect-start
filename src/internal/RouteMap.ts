import * as Effect from "effect/Effect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as Route from "../Route.ts"
import * as RouteHttp from "../RouteHttp.ts"
import * as PathPattern from "./PathPattern.ts"
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

export type Provided =
  | { readonly [Route.IntrinsicService]?: any }
  | HttpRouter.Provided
  | HttpRouter.HttpRouter

/**
 * Extracts the union of `R` requirements from every route reachable in a
 * {@link RouteMapInput} or {@link RouteMap}, including layer routes (`*`) and
 * nested inputs. Excludes intrinsic and HttpRouter services supplied by
 * the request runtime.
 */
export type Context<T> = Exclude<
  {
    [K in keyof T]: T[K] extends Iterable<Route.Route<any, any, any, any, infer R>> ? R
      : Context<T[K]>
  }[keyof T],
  Provided
>

type PrefixKeys<T, Prefix extends string> = {
  [K in keyof T as K extends string ? `${Prefix}${K}` : never]: T[K]
}

type InferItems<T> = T extends Route.RouteSet.Data<any, any, infer M> ? M
  : T extends Route.Route.Tuple ? T
  : []

type LayerItems<T extends RouteMapInput> = "*" extends keyof T ? InferItems<T["*"]>
  : []

type IsLeaf<T> = T extends Iterable<any> ? true : false

type FlattenRouteMap<T extends RouteMapInput> = string extends keyof T ? RouteMap
  :
    & {
      [K in Exclude<keyof T, "*"> as IsLeaf<T[K]> extends true ? K : never]: [
        ...LayerItems<T>,
        ...InferItems<T[K]>,
      ]
    }
    & UnionToIntersection<
      FlattenNested<T, Exclude<keyof T, "*">, LayerItems<T>>
    >

type FlattenNested<T, K, L extends Route.Route.Tuple> = K extends keyof T ? IsLeaf<T[K]> extends true ? {}
  : T[K] extends RouteMapInput ? PrefixKeys<PrependLayers<FlattenRouteMap<T[K]>, L>, K & string>
  : {}
  : {}

type PrependLayers<T extends RouteMap, L extends Route.Route.Tuple> = {
  [K in keyof T]: T[K] extends Route.Route.Tuple ? [...L, ...T[K]] : never
}

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I
  : never

export function make<const Input extends RouteMapInput>(
  input: Input,
): FlattenRouteMap<Input> {
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
  const layers = [
    ...parentLayers,
    ...((map[LayerKey] ?? []) as Iterable<MethodRoute>),
  ]

  for (const key of Object.keys(map)) {
    if (key === LayerKey) continue
    const path = key as PathPattern.PathPattern
    const entry = map[path]
    const fullPath = `${prefix}${path}` as PathPattern.PathPattern
    const validation = PathPattern.validate(fullPath)
    if (!validation.ok) throw new TypeError(validation.error)

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

export const toHttpRouter = (map: RouteMap): Effect.Effect<HttpRouter.HttpRouter> =>
  Effect.gen(function*() {
    const router = yield* HttpRouter.make.pipe(Effect.provideService(HttpRouter.RouterConfig, {
      caseSensitive: true,
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
      maxParamLength: Infinity,
    }))
    for (const path of Object.keys(map) as Array<PathPattern.PathPattern>) {
      yield* router.add("*", path, RouteHttp.handler<never>(flattenRoutes(path, map[path])))
    }
    return router
  })

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

function sortRoutes(input: RouteMap): RouteMap {
  const keys = Object.keys(input).sort(PathPattern.compare)
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
    yield Route.make(
      route.handler as any,
      descriptor,
    ) as RouteMount.MountedRoute
  }
}
