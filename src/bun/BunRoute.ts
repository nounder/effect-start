import type { HTMLBundle } from "bun"
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerError from "@effect/platform/HttpServerError"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as Route from "../Route.ts"

export const TypeId = Symbol.for("effect-start/BunRoute")
export type TypeId = typeof TypeId

/**
 * A Route that serves Bun-native HTML bundles.
 * Extends Route with an additional TypeId and loader function.
 */
export type BunRoute = Route.RouteSet.Default & {
  readonly [TypeId]: TypeId
  readonly loader: () => Promise<HTMLBundle>
}

/**
 * Creates a BunRoute from an HTML file import.
 *
 * @example
 * ```ts
 * import { BunRoute } from "effect-start/bun"
 *
 * export default BunRoute.load(() => import("./index.html"))
 * ```
 *
 * The HTML file will be bundled by Bun and served natively. The route handler
 * fetches the content from Bun's native route ({path}.original) at runtime.
 */
export const load = (loader: () => Promise<HTMLBundle>): BunRoute => {
  // Create a Route.html that fetches from Bun's server
  const route = Route.html(
    Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const url = new URL(request.url)

      // Fetch from Bun's native route at {path}.original
      const originalPath = `${url.pathname}.original`
      url.pathname = originalPath

      const response = yield* Effect.tryPromise(() =>
        fetch(url.toString())
      )

      const text = yield* Effect.tryPromise(() =>
        response.text()
      )

      return text
    })
  )

  // Add BunRoute marker using prototype chain
  const bunRoute = Object.assign(
    Object.create(Object.getPrototypeOf(route)),
    route,
    {
      [TypeId]: TypeId,
      loader,
    }
  ) as BunRoute

  return bunRoute
}

/**
 * Type guard to check if a value is a BunRoute.
 */
export const isBunRoute = (value: unknown): value is BunRoute => {
  return (
    typeof value === "object" &&
    value !== null &&
    TypeId in value
  )
}

/**
 * Middleware that proxies requests to Bun's native routes when RouteNotFound.
 *
 * HTMLBundle can contain multiple artifacts (JS, CSS, images, etc).
 * When a route is not found in the Effect router, this middleware tries to
 * fetch from Bun's native routes. If Bun returns 404, yields RouteNotFound.
 */
export const bunProxyMiddleware = <E, R>(
  app: HttpApp.Default<E, R>,
): HttpApp.Default<never, never> => {
  return Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest

    // Try the Effect router first
    const result = yield* Effect.either(app)

    if (result._tag === "Left") {
      const error = result.left

      // Only proxy if it's a RouteNotFound error
      if ((error as any)._tag === "RouteNotFound") {
        // Try to fetch from Bun's native routes
        const url = new URL(request.url)

        const response = yield* Effect.tryPromise(() =>
          fetch(url.toString())
        )

        // If Bun returns 404, re-throw RouteNotFound
        if (response.status === 404) {
          return yield* Effect.fail(error as never)
        }

        // If Bun returns other error status, re-throw RouteNotFound
        if (!response.ok) {
          return yield* Effect.fail(error as never)
        }

        // Success - return the response from Bun
        const arrayBuffer = yield* Effect.tryPromise(() =>
          response.arrayBuffer()
        )

        return HttpServerResponse.raw(
          new Uint8Array(arrayBuffer),
          {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
          }
        )
      }

      // Other errors - re-throw
      return yield* Effect.fail(error as never)
    }

    // Success from Effect router
    return result.right
  }) as HttpApp.Default<never, never>
}
