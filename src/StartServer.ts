/**
 * The platform-agnostic server surface a route handler needs at request time —
 * upgrading a connection to a {@link Socket.Socket}, forking work into the
 * server's scope, and reading the address it's reachable at. A concrete server
 * (e.g. `bun/BunServer`, `cloudflare/CloudflareServer`) implements it and
 * provides this tag alongside its own.
 *
 * Keeping this interface free of any platform import (no `bun`, no `node:*`)
 * lets browser-targeted modules depend on `Route.ws` without pulling a server
 * runtime — and its `import "bun"` — into the bundle. It's also why
 * serverless runtimes (no real listening socket) can implement it too: their
 * `address` is synthetic rather than resolved from a bind.
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"
import * as SocketAddress from "./internal/SocketAddress.ts"
import type * as Route from "./Route.ts"
import * as Socket from "./Socket.ts"

export type Address = SocketAddress.Address

export interface StartServer {
  // Provided automatically by the request runtime, so it's stripped from a
  // route handler's requirements rather than surfaced to the app.
  readonly [Route.IntrinsicService]?: never
  readonly address: Address
  readonly hostname: string
  readonly port: number
  readonly url: string
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

/**
 * Forks socket handlers into `scope` rather than the caller's, so they are
 * interrupted (and their finalizers run) when that scope closes instead of
 * outliving it. Shared by every {@link StartServer} implementation that has
 * an actual lifetime to fork into (a bound socket, a request scope, ...).
 */
export const runForkIn =
  (scope: Scope.Scope) => <R>(effect: Effect.Effect<void, never, R>): Effect.Effect<void, never, R> =>
    Effect.asVoid(Effect.forkIn(effect, scope))

const unsupportedUpgrade: StartServer["upgrade"] = () =>
  Effect.fail(
    new Socket.SocketError({
      reason: new Socket.SocketOpenError({
        kind: "Unknown",
        cause: new Error("this server does not support upgrading connections to a socket"),
      }),
    }),
  )

/**
 * Builds a minimal {@link StartServer} from just an {@link Address}, with a
 * `runFork` that forks into the current scope and an `upgrade` that fails
 * with a `SocketOpenError` (surfaced by `Route.ws` as a 426 response) unless
 * overridden. Useful for runtimes with no persistent listening socket — e.g.
 * a serverless handler that only knows its address once invoked.
 */
export const make = (options: {
  readonly address: Address
  readonly upgrade?: StartServer["upgrade"]
}): Effect.Effect<StartServer, never, Scope.Scope> =>
  Effect.gen(function*() {
    const scope = yield* Effect.scope
    return StartServer.of({
      address: options.address,
      hostname: SocketAddress.hostname(options.address),
      port: SocketAddress.port(options.address),
      url: SocketAddress.urlOf(options.address),
      upgrade: options.upgrade ?? unsupportedUpgrade,
      runFork: runForkIn(scope),
    })
  })
