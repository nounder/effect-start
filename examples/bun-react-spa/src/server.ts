import { HttpRouter, HttpServerResponse } from "@effect/platform"
import { BundleHttp } from "effect-bundler"
import { BunStart } from "effect-bundler/bun"
import IndexHtml from "./index.html" with { type: "file" }

export const App = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    BundleHttp.entrypoint(IndexHtml),
  ),
  HttpRouter.get(
    "/hello",
    HttpServerResponse.text("Hello World!"),
  ),
)

if (import.meta.main) {
  BunStart.serveRouter(App)
}
