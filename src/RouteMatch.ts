import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import type * as PathPattern from "./internal/PathPattern.ts"
import * as Route from "./Route.ts"
import type * as RouteMap from "./RouteMap.ts"
import type * as RouteMount from "./RouteMount.ts"

const TypeId = "~effect-start/RouteMatch/Matcher" as const

interface Matcher extends Pipeable.Pipeable {
  readonly [TypeId]: typeof TypeId
  readonly methods: Record<string, CompiledMethod>
}

interface MatchResult {
  route: RouteMount.MountedRoute
  params: Record<string, string>
}

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

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
}

export const isMatcher = (u: unknown): u is Matcher => Predicate.hasProperty(u, TypeId)

export function make(map: RouteMap.RouteMap): Matcher {
  return Object.assign(Object.create(Proto), {
    methods: compile(map),
  })
}

export function match(matcher: Matcher, method: string, path: string): MatchResult | null {
  const wildcard = matcher.methods["*"]
  if (wildcard) {
    const result = exec(wildcard, path)
    if (result) return result
  }

  const specific = matcher.methods[method]
  if (specific) {
    const result = exec(specific, path)
    if (result) return result
  }

  return null
}

// more static segments = more specific = lower score = matched first.
// for same static count: lower maxPriority (more static) wins.
function matchScore(path: string): number {
  const segments = path.split("/").filter(Boolean)
  const staticCount = segments.filter((s) => !s.startsWith(":")).length
  const maxPriority = Math.max(
    ...segments.map((s) =>
      !s.startsWith(":") ? 0 : s.endsWith("*") ? 4 : s.endsWith("+") ? 3 : s.endsWith("?") ? 2 : 1,
    ),
    0,
  )
  return ((16 - staticCount) << 16) + (maxPriority << 8)
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

function compile(sortedRoutes: RouteMap.RouteMap): Record<string, CompiledMethod> {
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

  return methods
}

function exec(compiled: CompiledMethod, path: string): MatchResult | null {
  const m = compiled.regex.exec(path)
  if (!m) return null

  for (const entry of compiled.table) {
    if (m[entry.sentinelIndex] === undefined) continue

    const params: Record<string, string> = {}
    for (let i = 0; i < entry.paramNames.length; i++) {
      const val = m[entry.paramGroupIndices[i]]
      if (val !== undefined) {
        params[entry.paramNames[i]] = val
      }
    }

    return { route: entry.routes[0], params }
  }

  return null
}
