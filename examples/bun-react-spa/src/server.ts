import {
  HttpRouter,
  HttpServerResponse,
} from "@effect/platform"
import { BundleHttp } from "effect-start"
import { BunStart } from "effect-start/bun"
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
