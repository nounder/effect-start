import * as Predicate from "effect/Predicate"
import type * as PathPattern from "./internal/PathPattern.ts"
import type * as Values from "./internal/Values.ts"
import * as Route from "./Route.ts"
import type * as RouteMount from "./RouteMount.ts"

const TypeId = "~effect-start/RouteTree" as const
const RouteTreeRoutes: unique symbol = Symbol()
const CompiledRoutesKey: unique symbol = Symbol()

type MethodRoute = Route.Route.With<{ method: string }>

export type RouteTuple = Iterable<MethodRoute>

const LayerKey = "*"

export type RouteTreeInput = {
  [LayerKey]?: Iterable<Route.Route.With<{ method: "*" }>>
} & {
  [path: PathPattern.PathPattern]: RouteTuple | RouteTree
}

export type RouteMap = {
  [path: PathPattern.PathPattern]: Route.Route.Tuple
}

export type Routes<T extends RouteTree> = T[typeof RouteTreeRoutes]

interface CompiledMethod {
  regex: RegExp
  table: Array<{
    path: PathPattern.PathPattern
    routes: Array<RouteMount.MountedRoute>
    paramNames: Array<string>
    paramGroupIndices: Array<number>
    sentinelIndex: number
  }>
}

interface CompiledRoutes {
  methods: Record<string, CompiledMethod>
}

export interface RouteTree<Routes extends RouteMap = RouteMap> {
  [TypeId]: typeof TypeId
  [RouteTreeRoutes]: Routes
  [CompiledRoutesKey]?: CompiledRoutes
}

type PrefixKeys<T, Prefix extends string> = {
  [K in keyof T as K extends string ? `${Prefix}${K}` : never]: T[K]
}

type InferItems<T> = T extends Route.RouteSet.Data<any, any, infer M> ? M : []

type LayerItems<T extends RouteTreeInput> = "*" extends keyof T ? InferItems<T["*"]> : []

type FlattenRouteMap<T extends RouteTreeInput> = {
  [K in Exclude<keyof T, "*"> as T[K] extends RouteTree ? never : K]: [
    ...LayerItems<T>,
    ...InferItems<T[K]>,
  ]
} & UnionToIntersection<FlattenNested<T, Exclude<keyof T, "*">, LayerItems<T>>>

type FlattenNested<T, K, L extends Route.Route.Tuple> = K extends keyof T
  ? T[K] extends RouteTree<infer R>
    ? PrefixKeys<PrependLayers<R, L>, K & string>
    : {}
  : {}

type PrependLayers<T extends RouteMap, L extends Route.Route.Tuple> = {
  [K in keyof T]: T[K] extends Route.Route.Tuple ? [...L, ...T[K]] : never
}

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void
  ? I
  : never

export type WalkDescriptor = {
  path: PathPattern.PathPattern
  method: string
} & Values.FlatObject

export interface LookupResult {
  route: RouteMount.MountedRoute
  params: Record<string, string>
}

