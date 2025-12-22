// @ts-nocheck
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import type * as Bun from "bun"
import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Hyper from "../hyper/Hyper.ts"
import * as HyperHtml from "../hyper/HyperHtml.ts"
import * as Random from "../Random.ts"
import * as Route from "../Route.ts"
import * as Router from "../Router.ts"
import * as RouterPattern from "../RouterPattern.ts"
import * as BunHttpServer from "./BunHttpServer.ts"

const BunHandlerTypeId: unique symbol = Symbol.for("effect-start/BunHandler")

const INTERNAL_FETCH_HEADER = "x-effect-start-internal-fetch"

export type BunHandler =
  & Route.RouteHandler<string, Router.RouterError, BunHttpServer.BunHttpServer>
  & {
    [BunHandlerTypeId]: typeof BunHandlerTypeId
    internalPathPrefix: string
    load: () => Promise<Bun.HTMLBundle>
  }

export function isBunHandler(input: unknown): input is BunHandler {
  return typeof input === "function"
    && Predicate.hasProperty(input, BunHandlerTypeId)
}

export function bundle(
  load: () => Promise<Bun.HTMLBundle | { default: Bun.HTMLBundle }>,
): BunHandler {
  const internalPathPrefix = `/.BunRoute-${Random.token(6)}`

  const handler = (context: Route.RouteContext, next: Route.RouteNext) =>
    Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const originalRequest = request.source as Request

      if (
        originalRequest.headers.get(INTERNAL_FETCH_HEADER) === "true"
      ) {
        return yield* Effect.fail(
          new Router.RouterError({
            reason: "ProxyError",
            pattern: context.url.pathname,
            message:
              "Request to internal Bun server was caught by BunRoute handler. This should not happen. Please report a bug.",
          }),
        )
      }

      const bunServer = yield* BunHttpServer.BunHttpServer

      const internalPath = `${internalPathPrefix}${context.url.pathname}`
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
          new Router.RouterError({
            reason: "ProxyError",
            pattern: internalPath,
            message: `Failed to fetch internal HTML bundle: ${String(error)}`,
          }),
      })

      let html = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: (error) =>
          new Router.RouterError({
            reason: "ProxyError",
            pattern: internalPath,
            message: String(error),
          }),
      })

      const children = yield* next()
      let childrenHtml = ""
      if (children != null) {
        if (HttpServerResponse.isServerResponse(children)) {
          const webResponse = HttpServerResponse.toWeb(children)
          childrenHtml = yield* Effect.promise(() => webResponse.text())
        } else if (Hyper.isGenericJsxObject(children)) {
          childrenHtml = HyperHtml.renderToString(children)
        } else {
          childrenHtml = String(children)
        }
      }

      html = html.replace(/%yield%/g, childrenHtml)
      html = html.replace(
        /%slots\.(\w+)%/g,
        (_, name) => context.slots[name] ?? "",
      )

      return html
    })

  return Object.assign(handler, {
    [BunHandlerTypeId]: BunHandlerTypeId,
    internalPathPrefix,
    load: () => load().then(mod => "default" in mod ? mod.default : mod),
  }) as BunHandler
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

type MethodHandlers = Partial<
  Record<Bun.Serve.HTTPMethod, BunServerFetchHandler>
>

function isMethodHandlers(value: unknown): value is MethodHandlers {
  return typeof value === "object" && value !== null && !("index" in value)
}

/**
 * Validates that a route pattern can be implemented with Bun.serve routes.
 *
 * Supported patterns (native or via multiple routes):
 * - /exact        - Exact match
 * - /users/:id    - Full-segment named param
 * - /path/*       - Directory wildcard
 * - /*            - Catch-all
 * - /[[id]]       - Optional param (implemented via `/` and `/:id`)
 * - /[[...rest]]  - Optional rest param (implemented via `/` and `/*`)
 *
 * Unsupported patterns (cannot be implemented in Bun):
 * - /pk_[id]   - Prefix before param
 * - /[id]_sfx  - Suffix after param
 * - /[id].json - Suffix with dot
 * - /[id]~test - Suffix with tilde
 * - /hello-*   - Inline prefix wildcard
 */

export function validateBunPattern(
  pattern: string,
): Option.Option<Router.RouterError> {
  const segments = RouterPattern.parse(pattern)

  const unsupported = Array.findFirst(segments, (seg) => {
    if (seg._tag === "ParamSegment") {
      return seg.prefix !== undefined || seg.suffix !== undefined
    }

    return false
  })

  if (Option.isSome(unsupported)) {
    return Option.some(
      new Router.RouterError({
        reason: "UnsupportedPattern",
        pattern,
        message:
          `Pattern "${pattern}" uses prefixed/suffixed params (prefix_[param] or [param]_suffix) `
          + `which cannot be implemented in Bun.serve.`,
      }),
    )
  }

  return Option.none()
}

export const isHTMLBundle = (handle: any) => {
  return (
    typeof handle === "object"
    && handle !== null
    && (handle.toString() === "[object HTMLBundle]"
      || typeof handle.index === "string")
  )
}
