import * as ContentNegotiation from "./ContentNegotiation.ts"
import * as PathPattern from "./PathPattern.ts"
import * as Route from "./Route.ts"

export interface MatchOptions {
  readonly path: string
  readonly headers?: {
    readonly accept?: string
  }
}

export interface MatchResult {
  readonly route: Route.Route.Route
  readonly params: Record<string, string>
}

type RouteWithPath = Route.RouteSet.RouteSet<
  { path: string; method: string },
  {},
  Route.RouteSet.Tuple
>

function compile(routes: Iterable<RouteWithPath>) {
  return [...routes]
    .flatMap((routeSet) => {
      const { path } = Route.descriptor(routeSet)
      return [...routeSet].map((route) =>
        [path, PathPattern.toRegex(path), route] as const
      )
    })
    .sort((a, b) => getPathPriority(a[0]) - getPathPriority(b[0]))
}

export function match(
  routes: Iterable<RouteWithPath>,
  options: MatchOptions,
): MatchResult | null {
  const { path, headers } = options
  const accept = headers?.accept
  const pool = compile(routes)
  const matches: MatchResult[] = []

  for (const [, regex, route] of pool) {
    const result = path.match(regex)
    if (result) {
      const params = result.groups ?? {}
      if (!accept) {
        return { route, params }
      }
      matches.push({ route, params })
    }
  }

  if (matches.length === 0) {
    return null
  }

  return selectByContentNegotiation(matches, accept!)
}

export function matchRequest(
  routes: Iterable<RouteWithPath>,
  request: Request,
): MatchResult | null {
  const url = new URL(request.url)
  return match(routes, {
    path: url.pathname,
    headers: {
      accept: request.headers.get("accept") ?? undefined,
    },
  })
}

function getPathPriority(path: string): number {
  let score = 0
  let i = 0
  const len = path.length

  while (i < len) {
    if (path[i] === "/") {
      i++
      continue
    }

    const segStart = i
    while (i < len && path[i] !== "/") i++

    if (path[i - 1] === "*") {
      score += 3
    } else if (path[i - 1] === "+") {
      score += 2
    } else if (path[segStart] === ":") {
      score += 1
    }
  }

  return score
}

const formatToMediaType: Record<string, string> = {
  text: "text/plain",
  html: "text/html",
  json: "application/json",
  bytes: "application/octet-stream",
}

function selectByContentNegotiation(
  candidates: MatchResult[],
  accept: string,
): MatchResult {
  const available: string[] = []
  const formatMap = new Map<string, MatchResult>()

  for (const candidate of candidates) {
    const descriptor = Route.descriptor(candidate.route) as { format?: string }
    const format = descriptor?.format
    if (format && format in formatToMediaType) {
      const mediaType = formatToMediaType[format]
      if (!formatMap.has(mediaType)) {
        available.push(mediaType)
        formatMap.set(mediaType, candidate)
      }
    }
  }

  if (available.length === 0) {
    return candidates[0]
  }

  const preferred = ContentNegotiation.media(accept, available)

  if (preferred.length > 0) {
    const best = formatMap.get(preferred[0])
    if (best) {
      return best
    }
  }

  return candidates[0]
}
