import * as Cookies from "@effect/platform/Cookies"
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpServer from "@effect/platform/HttpServer"
import * as HttpServerError from "@effect/platform/HttpServerError"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Socket from "@effect/platform/Socket"
import * as Bun from "bun"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FiberSet from "effect/FiberSet"
import * as Layer from "effect/Layer"
import type * as Runtime from "effect/Runtime"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import {
  ServerRequestImpl,
  WebSocketContext,
} from "./BunHttpServer_request.ts"
import type * as BunRoute from "./BunRoute.ts"

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

export type BunServer = {
  readonly server: Bun.Server<WebSocketContext>
  readonly addRoutes: (routes: BunRoute.BunRoutes) => void
  // TODO: we probably don't want to expose these methods publicly
  readonly pushHandler: (fetch: FetchHandler) => void
  readonly popHandler: () => void
}

export const BunServer = Context.GenericTag<BunServer>(
  "effect-start/BunHttpServer",
)

export const make = (
  options: ServeOptions,
): Effect.Effect<
  BunServer,
  never,
  Scope.Scope
> =>
  Effect.gen(function*() {
    const handlerStack: Array<FetchHandler> = [
      function(_request, _server) {
        return new Response("not found", { status: 404 })
      },
    ]

    let currentRoutes: BunRoute.BunRoutes = {}

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
      ...options,
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

    return BunServer.of({
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
  options: ServeOptions,
): Layer.Layer<BunServer> => Layer.scoped(BunServer, make(options))

export const makeHttpServer: Effect.Effect<
  HttpServer.HttpServer,
  never,
  Scope.Scope | BunServer
> = Effect.gen(function*() {
  const bunServer = yield* BunServer

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

const makeResponse = (
  request: HttpServerRequest.HttpServerRequest,
  response: HttpServerResponse.HttpServerResponse,
  runtime: Runtime.Runtime<never>,
): Response => {
  const fields: {
    headers: globalThis.Headers
    status?: number
    statusText?: string
  } = {
    headers: new globalThis.Headers(response.headers),
    status: response.status,
  }

  if (!Cookies.isEmpty(response.cookies)) {
    for (const header of Cookies.toSetCookieHeaders(response.cookies)) {
      fields.headers.append("set-cookie", header)
    }
  }

  if (response.statusText !== undefined) {
    fields.statusText = response.statusText
  }

  if (request.method === "HEAD") {
    return new Response(undefined, fields)
  }
  const ejectedResponse = HttpApp.unsafeEjectStreamScope(response)
  const body = ejectedResponse.body
  switch (body._tag) {
    case "Empty": {
      return new Response(undefined, fields)
    }
    case "Uint8Array":
    case "Raw": {
      if (body.body instanceof Response) {
        for (const [key, value] of fields.headers.entries()) {
          body.body.headers.set(key, value)
        }
        return body.body
      }
      return new Response(body.body as BodyInit, fields)
    }
    case "FormData": {
      return new Response(body.formData as FormData, fields)
    }
    case "Stream": {
      return new Response(
        Stream.toReadableStreamRuntime(body.stream, runtime),
        fields,
      )
    }
  }
}

export const layerServer = (
  options: ServeOptions,
): Layer.Layer<HttpServer.HttpServer | BunServer> =>
  Layer.provideMerge(
    Layer.scoped(HttpServer.HttpServer, makeHttpServer),
    layer(options),
  )

const removeHost = (url: string) => {
  if (url[0] === "/") {
    return url
  }
  const index = url.indexOf("/", url.indexOf("//") + 2)
  return index === -1 ? "/" : url.slice(index)
}
