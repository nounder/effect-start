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

const ApiApp = BunBundle.loadWatch<typeof import("./api.ts")>({
  entrypoints: [
    fileURLToPath(import.meta.resolve("./api.ts")),
  ],
  target: "bun",
  sourcemap: "inline",
  packages: "external",
}).pipe(
  Effect.cached,
)

const SsrApp = BunBundle.loadWatch<typeof import("./client/ssr.tsx")>({
  entrypoints: [
    fileURLToPath(import.meta.resolve("./client/ssr.ts")),
  ],
  target: "bun",
  conditions: ["solid"],
  sourcemap: "inline",
  packages: "bundle",
  external: [
    // externalize everything except solid because it requires
    // custom resolve condition
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
)

export const App = Effect.gen(function*() {
  const api = pipe(
    ApiApp,
    Effect.flatten,
    Effect.andThen((v) => v.ref),
    Effect.andThen((v) => v.default),
    Effect.catchTag("RouteNotFound", () =>
      HttpServerResponse.empty({
        status: 404,
      })),
  )
  const ssr = pipe(
    SsrApp,
    Effect.flatten,
    Effect.andThen((v) => v.ref),
    Effect.andThen((v) => v.default),
  )

  const apiRes = yield* api

  if (apiRes.status !== 404) {
    return apiRes
  }

  const ssrRes = yield* ssr

  if (ssrRes.status !== 404) {
    return ssrRes
  }

  return HttpServerResponse.empty({
    status: 404,
  })
}).pipe(
  Effect.catchAll(handleHttpServerResponseError),
)

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