export function make<const Routes extends RouteTreeInput>(
  input: Routes,
): RouteTree<FlattenRouteMap<Routes>> {
  const layerRoutes = [...(input[LayerKey] ?? [])]
  const merged: RouteMap = {}

  function flatten(map: RouteTreeInput, prefix: string, layers: Array<MethodRoute>): void {
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

  const sorted = sortRoutes(merged)
  return {
    [TypeId]: TypeId,
    [RouteTreeRoutes]: sorted,
  } as RouteTree<FlattenRouteMap<Routes>>
}

export function* walk(tree: RouteTree): Generator<RouteMount.MountedRoute> {
  const _routes = routes(tree) as RouteMap

  for (const path of Object.keys(_routes) as Array<PathPattern.PathPattern>) {
    yield* flattenRoutes(path, _routes[path])
  }
}

export function merge(a: RouteTree, b: RouteTree): RouteTree {
  const combined: RouteMap = { ...routes(a) }
  for (const [path, items] of Object.entries(routes(b))) {
    const key = path as PathPattern.PathPattern
    combined[key] = combined[key] ? [...combined[key], ...items] : items
  }
  const sorted = sortRoutes(combined)
  return {
    [TypeId]: TypeId,
    [RouteTreeRoutes]: sorted,
  } as RouteTree
}

export function isRouteTree(input: unknown): input is RouteTree {
  return Predicate.hasProperty(input, TypeId)
}

export function lookup(tree: RouteTree, method: string, path: string): LookupResult | null {
  tree[CompiledRoutesKey] ??= compileRoutes(routes(tree))
  const { methods } = tree[CompiledRoutesKey]

  const wildcard = methods["*"]
  if (wildcard) {
    const result = execCompiled(wildcard, path)
    if (result) return result
  }

  const specific = methods[method]
  if (specific) {
    const result = execCompiled(specific, path)
    if (result) return result
  }

  return null
}

function routes<Routes extends RouteMap>(tree: RouteTree<Routes>): Routes {
  return tree[RouteTreeRoutes]
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

function matchScore(path: string): number {
  const segments = path.split("/").filter(Boolean)
  const staticCount = segments.filter((s) => !s.startsWith(":")).length
  const maxPriority = Math.max(
    ...segments.map((s) =>
      !s.startsWith(":") ? 0 : s.endsWith("*") ? 4 : s.endsWith("+") ? 3 : s.endsWith("?") ? 2 : 1,
    ),
    0,
  )
  // more static segments = more specific = lower score = matched first.
  // for same static count: lower maxPriority (more static) wins.
  return ((16 - staticCount) << 16) + (maxPriority << 8)
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function patternToRegex(pattern: string): {
  fragment: string
  paramNames: Array<string>
  groupCount: number
} {
  const segments = pattern.split("/").filter(Boolean)
  const paramNames: Array<string> = []
  let fragment = ""
  let groupCount = 0

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]

    if (seg.startsWith(":")) {
      const last = seg[seg.length - 1]
      if (last === "+") {
        const name = seg.slice(1, -1)
        paramNames.push(name)
        fragment += "\\/(.+)"
        groupCount++
      } else if (last === "*") {
        const name = seg.slice(1, -1)
        paramNames.push(name)
        fragment += "(?:\\/(.+))?"
        groupCount++
      } else if (last === "?") {
        const name = seg.slice(1, -1)
        paramNames.push(name)
        fragment += "(?:\\/([^\\/]+))?"
        groupCount++
      } else {
        const name = seg.slice(1)
        paramNames.push(name)
        fragment += "\\/([^\\/]+)"
        groupCount++
      }
    } else {
      fragment += "\\/" + escapeRegex(seg)
    }
  }

  return { fragment, paramNames, groupCount }
}

function compileRoutes(sortedRoutes: RouteMap): CompiledRoutes {
  const methodGroups: Record<
    string,
    Array<{
      path: PathPattern.PathPattern
      route: RouteMount.MountedRoute
    }>
  > = {}

  for (const path of Object.keys(sortedRoutes) as Array<PathPattern.PathPattern>) {
    for (const routeData of sortedRoutes[path]) {
      const descriptor = {
        ...routeData[Route.RouteDescriptor],
        path,
      }
      const mounted = Route.make(routeData.handler as any, descriptor) as RouteMount.MountedRoute
      const method = (descriptor as { method: string }).method

      if (!methodGroups[method]) methodGroups[method] = []
      methodGroups[method].push({ path, route: mounted })
    }
  }

  const pathRoutesByMethod: Record<
    string,
    Map<
      string,
      {
        path: PathPattern.PathPattern
        routes: Array<RouteMount.MountedRoute>
      }
    >
  > = {}

  for (const method of Object.keys(methodGroups)) {
    const map = new Map<
      string,
      {
        path: PathPattern.PathPattern
        routes: Array<RouteMount.MountedRoute>
      }
    >()
    for (const { path, route } of methodGroups[method]) {
      let entry = map.get(path)
      if (!entry) {
        entry = { path, routes: [] }
        map.set(path, entry)
      }
      entry.routes.push(route)
    }
    pathRoutesByMethod[method] = map
  }

  const methods: Record<string, CompiledMethod> = {}

  for (const method of Object.keys(pathRoutesByMethod)) {
    const pathMap = pathRoutesByMethod[method]
    const orderedPaths = (Object.keys(sortedRoutes) as Array<PathPattern.PathPattern>)
      .filter((p) => pathMap.has(p))
      .sort((a, b) => matchScore(a) - matchScore(b) || a.localeCompare(b))

    const branches: Array<string> = []
    const table: CompiledMethod["table"] = []
    let groupOffset = 1

    for (const path of orderedPaths) {
      const entry = pathMap.get(path)!
      const { fragment, paramNames, groupCount } = patternToRegex(path)

      const paramGroupIndices: Array<number> = []
      for (let i = 0; i < groupCount; i++) {
        paramGroupIndices.push(groupOffset + i)
      }

      const sentinelIndex = groupOffset + groupCount
      branches.push(fragment + "()")
      groupOffset += groupCount + 1

      table.push({
        path: entry.path,
        routes: entry.routes,
        paramNames,
        paramGroupIndices,
        sentinelIndex,
      })
    }

    if (branches.length === 0) continue

    const pattern = "^(?:" + branches.join("|") + ")\\/*$"
    methods[method] = {
      regex: new RegExp(pattern),
      table,
    }
  }

  return { methods }
}

function execCompiled(compiled: CompiledMethod, path: string): LookupResult | null {
  const match = compiled.regex.exec(path)
  if (!match) return null

  for (const entry of compiled.table) {
    if (match[entry.sentinelIndex] === undefined) continue

    const params: Record<string, string> = {}
    for (let i = 0; i < entry.paramNames.length; i++) {
      const val = match[entry.paramGroupIndices[i]]
      if (val !== undefined) {
        params[entry.paramNames[i]] = val
      }
    }

    return { route: entry.routes[0], params }
  }

  return null
}
