import * as Bun from "bun"
import * as NPath from "node:path"
import * as Data from "effect/Data"
import * as Either from "effect/Either"
import * as Effect from "effect/Effect"
import * as FiberRef from "effect/FiberRef"
import * as Option from "effect/Option"
import * as Entity from "../Entity.ts"
import * as Hyper from "../hyper/Hyper.ts"
import * as HyperHtml from "../hyper/HyperHtml.ts"
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

        if (bundleDepth === 0) {
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

          html = yield* Effect.tryPromise({
            try: () => response.text(),
            catch: (error) =>
              new BunRouteError({
                reason: "ProxyError",
                pattern: internalPath,
                message: String(error),
              }),
          })
          status = response.status
          contentType = response.headers.get("content-type") ?? contentType
        } else {
          html = yield* readBundleHtml(bunLoad).pipe(
            Effect.mapError(
              (error) =>
                new BunRouteError({
                  reason: "ProxyError",
                  pattern: bunPrefix,
                  message: `Failed to load nested HTML bundle: ${String(error)}`,
                }),
            ),
          )
        }

        const childEntity = yield* next(context).pipe(Effect.locally(bundleDepthRef, bundleDepth + 1))
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

        childrenHtml = yield* stripInjectedBunScripts(childrenHtml)

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


function stripInjectedBunScripts(html: string) {
  let removeNextInlineScript = false
  const rewriter = new HTMLRewriter().on("script", {
    element(element) {
      const src = element.getAttribute("src")
      const hasDevAttribute = element.getAttribute("data-bun-dev-server-script") !== null

      if (hasDevAttribute || (src !== null && src.startsWith("/_bun/client/"))) {
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
    try: () => rewriter.transform(new Response(html)).text(),
    catch: (error) =>
      new BunRouteError({
        reason: "ProxyError",
        pattern: "stripInjectedBunScripts",
        message: String(error),
      }),
  })
}

function readBundleHtml(bunLoad: () => Promise<Bun.HTMLBundle>) {
  return Effect.tryPromise({
    try: () => bunLoad(),
    catch: (error) =>
      new BunRouteError({
        reason: "ProxyError",
        pattern: "readBundleHtml",
        message: String(error),
      }),
  }).pipe(
    Effect.andThen((bundle) => {
      const indexPath = NPath.isAbsolute(bundle.index)
        ? bundle.index
        : NPath.resolve(NPath.dirname(Bun.main), bundle.index)
      return Effect.tryPromise({
        try: () => Bun.file(indexPath).text(),
        catch: (error) =>
          new BunRouteError({
            reason: "ProxyError",
            pattern: indexPath,
            message: String(error),
          }),
      })
    }),
  )
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
