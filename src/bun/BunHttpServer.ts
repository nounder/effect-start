import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpServer from "@effect/platform/HttpServer"
import * as HttpServerError from "@effect/platform/HttpServerError"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Socket from "@effect/platform/Socket"
import * as Bun from "bun"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FiberSet from "effect/FiberSet"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Scope from "effect/Scope"
import * as FileRouter from "../FileRouter.ts"
import * as Random from "../Random.ts"
import EmptyHTML from "./_empty.html"
import {
  makeResponse,
  ServerRequestImpl,
  WebSocketContext,
} from "./BunHttpServer_web.ts"
import * as BunRoute from "./BunRoute.ts"

type FetchHandler = (
  request: Request,
  server: Bun.Server<WebSocketContext>,
) => Response | Promise<Response>

/**
 * Basically `Omit<Bun.Serve.Options, "fetch" | "error" | "websocket">`
 * TypeScript 5.9 cannot verify discriminated union types used in
 * {@link Bun.serve} so we need to define them explicitly.
 */
interface ServeOptions {
  readonly port?: number
  readonly hostname?: string
  readonly reusePort?: boolean
  readonly ipv6Only?: boolean
  readonly idleTimeout?: number
  readonly development?: boolean
}

export type BunHttpServer = {
  readonly server: Bun.Server<WebSocketContext>
  readonly addRoutes: (routes: BunRoute.BunRoutes) => void
  // TODO: we probably don't want to expose these methods publicly
  readonly pushHandler: (fetch: FetchHandler) => void
  readonly popHandler: () => void
}

export const BunHttpServer = Context.GenericTag<BunHttpServer>(
  "effect-start/BunServer",
)

export const make = (
  options: ServeOptions,
): Effect.Effect<
  BunHttpServer,
  never,
  Scope.Scope
> =>
  Effect.gen(function*() {
    const port = yield* Config.number("PORT").pipe(
      Effect.catchTag("ConfigError", () => {
        if (
          typeof process !== "undefined"
          && !process.stdout.isTTY
          && process.env.CLAUDECODE
        ) {
          return Effect.succeed(0)
        }

        return Effect.succeed(3000)
      }),
    )
    const hostname = yield* Config.string("HOSTNAME").pipe(
      Effect.catchTag("ConfigError", () => Effect.succeed(undefined)),
    )

    const handlerStack: Array<FetchHandler> = [
      function(_request, _server) {
        return new Response("not found", { status: 404 })
      },
    ]

    let currentRoutes: BunRoute.BunRoutes = {}

    // Bun HMR doesn't work on successive calls to `server.reload` if there are no routes
    // on server start. We workaround that by passing a dummy HTMLBundle [2025-11-26]
    // see: https://github.com/oven-sh/bun/issues/23564
    currentRoutes[`/.BunEmptyHtml-${Random.token(6)}`] = EmptyHTML

    const websocket: Bun.WebSocketHandler<WebSocketContext> = {
      open(ws) {
        Deferred.unsafeDone(ws.data.deferred, Exit.succeed(ws))
      },
      message(ws, message) {
        ws.data.run(message)
      },
      close(ws, code, closeReason) {
        Deferred.unsafeDone(
          ws.data.closeDeferred,
          Socket.defaultCloseCodeIsError(code)
            ? Exit.fail(
              new Socket.SocketCloseError({
                reason: "Close",
                code,
                closeReason,
              }),
            )
            : Exit.void,
        )
      },
    }

    const server = Bun.serve({
      port,
      hostname,
      ...options,
      routes: currentRoutes,
      fetch: handlerStack[0],
      websocket,
    })

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        server.stop()
      })
    )

    const reload = () => {
      server.reload({
        fetch: handlerStack[handlerStack.length - 1],
        routes: currentRoutes,
        websocket,
      })
    }

    return BunHttpServer.of({
      server,
      pushHandler(fetch) {
        handlerStack.push(fetch)
        reload()
      },
      popHandler() {
        handlerStack.pop()
        reload()
      },
      addRoutes(routes) {
        currentRoutes = {
          ...currentRoutes,
          ...routes,
        }
        reload()
      },
    })
  })

export const layer = (
  options?: ServeOptions,
): Layer.Layer<BunHttpServer> =>
  Layer.scoped(BunHttpServer, make(options ?? {}))

export const makeHttpServer: Effect.Effect<
  HttpServer.HttpServer,
  never,
  Scope.Scope | BunHttpServer
> = Effect.gen(function*() {
  const bunServer = yield* BunHttpServer

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
              ;(request as ServerRequestImpl).resolve(
                makeResponse(request, response, runtime),
              )
            }),
          middleware,
        )

        function handler(
          request: Request,
          server: Bun.Server<WebSocketContext>,
        ) {
          return new Promise<Response>((resolve, _reject) => {
            const fiber = runFork(Effect.provideService(
              app,
              HttpServerRequest.HttpServerRequest,
              new ServerRequestImpl(
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

export const layerServer = (
  options?: ServeOptions,
): Layer.Layer<HttpServer.HttpServer | BunHttpServer> =>
  Layer.provideMerge(
    Layer.scoped(HttpServer.HttpServer, makeHttpServer),
    layer(options ?? {}),
  )

/**
 * Adds routes from {@like FileRouter.FileRouter} to Bun Server.
 *
 * It ain't clean but it works until we figure out interfaces
 * for other servers.
 */
export function layerFileRouter() {
  return Layer.effectDiscard(
    Effect.gen(function*() {
      const bunServer = yield* BunHttpServer
      const manifest = yield* Effect.serviceOption(FileRouter.FileRouter)

      if (Option.isSome(manifest)) {
        const router = yield* FileRouter.fromManifest(manifest.value)
        const bunRoutes = yield* BunRoute.routesFromRouter(router)
        bunServer.addRoutes(bunRoutes)
      }
    }),
  )
}

const removeHost = (url: string) => {
  if (url[0] === "/") {
    return url
  }
  const index = url.indexOf("/", url.indexOf("//") + 2)
  return index === -1 ? "/" : url.slice(index)
}
