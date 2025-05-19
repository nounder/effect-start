import { HttpRouter, HttpServerResponse } from "@effect/platform"
import { Bundle, BundleHttp } from "effect-bundler"
import { BunStart } from "effect-bundler/bun"
import IndexHtml from "./index.html" with { type: "file" }

export const App = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    BundleHttp.handleEntrypoint(),
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
  BunStart.serve({
    server: App,
    client: Bundle.fromFiles("out/client"),
  })
}
