import type { HTMLBundle } from "bun"
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
  const route = Route.html(function*() {
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
