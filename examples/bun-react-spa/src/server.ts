import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { BunContext, BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Layer, pipe } from "effect"
import { Bundle, BundleHttp } from "effect-bundler"
import IndexHtml from "./index.html" with { type: "file" }

export const App = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    BundleHttp.handleEntrypoint(IndexHtml),
  ),
  HttpRouter.mountApp(
    "/_bundle",
    BundleHttp.httpApp(),
  ),
  HttpRouter.get(
    "/hello",
    HttpServerResponse.text("Hello World!"),
  ),
)

if (import.meta.main) {
  pipe(
    HttpServer.serve(App).pipe(
      HttpServer.withLogAddress,
    ),
    Layer.provide(
      BunHttpServer.layer({
        port: 3000,
      }),
    ),
    Layer.provide(
      Layer.effect(
        Bundle.tagged("BrowserBundle"),
        Bundle.fromFiles("out/client"),
      ),
    ),
    Layer.provide(BunContext.layer),
    Layer.launch,
    BunRuntime.runMain,
  )
}
