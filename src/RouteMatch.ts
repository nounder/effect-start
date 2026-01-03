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
  readonly priority: number
}

export function match(
  set: Route.RouteSet.Any,
  options: MatchOptions,
): MatchResult | null {
  const { path, headers } = options
  const pathSegments = normalizePath(path)
  const accept = headers?.accept

  const candidates = matchAllItems(Route.items(set), pathSegments, "")

  if (candidates.length === 0) {
    return null
  }

  if (candidates.length > 1) {
    candidates.sort((a, b) => a.priority - b.priority)
  }

  if (!accept) {
    return candidates[0]
  }

  return selectByContentNegotiation(candidates, accept)
}

function matchAllItems(
  items: Route.RouteSet.Tuple,
  pathSegments: string[],
  parentPath: string,
): MatchResult[] {
  const results: MatchResult[] = []

  for (const item of items) {
    const descriptor = Route.descriptor(item) as { path?: string }
    const currentPath = typeof descriptor?.path === "string"
      ? parentPath + descriptor.path
      : parentPath

    if (Route.isRoute(item)) {
      if (currentPath === "") {
        continue
      }
      const patternSegments = PathPattern.parse(currentPath)
      const matchResult = PathPattern.match(patternSegments, pathSegments)

      if (matchResult !== null) {
        results.push({
          route: item,
          params: matchResult,
          priority: getPathPriority(currentPath),
        })
      }
    } else {
      const nestedItems = Route.items(item)
      const nestedResults = matchAllItems(nestedItems, pathSegments, currentPath)
      results.push(...nestedResults)
    }
  }

  return results
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

export function matchRequest(
  set: Route.RouteSet.Any,
  request: Request,
): MatchResult | null {
  const url = new URL(request.url)
  return match(set, {
    path: url.pathname,
    headers: {
      accept: request.headers.get("accept") ?? undefined,
    },
  })
}

function normalizePath(path: string): string[] {
  return path.split("/").filter(Boolean)
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
      score += 2
    } else if (path[segStart] === ":") {
      score += 1
    }
  }

  return score
}
