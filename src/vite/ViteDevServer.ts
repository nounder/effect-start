import * as vite from "vite"
import {
  Headers,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { createViteConfig } from "./config.ts"
import { Effect, Layer, pipe } from "effect"
import { Vite } from "./Vite.ts"
import { createViteDevServerHandler } from "./dev.ts"

export const make = (opts: {
  config?: vite.InlineConfig
} = {}) =>
  Layer.scoped(
    Vite,
    pipe(
      Effect.acquireRelease(
        Effect.tryPromise(async () => {
          const config = await createViteConfig({
            appType: "custom",

            ...(opts.config ?? {}),
          })
          const server = await vite.createServer(config)
          const handler = await createViteDevServerHandler(server)

          return {
            server,
            fetch: handler,
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
      Effect.andThen((vite) => {
        return {
          fetch: vite.fetch,
        }
      }),
    ),
  )

export const ViteDevServerHttpRoute = Effect.gen(function* () {
  const vite = yield* Vite
  const req = yield* HttpServerRequest.HttpServerRequest
  const sourceReq = req.source

  if (sourceReq instanceof Request) {
    const res = yield* Effect.tryPromise(() =>
      Promise.resolve(vite.fetch(sourceReq))
    )

    // todo: cookies are not passed?
    return HttpServerResponse.raw(res.body, {
      status: res.status,
      headers: Headers.fromInput(res.headers as any),
    })
  }

  throw new Error("Invalid request")
})
