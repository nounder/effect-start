import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { SolidPlugin } from "bun-plugin-solid"
import { Effect, Layer, Logger, LogLevel, pipe } from "effect"
import PackageJson from "../package.json" with { type: "json" }
import * as BunBundle from "./bun/BunBundle.ts"
import * as ClientFile from "./client.tsx" with { type: "file" }
import * as HttpAppExtra from "./effect/HttpAppExtra.ts"
import * as ServerFile from "./server.ts" with { type: "file" }

export const ClientBundle = BunBundle.build({
  entrypoints: [
    ClientFile.default as unknown as string,
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

export const ServerBundle = BunBundle.load<typeof ServerFile>({
  entrypoints: [
    ServerFile.default as unknown as string,
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
    ...Object.keys(PackageJson.dependencies)
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
  Effect.catchTag("RouteNotFound", e =>
    HttpServerResponse.empty({
      status: 404,
    })),
)

export const App = HttpAppExtra.chain([
  ServerBundle
    .pipe(Effect.andThen((v) => v.default)),
  ClientBundleHttpApp,
])

if (import.meta.main) {
  pipe(
    HttpServer.serve(App),
    HttpServer.withLogAddress,
    Layer.provide(
      BunHttpServer.layer({
        port: 3000,
      }),
    ),
    Layer.launch,
    Logger.withMinimumLogLevel(LogLevel.Debug),
    BunRuntime.runMain,
  )
}
