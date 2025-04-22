import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { BunContext, BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer, pipe } from "effect"
import { Bundle, HttpAppExtra } from "effect-bundler"
import { SsrApp } from "./Ssr.tsx"

const ApiApp = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/yo",
    HttpServerResponse.text("yo"),
  ),
  HttpRouter.get(
    "/error",
    Effect.gen(function*() {
      throw new Error("custom error")

      return HttpServerResponse.text("this will never be reached")
    }),
  ),
  HttpRouter.mountApp(
    "/.bundle",
    Bundle.toHttpApp(Bundle.tagged("ClientBundle")),
  ),
  HttpRouter.catchAllCause(HttpAppExtra.renderError),
  Effect.catchTag(
    "RouteNotFound",
    e =>
      HttpServerResponse.empty({
        status: 404,
      }),
  ),
)

export const Server = HttpAppExtra.chain([
  ApiApp,
  SsrApp,
])

if (import.meta.main) {
  pipe(
    HttpServer.serve(Server).pipe(
      HttpServer.withLogAddress,
    ),
    Layer.provide(
      BunHttpServer.layer({
        port: 3000,
      }),
    ),
    Layer.provide(
      Layer.effect(
        Bundle.tagged("ClientBundle"),
        Bundle.fromFiles("out/client"),
      ),
    ),
    Layer.provide(BunContext.layer),
    Layer.launch,
    BunRuntime.runMain,
  )
}
