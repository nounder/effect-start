import { HttpRouter, HttpServerResponse } from "@effect/platform"
import { SolidPlugin } from "bun-plugin-solid"
import { BunBundle, BundleHttp, BunTailwindPlugin } from "effect-bundler"
import { BunStart } from "effect-bundler/bun"

export const ClientBundle = BunBundle.bundleClient({
  entrypoints: [],
  conditions: [
    "solid",
  ],
  sourcemap: "external",
  packages: "bundle",
  plugins: [
    SolidPlugin({
      generate: "dom",
      hydratable: false,
    }),
    BunTailwindPlugin.make(() => import("@tailwindcss/node")),
  ],
})

export const App = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    BundleHttp.handleEntrypoint(import.meta.resolve("./index.html")),
  ),
  HttpRouter.mountApp(
    "/.bundle",
    BundleHttp.httpApp(),
  ),
  HttpRouter.get(
    "/hello",
    HttpServerResponse.text("Hello World!"),
  ),
)

if (import.meta.main) {
  BunStart.serveRouter(App, {
    clientConfig: ClientBundle.config,
  })
}
