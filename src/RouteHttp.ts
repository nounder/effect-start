import type * as Bun from "bun"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Http from "./Http.ts"
import * as PathPattern from "./PathPattern.ts"
import * as Route from "./Route.ts"
import * as RouteTree from "./RouteTree.ts"

export type FetchHandles = {
  [path: PathPattern.PathPattern]:
    | Http.FetchHandler
    | {
      [method in Http.Method]?: Http.FetchHandler
    }
}

function toResponse(result: unknown): Response {
  if (result instanceof Response) {
    return result
  } else if (typeof result === "string") {
    return new Response(result, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  } else {
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    })
  }
}

export function treeHandles(tree: RouteTree.RouteTree): FetchHandles {
  const handles: FetchHandles = {}

  for (const route of RouteTree.walk(tree)) {
    const descriptor = Route.descriptor(route)
    const bunPaths = PathPattern.toBun(descriptor.path)

    for (const bunPath of bunPaths) {
      const existingHandle = handles[bunPath as PathPattern.PathPattern]

      const handler: Http.FetchHandler = (request) => {
        const url = new URL(request.url)
        const params = PathPattern.match(descriptor.path, url.pathname) ?? {}

        const context = {
          ...descriptor,
          params,
          url,
          request,
        }

        const effect = route.handler(context, () => Effect.succeed(undefined))

        return Effect.runPromise(
          effect.pipe(
            Effect.map(toResponse),
            Effect.catchAllCause((cause) =>
              Effect.succeed(
                new Response(Cause.pretty(cause), { status: 500 }),
              )
            ),
          ),
        )
      }

      // Handle method-specific routing
      if (descriptor.method && descriptor.method !== "*") {
        const method = descriptor.method.toUpperCase() as Bun.Serve.HTTPMethod

        if (existingHandle && typeof existingHandle === "object") {
          // Merge with existing method handlers
          ;(existingHandle as Record<string, unknown>)[method] = handler
        } else {
          handles[bunPath as PathPattern.PathPattern] = { [method]: handler }
        }
      } else {
        // Wildcard method - register as direct handler
        handles[bunPath as PathPattern.PathPattern] = handler
      }
    }
  }

  return handles
}
