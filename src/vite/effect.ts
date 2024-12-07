import { Context, Effect, Layer } from "effect"
import { createServer, ViteDevServer } from "vite"
import { createViteConfig, createViteDevHandler } from "./dev.ts"
import {
  Headers,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"

export class Vite extends Context.Tag("Vite")<Vite, {
  server: ViteDevServer
  handler: (req: Request) => Promise<Response> | Response
}>() {}

export const ViteDev = Layer.effect(
  Vite,
  Effect.tryPromise(async () => {
    if (globalThis.cachedViteDevServer) {
      const server = globalThis.cachedViteDevServer
      const handler = await createViteDevHandler(server)

      return {
        server,
        handler,
      }
    }

    const config = await createViteConfig()
    const server = await createServer(config)
    const handler = await createViteDevHandler(server)

    globalThis.cachedViteDevServer = server

    return {
      server,
      handler,
    }
  }).pipe(
    // Make sure server is closed
    Effect.tap((vite) =>
      Effect.addFinalizer(() =>
        Effect.promise(async () => {
          await vite.server.waitForRequestsIdle()
          await vite.server.close()
        })
      )
    ),
  ),
)

export const ViteDevHttpRouteHandler = Effect.gen(function* () {
  const vite = yield* Vite
  const req = yield* HttpServerRequest.HttpServerRequest
  const fetchHandler = yield* Effect.promise(() =>
    createViteDevHandler(vite.server)
  )
  const fetchReq = req.source

  if (!(fetchReq instanceof Request)) {
    throw new Error("request must be standard web Request")
  }

  const res = yield* Effect.tryPromise(() =>
    Promise.resolve(
      fetchHandler(fetchReq)
        // Effect seems to drain response stream twice
        // causing vite to return gateway error for all
        // subsequent requests
        .then((v) => v.clone()),
    )
  )

  return HttpServerResponse.raw(res.body, {
    headers: Headers.fromInput(res.headers as any),
  })
})
