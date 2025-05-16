import { HttpServer } from "@effect/platform"
import { BunContext, BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer, pipe } from "effect"
import { BunBundle, BunTailwindPlugin } from "effect-bundler"

const ServerBundle = BunBundle.bundleServer<typeof import("./server.ts")>(
  import.meta.resolve("./server.ts"),
)

// const ClientBundle = pipe(
//   ServerBundle.load(),
//   Effect.map(v => v.App),
//   Effect.andThen(router => ({
//     ...BunBundle.configFromHttpRouter(router),
//     plugins: [
//       BunTailwindPlugin.make(),
//     ],
//   })),
//   Effect.map(v => BunBundle.bundleBrowser(v)),
// )

const Server = ServerBundle.load()

const App = pipe(
  Server,
  Effect.andThen(mod => mod.App),
)

const BrowserBundle = pipe(
  Server,
  Effect.map(v => v.App),
  Effect.andThen(router => {
    return {
      ...BunBundle.configFromHttpRouter(router),
      plugins: [
        BunTailwindPlugin.make(),
      ],
    }
  }),
  Effect.tap(Effect.log),
  Effect.map(v => BunBundle.bundleBrowser(v)),
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
    Layer.provide(
      Layer.unwrapEffect(BrowserBundle.pipe(
        Effect.andThen(v => v.devLayer),
      )),
    ),
    Layer.provide(BunContext.layer),
    Layer.launch,
    BunRuntime.runMain,
  )
}
