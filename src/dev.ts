import {
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { SolidPlugin } from "bun-plugin-solid"
import { Effect, Layer, Logger, LogLevel, pipe } from "effect"
import { fileURLToPath } from "node:url"
import packageJson from "../package.json" with { type: "json" }
import * as BunBundle from "./bun/BunBundle.ts"
import { handleHttpServerResponseError } from "./effect/http.ts"

export const ClientBundle = BunBundle.build({
  entrypoints: [
    fileURLToPath(import.meta.resolve("./client/entry.client.tsx")),
  ],
  target: "browser",
  conditions: [
    "solid",
  ],
  sourcemap: "external",
  packages: "bundle",
  plugins: [
    SolidPlugin({
      generate: "dom",
      hydratable: false,
    }),
  ],
})

export const ServerApp = BunBundle.loadWatch<typeof import("./server.ts")>({
  entrypoints: [
    fileURLToPath(import.meta.resolve("./server.ts")),
  ],
  target: "bun",
  conditions: [
    "solid",
  ],
  sourcemap: "inline",
  packages: "bundle",
  external: [
    // externalize everything except solid because it requires
    // different resolve conditions
    ...Object.keys(packageJson.dependencies)
      .filter((v) => v !== "solid-js" && v !== "@solidjs/router")
      .flatMap((v) => [v, v + "/*"]),
  ],
  plugins: [
    SolidPlugin({
      generate: "ssr",
      hydratable: false,
    }),
  ],
}).pipe(
  Effect.cached,
  Effect.flatten,
  Effect.andThen((v) => v.ref),
  Effect.andThen((v) => v.default),
  Effect.catchAll(handleHttpServerResponseError),
)

if (import.meta.main) {
  Effect.gen(function*() {
    yield* pipe(
      Layer.scopedDiscard(HttpServer.serveEffect(ServerApp)),
      HttpServer.withLogAddress,
      Layer.launch,
    )
  }).pipe(
    Effect.provide(
      BunHttpServer.layer({
        port: 3000,
      }),
    ),
    Logger.withMinimumLogLevel(LogLevel.Debug),
    BunRuntime.runMain,
  )
}
