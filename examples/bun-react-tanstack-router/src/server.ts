import {
  HttpRouter,
  HttpServer,
  HttpServerResponse,
} from "@effect/platform"
import {
  BunContext,
  BunHttpServer,
  BunRuntime,
} from "@effect/platform-bun"
import {
  Effect,
  Layer,
  pipe,
} from "effect"
import {
  BundleHttp,
  HttpAppExtra,
} from "effect-bundler"
import {
  BunBundle,
} from "effect-bundler/bun"
import {
  TanstackRouter,
} from "effect-bundler/x/tanstack-react-router"
import IndexHtml from "./index.html" with { type: "file" }

const BundlePath = "/_bundle"

export const App = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    BundleHttp.entrypoint(),
  ),
  HttpRouter.mountApp(
    BundlePath,
    BundleHttp.httpApp(),
  ),
  HttpRouter.get(
    "/hello",
    HttpServerResponse.text("Hello World!"),
  ),
)

if (import.meta.main) {
  pipe(
    HttpServer.serve(App.pipe(
      Effect.catchAll(HttpAppExtra.renderError),
    )),
    HttpServer.withLogAddress,
    Layer.provide([
      BunHttpServer.layerServer({
        port: 3000,
      }),
      BunBundle
        .bundleClient({
          entrypoints: [
            IndexHtml,
          ],
          publicPath: `${BundlePath}/`,
        })
        .devLayer,
      TanstackRouter.layer(),
    ]),
    Layer.provide(BunContext.layer),
    Layer.launch,
    BunRuntime.runMain,
  )
}
