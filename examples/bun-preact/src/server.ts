import {
  FetchHttpClient,
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
  BunTailwindPlugin,
} from "effect-bundler/bun"
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

const ClientBundle = BunBundle
  .bundleClient({
    entrypoints: [
      IndexHtml,
    ],
    conditions: ["development"],
    define: {
      NODE_ENV: "development",
    },
    publicPath: `${BundlePath}/`,
    plugins: [
      BunTailwindPlugin.make(),
    ],
  })

export const layerServer = () =>
  pipe(
    HttpServer.serve(App.pipe(
      Effect.catchAll(HttpAppExtra.renderError),
    )),
    HttpServer.withLogAddress,
    Layer.provide([
      FetchHttpClient.layer,
      BunHttpServer.layer({
        port: 3400,
      }),
    ]),
  )

if (import.meta.main) {
  pipe(
    layerServer(),
    Layer.provide([
      ClientBundle.devLayer,
      BunContext.layer,
    ]),
    Layer.launch,
    BunRuntime.runMain,
  )
}
