import * as Config from "effect/Config"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as HttpServer from "effect/http/HttpServer"
import * as Layer from "effect/Layer"
import * as NetAddress from "effect/net/NetAddress"
import * as Option from "effect/Option"
import * as NOs from "node:os"
import * as AgentHarness from "./internal/AgentHarness.ts"
import * as BunHttpServer from "./internal/BunHttpServer.ts"

export type BunServeOptions = BunHttpServer.ServeOptions & {
  readonly disablePreemptiveShutdown?: boolean
  readonly gracefulShutdownTimeout?: Duration.Input
  readonly websocket?: BunHttpServer.WebSocketOptions
}

const optionsWithDefaults = (options: BunServeOptions) =>
  "unix" in options && options.unix !== undefined
    ? Effect.succeed(options)
    : Effect.gen(function*() {
      const port = yield* Config.Number("PORT").pipe(
        Effect.catchTag("ConfigError", () => Effect.succeed(AgentHarness.isAgentHarness() ? 0 : 3000)),
      )
      const hostname = yield* Config.String("HOST").pipe(
        Effect.catchTag("ConfigError", () => Effect.succeed(process.argv.includes("--host") ? "0.0.0.0" : undefined)),
      )
      return { port, hostname, ...options } satisfies BunServeOptions
    })

export const make = (options: BunServeOptions = {}) => Effect.flatMap(optionsWithDefaults(options), BunHttpServer.make)

export const layer = (options: BunServeOptions = {}) =>
  Layer.merge(
    Layer.effect(HttpServer.HttpServer, make(options)),
    BunHttpServer.layerHttpServices,
  )

export const layerStart = (options: BunServeOptions = {}) =>
  Layer.unwrap(Effect.gen(function*() {
    const existing = yield* Effect.serviceOption(HttpServer.HttpServer)
    return Option.isSome(existing)
      ? Layer.succeed(HttpServer.HttpServer, existing.value)
      : layer(options)
  }))

export const withLogAddress = <A, E, R>(serverLayer: Layer.Layer<A, E, R>) =>
  Layer
    .effectDiscard(HttpServer.HttpServer.use((server) => {
      if (server.address._tag === "UnixPathAddress") return Effect.log(`Listening on unix:${server.address.path}`)
      const host = NetAddress.formatHost(server.address) === "0.0.0.0" ? (getLocalIp() ?? "localhost") : "localhost"
      return Effect.log(`Listening on http://${host}:${server.address.port}`)
    }))
    .pipe(Layer.provideMerge(serverLayer))

function getLocalIp(): string | undefined {
  return Object
    .values(NOs.networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .find((address) => address.family === "IPv4" && !address.internal)
    ?.address
}
