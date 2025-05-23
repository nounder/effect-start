import {
  HttpMiddleware,
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
  ViteDevServer,
} from "effect-bundler/vite"

const App = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    HttpServerResponse.text("yo"),
  ),
  HttpRouter.get(
    "/yo",
    HttpServerResponse.text("yo"),
  ),
  HttpRouter.use(ViteDevServer.httpMiddleware),
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
    Layer.provide(BunContext.layer),
    Layer.launch,
    BunRuntime.runMain,
  )
}
