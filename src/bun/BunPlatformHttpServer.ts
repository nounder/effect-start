import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpServer from "@effect/platform/HttpServer"
import * as HttpServerError from "@effect/platform/HttpServerError"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import type * as Bun from "bun"
import * as Effect from "effect/Effect"
import * as FiberSet from "effect/FiberSet"
import type * as Scope from "effect/Scope"
import * as BunServer from "./BunServer.ts"
import * as BunServerRequest from "./BunServerRequest.ts"

/**
 * From times when we used @effect/platform
 * Not used any more internally. Kept for the future,
 * in case someone will need it for whatever reason. [2026]
 */
export const make: Effect.Effect<
  HttpServer.HttpServer,
  never,
  Scope.Scope | BunServer.BunServer
> = Effect.gen(function*() {
  const bunServer = yield* BunServer.BunServer

  return HttpServer.make({
    address: {
      _tag: "TcpAddress",
      port: bunServer.server.port!,
      hostname: bunServer.server.hostname!,
    },
    serve(httpApp, middleware) {
      return Effect.gen(function*() {
        const runFork = yield* FiberSet.makeRuntime<never>()
        const runtime = yield* Effect.runtime<never>()
        const app = HttpApp.toHandled(
          httpApp,
          (request, response) =>
            Effect.sync(() => {
              ;(request as BunServerRequest.ServerRequestImpl).resolve(
                BunServerRequest.makeResponse(request, response, runtime),
              )
            }),
          middleware,
        )

        function handler(
          request: Request,
          server: Bun.Server<BunServerRequest.WebSocketContext>,
        ) {
          return new Promise<Response>((resolve, _reject) => {
            const fiber = runFork(Effect.provideService(
              app,
              HttpServerRequest.HttpServerRequest,
              new BunServerRequest.ServerRequestImpl(
                request,
                resolve,
                removeHost(request.url),
                server,
              ),
            ))
            request.signal.addEventListener("abort", () => {
              runFork(
                fiber.interruptAsFork(HttpServerError.clientAbortFiberId),
              )
            }, { once: true })
          })
        }

        yield* Effect.acquireRelease(
          Effect.sync(() => {
            bunServer.pushHandler(handler)
          }),
          () =>
            Effect.sync(() => {
              bunServer.popHandler()
            }),
        )
      })
    },
  })
})

const removeHost = (url: string) => {
  if (url[0] === "/") {
    return url
  }
  const index = url.indexOf("/", url.indexOf("//") + 2)
  return index === -1 ? "/" : url.slice(index)
}
