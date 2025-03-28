import { HttpRouter, HttpServer, Runtime } from "@effect/platform"
import { BunContext, BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { SolidPlugin } from "bun-plugin-solid"
import { Console, Effect, Layer, Logger, LogLevel, Match, pipe } from "effect"
import PackageJson from "../package.json" with { type: "json" }
import * as BunBundle from "./bun/BunBundle.ts"
import * as Bundle from "./Bundle.ts"
import * as Client from "./client.tsx"
import * as HttpAppExtra from "./effect/HttpAppExtra.ts"
import * as Server from "./server.ts"

export class ClientBundle extends Bundle.Tag("client")<ClientBundle>() {}

export class ServerBundle extends Bundle.Tag("server")<ServerBundle>() {}

export const ClientBundleConfig = BunBundle.config({
  entrypoints: [
    import.meta.resolve("./client.tsx"),
  ],
  target: "browser",
  conditions: [
    "solid",
  ],
  naming: "[name]-[hash].[ext]",
  sourcemap: "external",
  packages: "bundle",
  plugins: [
    SolidPlugin({
      generate: "dom",
      hydratable: false,
    }),
  ],
})

export const ServerBundleConfig = BunBundle.config({
  entrypoints: [
    import.meta.resolve("./server.ts"),
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

const BundleLayer = Layer.merge(
  BunBundle.layer(ClientBundle, ClientBundleConfig),
  BunBundle.layer(ServerBundle, ServerBundleConfig),
)

export const App = HttpAppExtra.chain([
  ServerBundle.pipe(
    Effect.andThen(Bundle.load<typeof Server>),
    Effect.andThen(v => v.default),
  ),

  ClientBundle.pipe(
    Bundle.toHttpRouter,
    Effect.andThen(HttpRouter.prefixAll("/.bundle")),
  ),
]).pipe(
  Effect.provide(BundleLayer),
)

if (import.meta.main) {
  Match.value(process.argv[2] ?? "start").pipe(
    Match.when(
      "start",
      () =>
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
        ),
    ),
    Match.when(
      "build",
      () =>
        Effect.gen(function*() {
          const client = yield* BunBundle.effect(ClientBundleConfig)

          yield* Console.log("Building client bundle")
          yield* Bundle.toFiles(client, "out/client")

          const server = yield* BunBundle.effect(ServerBundleConfig)

          yield* Console.log("Building server bundle")
          yield* Bundle.toFiles(server, "out/server")
        }),
    ),
    Match.orElse(() => Effect.dieMessage("Unknown command")),
    Effect.provide(BunContext.layer),
    BunRuntime.runMain,
  )
}
