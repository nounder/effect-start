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
  Layer,
  pipe,
} from "effect"
import { BundleHttp } from "effect-start"
import { BunBundle } from "effect-start/bun"
import { TanstackRouter } from "effect-start/x/tanstack-react-router"
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
    HttpServer.serve(App),
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
