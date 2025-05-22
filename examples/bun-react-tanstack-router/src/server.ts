import { HttpRouter, HttpServerResponse } from "@effect/platform"
import { TanStackRouterEsbuild } from "@tanstack/router-plugin/esbuild"
import { BundleHttp } from "effect-bundler"
import { BunStart } from "effect-bundler/bun"
import IndexHtml from "./index.html" with { type: "file" }

export const App = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    BundleHttp.entrypoint(IndexHtml),
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
  BunStart.serveRouter(App, {
    clientConfig: {
      plugins: [
        // @ts-ignore
        TanStackRouterEsbuild({
          target: "react",
          autoCodeSplitting: true,
        }),
      ],
    },
  })
}
