import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { BunFileSystem, BunHttpServer, BunPath } from "@effect/platform-bun"
import { Console, Effect, Layer, pipe } from "effect"
import * as BunBuild from "./bun/BunBuild.ts"
import * as Bundle from "./bun/Bundle.ts"
import LiveReloadHttpRoute from "./LiveReloadHttpRoute.ts"
import { FrontendRoute } from "./solid.ts"
import { TailwidCssRoute } from "./tailwind.ts"

export const router = HttpRouter.empty.pipe(
  HttpRouter.get("/yo", HttpServerResponse.text("yo")),
  HttpRouter.get("/.bundle/events", LiveReloadHttpRoute),
  HttpRouter.get("/.bundle/app.css", TailwidCssRoute),
  HttpRouter.all("*", FrontendRoute),
)

const Router = Bundle.build<typeof import("./router.ts")>(
  import.meta.resolve("./router.ts"),
)

const app = Effect.andThen(Router, Router =>
  pipe(
    Router,
    app => Layer.scopedDiscard(HttpServer.serveEffect(app)),
    HttpServer.withLogAddress,
    Layer.provide(BunHttpServer.layerServer({
      port: 3000,
    })),
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
  Effect.runPromise(
    Effect.andThen(app, app =>
      app.pipe(
        Layer.launch,
        Effect.provide(BunFileSystem.layer),
        Effect.provide(BunPath.layer),
        Effect.provide(frontendBuild),
        Effect.catchAll(Console.error),
      )),
  )
}
