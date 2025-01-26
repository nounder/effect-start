import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { Console, Effect, Layer } from "effect"
import { TailwidCssRoute } from "./tailwind.ts"
import { FrontendRoute } from "./solid.ts"
import { BunFileSystem, BunHttpServer, BunPath, BunRuntime } from "@effect/platform-bun"
import * as BunBuild from "./bun/BunBuild.ts"

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
            Bun.fileURLToPath(import.meta.resolve("./entry-client.tsx"))
          ],
          plugins: [
            await import("bun-plugin-solid").then(v => v.SolidPlugin({
              generate: "dom",
              hydratable: true
            }))
          ]
        })),
        Effect.catchAll(Console.error),
      ),
  )
}
