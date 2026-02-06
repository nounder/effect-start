import type * as Bun from "bun"
import * as Array from "effect/Array"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Entity from "../Entity.ts"
import * as FilePathPattern from "../FilePathPattern.ts"
import * as Hyper from "../hyper/Hyper.ts"
import * as HyperHtml from "../hyper/HyperHtml.ts"
import * as Route from "../Route.ts"
import * as Unique from "../Unique.ts"
import * as BunServer from "./BunServer.ts"

const INTERNAL_FETCH_HEADER = "x-effect-start-internal-fetch"

export class BunRouteError extends Data.TaggedError("BunRouteError")<{
  reason: "ProxyError" | "UnsupportedPattern"
  pattern: string
  message: string
}> {}

export type BunDescriptors = {
  bunPrefix: string
  bunLoad: () => Promise<Bun.HTMLBundle>
}

export function descriptors(
  route: Route.Route.Route<any, any, any, any, any>,
): BunDescriptors | undefined {
  const descriptor = Route.descriptor(route) as Partial<BunDescriptors>
  if (typeof descriptor.bunPrefix === "string" && typeof descriptor.bunLoad === "function") {
    return descriptor as BunDescriptors
  }
  return undefined
}

export function htmlBundle(load: () => Promise<Bun.HTMLBundle | { default: Bun.HTMLBundle }>) {
  const bunPrefix = `/.BunRoute-${Unique.token(10)}`
  const bunLoad = () => load().then((mod) => ("default" in mod ? mod.default : mod))
  const descriptors = { bunPrefix, bunLoad, format: "html" as const }

  return function <D extends Route.RouteDescriptor.Any, B extends {}, I extends Route.Route.Tuple>(
    self: Route.RouteSet.RouteSet<D, B, I>,
  ): Route.RouteSet.RouteSet<
    D,
    B,
    [
      ...I,
      Route.Route.Route<
        BunDescriptors & { format: "html" },
        { request: Request },
        string,
        BunRouteError,
        BunServer.BunServer
      >,
    ]
  > {
    const handler: Route.Route.Handler<
      BunDescriptors & { format: "html" } & { request: Request },
      string,
      BunRouteError,
      BunServer.BunServer
    > = (context, next) =>
      Effect.gen(function* () {
        const originalRequest = context.request

        if (originalRequest.headers.get(INTERNAL_FETCH_HEADER) === "true") {
          const url = new URL(originalRequest.url)
          return yield* Effect.fail(
            new BunRouteError({
              reason: "ProxyError",
              pattern: url.pathname,
              message:
                "Request to internal Bun server was caught by BunRoute handler. This should not happen. Please report a bug.",
            }),
          )
        }

        const bunServer = yield* BunServer.BunServer
        const url = new URL(originalRequest.url)

        const internalPath = `${bunPrefix}${url.pathname}`
        const internalUrl = new URL(internalPath, bunServer.server.url)

        const headers = new Headers(originalRequest.headers)
        headers.set(INTERNAL_FETCH_HEADER, "true")

        const proxyRequest = new Request(internalUrl, {
          method: originalRequest.method,
          headers,
        })

        const response = yield* Effect.tryPromise({
          try: () => fetch(proxyRequest),
          catch: (error) =>
            new BunRouteError({
              reason: "ProxyError",
              pattern: internalPath,
              message: `Failed to fetch internal HTML bundle: ${String(error)}`,
            }),
        })

        let html = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: (error) =>
            new BunRouteError({
              reason: "ProxyError",
              pattern: internalPath,
              message: String(error),
            }),
        })

        const childEntity = yield* Entity.resolve(next(context))
        const children = childEntity?.body ?? childEntity

        let childrenHtml = ""
        if (children != null) {
          if ((children as unknown) instanceof Response) {
            childrenHtml = yield* Effect.promise(() => (children as unknown as Response).text())
          } else if (Hyper.isGenericJsxObject(children)) {
            childrenHtml = HyperHtml.renderToString(children)
          } else {
            childrenHtml = String(children)
          }
        }

        html = html.replace(/%children%/g, childrenHtml)

        return Entity.make(html, {
          status: response.status,
          headers: {
            "content-type": response.headers.get("content-type"),
          },
        })
      })

    const route = Route.make<
      BunDescriptors & { format: "html" },
      { request: Request },
      string,
      BunRouteError,
      BunServer.BunServer
    >(handler, descriptors)

    return Route.set([...Route.items(self), route] as any, Route.descriptor(self))
  }
}

type BunServerFetchHandler = (
  request: Request,
  server: Bun.Server<unknown>,
) => Response | Promise<Response>

type BunServerRouteHandler =
  | Bun.HTMLBundle
  | BunServerFetchHandler
  | Partial<Record<Bun.Serve.HTTPMethod, BunServerFetchHandler>>

export type BunRoutes = Record<string, BunServerRouteHandler>

/**
 * Validates that a route pattern can be implemented with Bun.serve routes.
 *
 * Supported patterns (native or via multiple routes):
 * - /exact        - Exact match
 * - /users/:id    - Full-segment named param
 * - /path/*       - Directory wildcard
 * - /[[404]]      - Catch-all / Rest
 *
 * Unsupported patterns (cannot be implemented in Bun):
 * - /pk_[id]   - Prefix before param
 * - /[id]_sfx  - Suffix after param
 * - /[id].json - Suffix with dot
 * - /[id]~test - Suffix with tilde
 * - /hello-*   - Inline prefix wildcard
 */

export function validateBunPattern(pattern: string): Option.Option<BunRouteError> {
  const segs = FilePathPattern.segments(pattern)

  const invalid = Array.findFirst(segs, (seg) => seg._tag === "InvalidSegment")

  if (Option.isSome(invalid)) {
    return Option.some(
      new BunRouteError({
        reason: "UnsupportedPattern",
        pattern,
        message: `Pattern "${pattern}" contains invalid segment.`,
      }),
    )
  }

  return Option.none()
}

export const isHtmlBundle = (handle: any) => {
  return (
    typeof handle === "object" &&
    handle !== null &&
    (handle.toString() === "[object HTMLBundle]" || typeof handle.index === "string")
  )
}
