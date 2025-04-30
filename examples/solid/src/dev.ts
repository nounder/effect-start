import { HttpServer } from "@effect/platform"
import { BunContext, BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { SolidPlugin } from "bun-plugin-solid"
import { Console, Effect, Layer, Logger, LogLevel, Match, pipe } from "effect"
import { BunBundle, Bundle, BunTailwindPlugin } from "effect-bundler"
import { fileURLToPath } from "node:url"
import PackageJson from "../package.json" with { type: "json" }
import * as Server from "./server.ts"

export const ClientBundle = BunBundle.bundle("ClientBundle", {
  entrypoints: [
    fileURLToPath(import.meta.resolve("./client.tsx")),
    fileURLToPath(import.meta.resolve("./App.css")),
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
    BunTailwindPlugin.make(() => import("@tailwindcss/node")),
  ],
})

export const ServerBundle = BunBundle.bundle("ServerBundle", {
  entrypoints: [
    fileURLToPath(import.meta.resolve("./server.ts")),
  ],
  target: "bun",
  conditions: [
    "solid",
  ],
  sourcemap: "external",
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

export const App = ServerBundle.load<typeof Server>().pipe(
  Effect.andThen(v => v.Server),
)

export const layer = Layer.merge(
  ClientBundle.devLayer,
  ServerBundle.devLayer,
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
          yield* Console.log("Building client bundle to out/client")
          yield* Bundle.toFiles(yield* ClientBundle, "out/client")

          yield* Console.log("Building server bundle in out/server")
          yield* Bundle.toFiles(yield* ServerBundle, "out/server")
        }),
    ),
    Match.orElse(() => Effect.dieMessage("Unknown command")),
    Effect.provide(layer),
    Effect.provide(BunContext.layer),
    BunRuntime.runMain,
  )
}
