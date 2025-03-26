import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { SolidPlugin } from "bun-plugin-solid"
import { Effect, Layer, Logger, LogLevel, pipe } from "effect"
import PackageJson from "../package.json" with { type: "json" }
import * as BunBundle from "./bun/BunBundle.ts"
import * as Bundle from "./Bundle.ts"
import * as ClientFile from "./client.tsx" with { type: "file" }
import * as HttpAppExtra from "./effect/HttpAppExtra.ts"
import * as ServerFile from "./server.ts" with { type: "file" }

export class ClientBundle extends Bundle.Tag("client")<ClientBundle>() {}

export const ClientBuild = BunBundle.build({
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

export const ServerBuild = BunBundle.load<typeof ServerFile>({
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

export const App = HttpAppExtra.chain([
  ServerBuild
    .pipe(Effect.andThen((v) => v.default)),

  Bundle.http(ClientBundle).pipe(
    Effect.andThen(HttpRouter.prefixAll("/.bundle")),
  ),
])

if (import.meta.main) {
  pipe(
    HttpServer.serve(App),
    HttpServer.withLogAddress,
    Layer.provide(
      BunBundle.layer(ClientBundle, ClientBuild.config),
    ),
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
