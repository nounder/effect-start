import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { SolidPlugin } from "bun-plugin-solid"
import { Effect, Layer, Logger, LogLevel, pipe } from "effect"
import packageJson from "../package.json" with { type: "json" }
import * as BunBundle from "./bun/BunBundle.ts"
import ClientFile from "./client.tsx" with { type: "file" }
import { handleHttpServerResponseError } from "./effect/http.ts"
import ServerFile from "./server.ts" with { type: "file" }

export const ClientBundle = BunBundle.build({
  entrypoints: [
    ClientFile as unknown as string,
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

const [
  ApiApp,
  SsrApp,
] = BunBundle.loadWatch<typeof import("./server.ts")>({
  entrypoints: [
    ServerFile as unknown as string,
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
  bundle => [
    bundle.pipe(Effect.andThen(mod => mod.ApiApp)),
    bundle.pipe(Effect.andThen(mod => mod.SsrApp)),
  ],
)

const ClientBundleHttpApp = pipe(
  BunBundle.buildRouter(ClientBundle.config),
  Effect.andThen(HttpRouter.prefixAll("/.bundle")),
  Effect.catchTag("RouteNotFound", e =>
    HttpServerResponse.empty({
      status: 404,
    })),
)

export const App = Effect.gen(function*() {
  const apiRes = yield* ApiApp

  if (apiRes.status !== 404) {
    return apiRes
  }

  const ssrRes = yield* SsrApp

  if (ssrRes.status !== 404) {
    return ssrRes
  }

  const bundleRes = yield* ClientBundleHttpApp.pipe()

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
