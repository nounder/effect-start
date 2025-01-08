import { HttpApp, HttpServer } from "@effect/platform"
import { Effect, Layer } from "effect"

export const DenoHttpServer = Layer.scoped(
  HttpServer.HttpServer,
  Effect.runtime().pipe(Effect.andThen((runtime) =>
    HttpServer.make({
      serve: (app) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const handler = HttpApp.toWebHandlerRuntime(runtime)(app)

            return Deno.serve({
              hostname: "0.0.0.0",
              port: 8000,
              onListen: () => {},
            }, (req) => handler(req))
          }),
          (server) =>
            Effect.promise(async () => {
              await server.shutdown()
            }),
        ),
      address: {
        _tag: "TcpAddress",
        hostname: "0.0.0.0",
        port: 8000,
      },
    })
  )),
)
