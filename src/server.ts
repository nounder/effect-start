import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { Console, Effect, Layer } from "effect"
import { DenoHttpServer } from "./effect/deno.ts"
import { TailwidCssRoute } from "./tailwind.ts"
import { FrontendRoute } from "./solid.ts"
import * as ViteDevServer from "./vite/ViteDevServer.ts"

export const router = HttpRouter.empty.pipe(
  HttpRouter.get("/yo", HttpServerResponse.text("yo")),
  // TODO: is there a way to expose directory as a static route?
  HttpRouter.get("/app.css", TailwidCssRoute),
  HttpRouter.all("*", FrontendRoute),
)

const app = router.pipe(
  HttpServer.serve(),
  HttpServer.withLogAddress,
  Layer.provide(DenoHttpServer),
)

if (import.meta.main) {
  Effect.runPromise(
    Layer.launch(app)
      .pipe(
        Effect.provide(ViteDevServer.make()),
        Effect.catchAll(Console.error),
      ),
  )
}
