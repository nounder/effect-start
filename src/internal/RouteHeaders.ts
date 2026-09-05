import * as Effect from "effect/Effect"
import * as Entity from "../Entity.ts"
import * as Route from "../Route.ts"

/**
 * Adds headers to the response of the current request, merging with
 * whatever headers the route handler eventually sets (this call wins on
 * conflicts, same as {@link Entity.merge}). RouteHttp reads the accumulated
 * headers once the chain resolves; Route.ws reads them eagerly, before the
 * socket upgrade, so they can reach the handshake response too.
 *
 * Prefer {@link withHeaders} for cross-cutting concerns like CORS; use this
 * directly when a single handler needs to add headers procedurally.
 *
 * @example
 * ```ts
 * Route.sse(function*() {
 *   yield* Route.addHeaders({ "access-control-allow-origin": "*" })
 *   return Stream.make({ data: "hello" })
 * })
 * ```
 */
export function addHeaders(headers: Entity.Headers): Effect.Effect<void> {
  return Effect.map(Route.RouteHeaders, (ref) => {
    ref.headers = Entity.mergeHeaders(ref.headers, headers)
  })
}

/**
 * Adds headers to every response produced downstream. Replaces the
 * `Route.use(Route.handle(function*(_, next) { return Entity.merge(yield* next, {headers}) }))`
 * pattern with a single call that works for SSE, JSON/HTML/etc responses,
 * and WebSocket upgrades.
 *
 * @example
 * ```ts
 * Route.use(Route.withHeaders({ "access-control-allow-origin": "*" })).get(
 *   Route.sse(function*() {
 *     return Stream.make({ data: "hello" })
 *   }),
 * )
 * ```
 */
export function withHeaders<D, B, I extends Route.Route.Tuple>(
  headers: Entity.Headers,
): (
  self: Route.RouteSet<D, B, I>,
) => Route.RouteSet<D, B, [...I, Route.Route<{}, {}, unknown, never, never>]> {
  const route = Route.make<{}, {}, unknown, never, never>(
    (_context, next) =>
      Effect.gen(function*() {
        yield* addHeaders(headers)
        return yield* next
      }),
    {},
  )

  return (self) =>
    Route.set(
      [...Route.items(self), route] as [
        ...I,
        Route.Route<{}, {}, unknown, never, never>,
      ],
      Route.descriptor(self),
    )
}
