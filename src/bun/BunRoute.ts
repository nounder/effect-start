import * as Bun from "bun"
import * as Data from "effect/Data"
import * as Either from "effect/Either"
import * as Effect from "effect/Effect"
import * as FiberRef from "effect/FiberRef"
import * as Option from "effect/Option"
import * as Entity from "../Entity.ts"
import * as Html from "../Html.ts"
import * as PathPattern from "../_PathPattern.ts"
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

type HTMLBundleModule = Bun.HTMLBundle | { default: Bun.HTMLBundle }

const bundleDepthRef = FiberRef.unsafeMake(0)

export function htmlBundle(load: () => HTMLBundleModule | Promise<HTMLBundleModule>) {
  const bunPrefix = `/.BunRoute-${Unique.token(10)}`
  const bunLoad = () =>
    Promise.resolve(load()).then((mod) => ("default" in mod ? mod.default : mod))
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
        const bundleDepth = yield* FiberRef.get(bundleDepthRef)

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

        let html = ""
        let status = 200
        let contentType = "text/html;charset=utf-8"

        const response = yield* fetchBundleResponse(
          bunPrefix,
          originalRequest,
        )
        html = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: (error) =>
            new BunRouteError({
              reason: "ProxyError",
              pattern: bunPrefix,
              message: String(error),
            }),
        })
        status = response.status
        contentType = response.headers.get("content-type") ?? contentType

        const childEntity = yield* next(context).pipe(
          Effect.locally(bundleDepthRef, bundleDepth + 1),
        )

        if (
          Entity.isEntity(childEntity) &&
          childEntity.status &&
          childEntity.status >= 300 &&
          childEntity.status < 400
        ) {
          return childEntity
        }

        const children = childEntity?.body ?? childEntity

        let childrenHtml = ""
        if (children != null) {
          if ((children as unknown) instanceof Response) {
            childrenHtml = yield* Effect.promise(() => (children as unknown as Response).text())
          } else if (Html.isGenericJsxObject(children)) {
            childrenHtml = Html.renderToString(children)
          } else {
            childrenHtml = String(children)
          }
        }

        childrenHtml = yield* stripDuplicateBunScripts(html, childrenHtml)

        html = html.replaceAll("%children%", childrenHtml)

        return Entity.make(html, {
          status,
          headers: {
            "content-type": contentType,
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

function fetchBundleResponse(
  bunPrefix: string,
  originalRequest: Request,
) {
  return Effect.gen(function* () {
    const bunServer = yield* BunServer.BunServer
    const url = new URL(originalRequest.url)
    const internalUrl = new URL(bunServer.server.url)

    internalUrl.pathname = `${bunPrefix}${url.pathname}`
    internalUrl.search = url.search

    const headers = new Headers(originalRequest.headers)
    headers.set(INTERNAL_FETCH_HEADER, "true")

    const proxyRequest = new Request(internalUrl, {
      method: originalRequest.method,
      headers,
    })

    return yield* Effect.tryPromise({
      try: () => fetch(proxyRequest),
      catch: (error) =>
        new BunRouteError({
          reason: "ProxyError",
          pattern: internalUrl.pathname,
          message: `Failed to fetch internal HTML bundle: ${String(error)}`,
        }),
    })
  })
}

function stripDuplicateBunScripts(parentHtml: string, childHtml: string) {
  return getInjectedBunScriptSrcs(parentHtml).pipe(
    Effect.flatMap((parentScriptSrcs) => {
      if (parentScriptSrcs.size === 0) {
        return Effect.succeed(childHtml)
      }

      let removeNextInlineScript = false
      const rewriter = new HTMLRewriter().on("script", {
        element(element) {
          const src = element.getAttribute("src")
          const hasDevAttribute = element.hasAttribute("data-bun-dev-server-script")

          if (src !== null && hasDevAttribute && parentScriptSrcs.has(src)) {
            element.remove()
            removeNextInlineScript = true
            return
          }

          if (removeNextInlineScript && src === null) {
            element.remove()
            removeNextInlineScript = false
            return
          }

          removeNextInlineScript = false
        },
      })

      return Effect.tryPromise({
        try: () =>
          rewriter
            .transform(
              new Response(childHtml, {
                headers: {
                  "content-type": "text/html;charset=utf-8",
                },
              }),
            )
            .text(),
        catch: (error) =>
          new BunRouteError({
            reason: "ProxyError",
            pattern: "stripDuplicateBunScripts",
            message: String(error),
          }),
      })
    }),
  )
}

function getInjectedBunScriptSrcs(html: string) {
  return Effect.tryPromise({
    try: async () => {
      const srcs = new Set<string>()
      const rewriter = new HTMLRewriter().on("script", {
        element(element) {
          const src = element.getAttribute("src")
          if (src !== null && element.hasAttribute("data-bun-dev-server-script")) {
            srcs.add(src)
          }
        },
      })

      await rewriter
        .transform(
          new Response(html, {
            headers: {
              "content-type": "text/html;charset=utf-8",
            },
          }),
        )
        .text()

      return srcs
    },
    catch: (error) =>
      new BunRouteError({
        reason: "ProxyError",
        pattern: "getInjectedBunScriptSrcs",
        message: String(error),
      }),
  })
}

type BunServerFetchHandler = (
  request: Request,
  server: Bun.Server<unknown>,
) => Response | Promise<Response>

type BunServerRouteHandler =
  | Bun.HTMLBundle
  | Bun.BunFile
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
  const parsed = PathPattern.fromFilePath(pattern)
  if (Either.isLeft(parsed)) {
    return Option.some(
      new BunRouteError({
        reason: "UnsupportedPattern",
        pattern,
        message: parsed.left.message,
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
