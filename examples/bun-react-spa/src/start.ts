import { HttpServer } from "@effect/platform"
import { BunContext, BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer, pipe } from "effect"
import { BunBundle } from "effect-bundler"
import { App } from "./server.ts"

export const ClientBundle = BunBundle.bundleClient(
  BunBundle.configFromHttpRouter(App),
)

export const ServerBundle = BunBundle.bundleServer(
  import.meta.path,
)

if (import.meta.main) {
  pipe(
    HttpServer.serve(App),
    HttpServer.withLogAddress,
    Layer.provide([
      BunHttpServer.layer({
        port: 3000,
      }),
      ClientBundle.devLayer,
      BunContext.layer,
    ]),
    Layer.launch,
    Effect.scoped,
    BunRuntime.runMain,
  )
}
