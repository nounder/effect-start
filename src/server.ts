import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { Console, Effect, Layer } from "effect"
import { ViteDev } from "./vite/effect.ts"
import { DenoHttpServer } from "./effect/deno.ts"
import { TailwidCssRoute } from "./tailwind.ts"
import { FrontendRoute } from "./solid.ts"

export const router = HttpRouter.empty.pipe(
  HttpRouter.get("/yo", Effect.sync(() => HttpServerResponse.text("yo"))),
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
        Effect.provide(ViteDev),
        Effect.catchAll(Console.error),
      ),
  )
}
