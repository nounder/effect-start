import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { BunFileSystem, BunHttpServer, BunPath } from "@effect/platform-bun"
import { Console, Effect, Layer } from "effect"
import * as BunBuild from "./bun/BunBuild.ts"
import { FrontendRoute } from "./solid.ts"
import { TailwidCssRoute } from "./tailwind.ts"

export const router = HttpRouter.empty.pipe(
  HttpRouter.get("/yo", HttpServerResponse.text("yo")),
  // TODO: is there a way to expose directory as a static route?
  HttpRouter.get("/app.css", TailwidCssRoute),
  HttpRouter.all("*", FrontendRoute),
)

const app = router.pipe(
  HttpServer.serve(),
  HttpServer.withLogAddress,
  Layer.provide(BunHttpServer.layerServer({
    port: 3000,
  })),
  Layer.provide(BunFileSystem.layer),
  Layer.provide(BunPath.layer),
)

if (import.meta.main) {
  Effect.runPromise(
    Layer.launch(app)
      .pipe(
        Effect.provide(BunBuild.make({
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
        })),
        Effect.catchAll(Console.error),
      ),
  )
}
