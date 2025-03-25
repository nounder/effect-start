import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { SolidPlugin } from "bun-plugin-solid"
import { Effect, Layer, Logger, LogLevel, pipe } from "effect"
import packageJson from "../package.json" with { type: "json" }
import * as BunBundle from "./bun/BunBundle.ts"
import { handleHttpServerResponseError } from "./effect/http.ts"

export const ClientBundle = BunBundle.build({
  entrypoints: [
    await import("./client.tsx", { with: { type: "file" } })
      .then(v => v["default"]),
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

export const ServerBundle = BunBundle.loadWatch<typeof import("./server.ts")>({
  entrypoints: [
    await import("./server.ts", { with: { type: "file" } })
      .then(v => v["default"] as unknown as string),
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
})

const ClientBundleHttpApp = pipe(
  BunBundle.buildRouter(ClientBundle.config),
  Effect.andThen(HttpRouter.prefixAll("/.bundle")),
)

export const App = Effect.gen(function*() {
  const { ApiApp, SsrApp } = yield* ServerBundle

  const apiRes = yield* ApiApp

  if (apiRes.status !== 404) {
    return apiRes
  }

  const ssrRes = yield* SsrApp

  if (ssrRes.status !== 404) {
    return ssrRes
  }

  const bundleRes = yield* ClientBundleHttpApp.pipe(
    Effect.catchTag("RouteNotFound", e =>
      HttpServerResponse.empty({
        status: 404,
      })),
  )

  if (bundleRes.status !== 404) {
    return bundleRes
  }

  return HttpServerResponse.text(
    "Not Found",
    {
      status: 404,
    },
  )
})

if (import.meta.main) {
  Effect.gen(function*() {
    yield* pipe(
      Layer.scopedDiscard(HttpServer.serveEffect(App)),
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
