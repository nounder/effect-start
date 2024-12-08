import { Context, Effect, Layer } from "effect"
import { createServer, ViteDevServer } from "vite"
import { createViteConfig, createViteDevHandler } from "./dev.ts"
import {
  Headers,
  HttpApp,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"

export class Vite extends Context.Tag("Vite")<Vite, {
  server: ViteDevServer
  handler: (req: Request) => Promise<Response> | Response
}>() {}

export const ViteDev = Layer.scoped(
  Vite,
  Effect.acquireRelease(
    Effect.tryPromise(async () => {
      const config = await createViteConfig({
        appType: "custom",
      })
      const server = await createServer(config)
      const handler = await createViteDevHandler(server)

      return {
        server,
        handler,
      }
    }),
    (vite) =>
      Effect.gen(function* () {
        yield* Effect.log("Closing Vite Dev Server...")
        yield* Effect.promise(async () => {
          await vite.server.waitForRequestsIdle()
          await vite.server.close()
        })
      }),
  ),
)

export const ViteDevHttpRouteHandler = Effect.gen(function* () {
  const vite = yield* Vite
  const req = yield* HttpServerRequest.HttpServerRequest
  const sourceReq = req.source

  if (sourceReq instanceof Request) {
    const res = yield* Effect.tryPromise(() =>
      Promise.resolve(vite.handler(sourceReq))
    )

    // todo: cookies are not passed?
    return HttpServerResponse.raw(res.body, {
      status: res.status,
      headers: Headers.fromInput(res.headers as any),
    })
  }

  throw new Error("Invalid request")
})
