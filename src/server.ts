import { HttpServer } from "@effect/platform"
import {
  BunContext,
  BunFileSystem,
  BunHttpServer,
  BunRuntime,
} from "@effect/platform-bun"
import { Console, Effect, Layer, pipe } from "effect"
import * as BunBuild from "./bun/BunBuild.ts"
import * as Bundle from "./bun/Bundle.ts"

const Router = Bundle.build<typeof import("./router.ts")>(
  import.meta.resolve("./router.ts"),
)

const app = Effect.andThen(Router, Router =>
  pipe(
    Router,
    app => Layer.scopedDiscard(HttpServer.serveEffect(app)),
    HttpServer.withLogAddress,
  ))

const frontendBuild = BunBuild.make({
  entrypoints: [
    Bun.fileURLToPath(import.meta.resolve("./entry-client.tsx")),
  ],
  naming: "[name]:[hash].[ext]",
  plugins: [
    await import("bun-plugin-solid").then((v) =>
      v.SolidPlugin({
        generate: "dom",
        hydratable: false,
      })
    ),
  ],
})

if (import.meta.main) {
  BunRuntime.runMain(
    Effect.andThen(app, app =>
      pipe(
        app,
        Layer.provide(BunHttpServer.layer({
          port: 3000,
        })),
        Layer.provide(frontendBuild),
        Layer.provide(BunFileSystem.layer),
        Layer.launch,
      )),
  )
}
