/**
 * The platform-agnostic server surface a route handler needs at request time —
 * upgrading a connection to a {@link Socket.Socket} and forking work into the
 * server's scope. A concrete server (e.g. `bun/BunServer`) implements it and
 * provides this tag alongside its own.
 *
 * Keeping this interface free of any platform import (no `bun`, no `node:*`)
 * lets browser-targeted modules depend on `Route.ws` without pulling a server
 * runtime — and its `import "bun"` — into the bundle.
 */
import type * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import type * as Scope from "effect/Scope"
import type * as Route from "./Route.ts"
import type * as Socket from "./Socket.ts"

export interface StartServer {
  // Provided automatically by the request runtime, so it's stripped from a
  // route handler's requirements rather than surfaced to the app.
  readonly [Route.IntrinsicService]?: never
  readonly upgrade: (
    request: Request,
    handlerScope: Scope.Scope,
  ) => Effect.Effect<Socket.Socket, Socket.SocketError>
  /**
   * Forks a socket handler into the server's scope, so it is interrupted (and
   * its finalizers run) when the server shuts down. The effect must handle its
   * own errors; its requirements are preserved.
   */
  readonly runFork: <R>(
    effect: Effect.Effect<void, never, R>,
  ) => Effect.Effect<void, never, R>
}

export const StartServer = Context.GenericTag<StartServer>("effect-start/StartServer")
