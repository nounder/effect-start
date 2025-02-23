import { HttpServer } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { SolidPlugin } from "bun-plugin-solid"
import { Effect, Layer, Logger, LogLevel, pipe } from "effect"
import { fileURLToPath } from "node:url"
import packageJson from "../package.json" with { type: "json" }
import * as BunBundle from "./bun/BunBundle.ts"

Effect.gen(function*() {
  const serverBundle = yield* BunBundle.loadWatch<typeof import("./router.ts")>(
    {
      entrypoints: [
        fileURLToPath(import.meta.resolve("./router.ts")),
      ],
      target: "bun",
      conditions: ["solid"],
      sourcemap: "inline",
      packages: "bundle",
      // externalize everything except solid because it requires
      // custom condition
      external: [
        ...Object.keys(packageJson.dependencies)
          .filter(v => v !== "solid-js" && v !== "@solidjs/router")
          .flatMap(v => [
            v,
            v + "/*",
          ]),
      ],
      plugins: [
        SolidPlugin({
          generate: "ssr",
          hydratable: false,
        }),
      ],
    },
  )

  yield* pipe(
    Layer.scopedDiscard(
      HttpServer.serveEffect(
        serverBundle.ref.pipe(Effect.andThen(v => v.default)),
      ),
    ),
    HttpServer.withLogAddress,
    Layer.launch,
  )
})
  .pipe(
    Effect.provide(BunHttpServer.layer({
      port: 3000,
    })),
    Logger.withMinimumLogLevel(LogLevel.Debug),
    BunRuntime.runMain,
  )
