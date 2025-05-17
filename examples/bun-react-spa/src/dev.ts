import { HttpServer } from "@effect/platform"
import { BunContext, BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Layer, pipe } from "effect"
import { BunBundle } from "effect-bundler"
import { App } from "./server.ts"

const BrowserBundle = BunBundle.bundleBrowser(
  BunBundle.configFromHttpRouter(App),
)

if (import.meta.main) {
  pipe(
    HttpServer.serve(App).pipe(
      HttpServer.withLogAddress,
    ),
    // todo: how to close it when a server restarts
    // dis called multiple times on ctrl-c for multiple hot reloads
    // we want to ensure that the process get restarted
    Layer.provide(
      Layer.effectDiscard(Effect.gen(function*() {
        yield* Console.log("yoo")
        yield* Effect.addFinalizer((exit) => Console.log("byyte", exit._op))
      })),
    ),
    Layer.provide(
      BunHttpServer.layer({
        port: 3000,
      }),
    ),
    Layer.provide(BrowserBundle.devLayer),
    Layer.provide(BunContext.layer),
    Layer.launch,
    Effect.scoped,
    BunRuntime.runMain,
  )
}
