import {
  Headers,
  HttpMiddleware,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import {
  Effect,
  Layer,
  pipe,
} from "effect"
import {
  Context,
} from "effect"
import * as vite from "vite"
import {
  createViteConfig,
} from "./config.ts"
import {
  createViteDevServerHandler,
} from "./dev.ts"

export class ViteDevServer extends Context.Tag("ViteDevServer")<ViteDevServer, {
  fetch: (req: Request) => Promise<Response> | Response
}>() {}

export const layer = (config?: vite.InlineConfig) =>
  Layer.scoped(
    ViteDevServer,
    pipe(
      Effect.acquireRelease(
        Effect.tryPromise(async () => {
          const viteConfig = await createViteConfig({
            appType: "custom",

            ...(config ?? {}),
          })
          const server = await vite.createServer(viteConfig)
          const handler = await createViteDevServerHandler(server)

          return {
            server,
            fetch: handler,
          }
        }),
        (vite) =>
          Effect.gen(function*() {
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

export const httpMiddleware = HttpMiddleware.make(app =>
  Effect.gen(function*() {
    const viteResponse = yield* HttpApp

    if (viteResponse.status >= 200 && viteResponse.status < 300) {
      return viteResponse
    }

    return yield* app
  })
)

export const HttpApp = Effect.gen(function*() {
  console.log("yoo")
  const vite = yield* ViteDevServer
  console.log(vite)
  const req = yield* HttpServerRequest.HttpServerRequest
  const sourceReq = req.source

  console.log(req, sourceReq)

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

  return yield* Effect.fail(new Error("Invalid source request"))
})
