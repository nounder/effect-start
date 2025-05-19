import { HttpRouter, HttpServerResponse } from "@effect/platform"
import { BundleHttp } from "effect-bundler"
import { BunBundle, BunStart } from "effect-bundler/bun"
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
  BunStart.serveRouter(App)
}
