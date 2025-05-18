import { type HttpApp, HttpServer } from "@effect/platform"
import { BunContext, BunHttpServer, BunRuntime } from "@effect/platform-bun"
import type { RouteNotFound } from "@effect/platform/HttpServerError"
import { Effect, Layer, pipe } from "effect"
import { Bundle } from "../index.ts"

export function serve(opts: {
  server: HttpApp.Default<RouteNotFound, "ClientBundle">
  port?: 3000
  client?: Effect.Effect<
    Bundle.BundleContext,
    Bundle.BundleError,
    any
  >
}) {
  return pipe(
    HttpServer.serve(opts.server),
    HttpServer.withLogAddress,
    Layer.provide(
      BunHttpServer.layer({
        port: opts.port ?? 3000,
      }),
    ),
    Layer.provide(
      Layer.effect(
        Bundle.tagged("ClientBundle"),
        opts.client?.pipe(Effect.orDie)
          ?? Effect.succeed(null as any),
        // manual casting cause TS doesn't recognize that error got cleared with orDie
      ) as Layer.Layer<"ClientBundle", never>,
    ),
    Layer.provide(BunContext.layer),
    Layer.launch,
    BunRuntime.runMain,
  )
}
