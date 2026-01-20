import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Runtime from "effect/Runtime"
import * as ContentNegotiation from "./ContentNegotiation.ts"
import * as Http from "./Http.ts"
import * as PathPattern from "./PathPattern.ts"
import * as Route from "./Route.ts"
import * as RouteTree from "./RouteTree.ts"

export type FetchHandles = {
  [path: PathPattern.PathPattern]: Http.WebHandler
}

export type RouteWithMethod = Route.Route.With<{
  method: string
}>

const formatToMediaType: Record<string, string> = {
  text: "text/plain",
  html: "text/html",
  json: "application/json",
  bytes: "application/octet-stream",
}

const formatToContentType: Record<string, string> = {
  text: "text/plain; charset=utf-8",
  html: "text/html; charset=utf-8",
  json: "application/json",
  bytes: "application/octet-stream",
}

function toResponse(result: unknown, format?: string): Response {
  if (result instanceof Response) {
    return result
  }

  const contentType = format && format in formatToContentType
    ? formatToContentType[format]
    : typeof result === "string"
    ? "text/html; charset=utf-8"
    : "application/json"

  const body = contentType === "application/json"
    ? JSON.stringify(result)
    : result

  return new Response(body as BodyInit, {
    headers: { "Content-Type": contentType },
  })
}

interface RouteCandidate {
  route: Route.Route.Route<any, any, any, any, any>
  descriptor: Route.RouteDescriptor.Any
  format: string | undefined
  mediaType: string | undefined
}

function selectRoute(
  candidates: RouteCandidate[],
  accept: string | null,
): RouteCandidate {
  if (candidates.length === 1 || !accept) {
    return candidates[0]
  }

  const available: string[] = []
  const mediaTypeMap = new Map<string, RouteCandidate>()

  for (const candidate of candidates) {
    if (candidate.format && candidate.mediaType) {
      if (!mediaTypeMap.has(candidate.mediaType)) {
        available.push(candidate.mediaType)
        mediaTypeMap.set(candidate.mediaType, candidate)
      }
    }
  }

  if (available.length === 0) {
    return candidates[0]
  }

  const preferred = ContentNegotiation.media(accept, available)
  if (preferred.length > 0) {
    const best = mediaTypeMap.get(preferred[0])
    if (best) {
      return best
    }
  }

  return candidates[0]
}

export const toWebHandlerRuntime = <R>(
  runtime: Runtime.Runtime<R>,
) => {
  const run = Runtime.runPromise(runtime)

  return (routes: Iterable<RouteWithMethod>): Http.WebHandler => {
    // Group by method for content negotiation within same method
    const methodGroups = new Map<string, RouteCandidate[]>()

    for (const route of routes) {
      const descriptor = Route.descriptor(route)
      const format = descriptor.format as string | undefined
      const mediaType = format && format in formatToMediaType
        ? formatToMediaType[format]
        : undefined
      const method = descriptor.method && descriptor.method !== "*"
        ? descriptor.method.toUpperCase()
        : "*"

      const candidates = methodGroups.get(method) ?? []
      candidates.push({ route, descriptor, format, mediaType })
      methodGroups.set(method, candidates)
    }

    return (request) => {
      const method = request.method.toUpperCase()
      const accept = request.headers.get("Accept")

      const candidates = methodGroups.get(method)
        ?? methodGroups.get("*")

      if (!candidates) {
        return Promise.resolve(
          new Response("Method Not Allowed", { status: 405 }),
        )
      }

      const selected = selectRoute(candidates, accept)
      const { route, descriptor, format } = selected

      const context = {
        ...descriptor,
        request,
      }

      const effect = route.handler(
        context as any,
        () => Effect.succeed(undefined),
      )

      return run(
        effect.pipe(
          Effect.map((result) => toResponse(result, format)),
          Effect.catchAllCause((cause) =>
            Effect.succeed(
              new Response(Cause.pretty(cause), { status: 500 }),
            )
          ),
        ),
      )
    }
  }
}

export const toWebHandler: (
  routes: Iterable<RouteWithMethod>,
) => Http.WebHandler = toWebHandlerRuntime(Runtime.defaultRuntime)

export function treeHandles(
  tree: RouteTree.RouteTree,
): FetchHandles {
  const handles: FetchHandles = {}

  // Group routes by bunPath
  const pathGroups = new Map<
    PathPattern.PathPattern,
    Array<Route.Route.With<{ path: string; method: string }>>
  >()

  for (const route of RouteTree.walk(tree)) {
    const descriptor = Route.descriptor(route)
    const bunPaths = PathPattern.toBun(descriptor.path)

    for (const bunPath of bunPaths) {
      const routes = pathGroups.get(bunPath) ?? []
      routes.push(route)
      pathGroups.set(bunPath, routes)
    }
  }

  for (const [bunPath, routes] of pathGroups) {
    handles[bunPath] = toWebHandler(routes)
  }

  return handles
}

export function fetch(
  handle: Http.WebHandler,
  init: RequestInit & ({ url: string } | { path: string }),
): Promise<Response> {
  const url = "path" in init ? `http://localhost${init.path}` : init.url
  const request = new Request(url, init)
  return Promise.resolve(handle(request))
}
