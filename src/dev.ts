import { HttpServer } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer, pipe } from "effect"
import * as Bundle from "./bun/Bundle.ts"

const main = Effect.gen(function*() {
  const bundle = yield* Bundle.build<typeof import("./router.ts")>(
    import.meta.resolve("./router.ts"),
  )

  yield* pipe(
    Layer.scopedDiscard(
      HttpServer.serveEffect(bundle.effect),
    ),
    HttpServer.withLogAddress,
    Layer.launch,
  )
})

BunRuntime.runMain(pipe(
  main,
  Effect.provide(BunHttpServer.layer({
    port: 3000,
  })),
))
