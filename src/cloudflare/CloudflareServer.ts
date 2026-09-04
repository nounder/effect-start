/**
 * A minimal {@link StartServer.StartServer} for edge/serverless runtimes with
 * no persistent listening socket — Cloudflare Workers, and any other
 * fetch-per-invocation platform. There's nothing to bind, so `address` is a
 * synthetic {@link SocketAddress.WorkerAddress} rather than one resolved from
 * a real listen call.
 *
 * `upgrade` fails with a `SocketOpenError` (surfaced by `Route.ws` as a 426
 * response) until a platform-specific fetch adapter — wiring `WebSocketPair`
 * and the platform's `Response.webSocket` protocol — provides its own.
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import * as SocketAddress from "../internal/SocketAddress.ts"
import * as StartServer from "../StartServer.ts"

export interface CloudflareServer extends StartServer.StartServer {}

export const CloudflareServer = Context.GenericTag<CloudflareServer>(
  "effect-start/CloudflareServer",
)

export interface CloudflareServerOptions {
  /**
   * Public hostname the Worker is reachable at — a custom domain or
   * `<name>.<subdomain>.workers.dev`. Purely informational: Workers don't
   * bind to it, the platform's edge does. Defaults to `"workers.dev"`.
   */
  readonly hostname?: string | undefined
  /** Defaults to `443` — Workers are only ever reachable over HTTPS. */
  readonly port?: number | undefined
}

export const make = (
  options?: CloudflareServerOptions,
): Effect.Effect<CloudflareServer, never, Scope.Scope> =>
  StartServer.make({
    address: SocketAddress.worker(options?.hostname, options?.port),
  })

export const layer = (
  options?: CloudflareServerOptions,
): Layer.Layer<CloudflareServer | StartServer.StartServer> =>
  Layer.scopedContext(
    Effect.map(make(options), (server) =>
      Context.empty().pipe(
        Context.add(CloudflareServer, server),
        Context.add(StartServer.StartServer, server),
      )),
  )
