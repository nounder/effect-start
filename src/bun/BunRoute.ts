export const TypeId = Symbol.for("effect-start/BunRoute")
export type TypeId = typeof TypeId

/**
 * Represents a Bun native HTML bundle that can be served directly by Bun's
 * built-in file routing system.
 */
export interface HTMLBundle {
  readonly default: unknown
}

/**
 * A route that serves a Bun-native HTML bundle.
 * When detected in the router, the bundle is attached to Bun's native routes
 * and a proxy handler is created to forward requests.
 */
export interface BunRoute {
  readonly [TypeId]: TypeId
  readonly _tag: "BunRoute"
  readonly load: () => Promise<HTMLBundle>
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
 * The HTML file will be bundled by Bun and served natively, while Effect
 * handles the routing logic through a proxy mechanism.
 */
export const load = (loader: () => Promise<HTMLBundle>): BunRoute => {
  return {
    [TypeId]: TypeId,
    _tag: "BunRoute",
    load: loader,
  }
}

export const isBunRoute = (value: unknown): value is BunRoute => {
  return (
    typeof value === "object" &&
    value !== null &&
    TypeId in value
  )
}
