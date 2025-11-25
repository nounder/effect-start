import * as Cookies from "@effect/platform/Cookies"
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpServer from "@effect/platform/HttpServer"
import * as HttpServerError from "@effect/platform/HttpServerError"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Socket from "@effect/platform/Socket"
import type { Server as BunServerInstance } from "bun"
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

export type ServeOptions<R extends string = string> =
  & Omit<Bun.Serve.Options<undefined, R>, "fetch" | "error" | "websocket">
  & { readonly routes?: Bun.Serve.Routes<undefined, R> }

export interface BunServer<R extends string = string> {
  readonly server: Bun.Server<undefined>
  readonly reload: (options: {
    fetch: (
      request: Request,
      server: Bun.Server<undefined>,
    ) => Response | Promise<Response>
  }) => void
}

export const BunServer = Context.GenericTag<BunServer>(
  "effect-start/BunHttpServer",
)

export const make = <R extends string = string>(
  options: ServeOptions<R>,
): Effect.Effect<BunServer<R>, never, Scope.Scope> =>
  Effect.gen(function*() {
    const handlerStack: Array<
      (
        request: Request,
        server: BunServerInstance<undefined>,
      ) => Response | Promise<Response>
    > = [
      function(_request, _server) {
        return new Response("not found", { status: 404 })
      },
    ]

    const server = Bun.serve<WebSocketContext>({
      ...options,
      fetch: handlerStack[0],
      websocket: {
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
      },
    })

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        server.stop()
      })
    )

    const routes = options.routes

    return BunServer.of({
      server: server as unknown as Bun.Server<undefined>,
      reload({ fetch }) {
        handlerStack.push(fetch)
        server.reload({
          fetch,
          routes,
        })
      },
    })
  })

export const layer = <R extends string = string>(
  options: ServeOptions<R>,
): Layer.Layer<BunServer<R>> => Layer.scoped(BunServer, make(options))

export const makeHttpServer = <R extends string = string>(
  options: ServeOptions<R>,
): Effect.Effect<HttpServer.HttpServer, never, Scope.Scope> =>
  Effect.gen(function*() {
    const handlerStack: Array<
      (
        request: Request,
        server: BunServerInstance<WebSocketContext>,
      ) => Response | Promise<Response>
    > = [
      function(_request, _server) {
        return new Response("not found", { status: 404 })
      },
    ]

    const server = Bun.serve<WebSocketContext>({
      ...options,
      fetch: handlerStack[0],
      websocket: {
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
      },
    })

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        server.stop()
      })
    )

    const routes = options.routes

    return HttpServer.make({
      address: {
        _tag: "TcpAddress",
        port: server.port!,
        hostname: server.hostname!,
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
            bunServer: BunServerInstance<WebSocketContext>,
          ) {
            return new Promise<Response>((resolve, _reject) => {
              const fiber = runFork(Effect.provideService(
                app,
                HttpServerRequest.HttpServerRequest,
                new ServerRequestImpl(
                  request,
                  resolve,
                  removeHost(request.url),
                  bunServer,
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
              handlerStack.push(handler)
              server.reload({
                fetch: handler,
                routes,
              })
            }),
            () =>
              Effect.sync(() => {
                handlerStack.pop()
                server.reload({
                  fetch: handlerStack[handlerStack.length - 1],
                  routes,
                })
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

export const layerServer = <R extends string = string>(
  options: ServeOptions<R>,
): Layer.Layer<
  HttpServer.HttpServer
> =>
  Layer.scoped(
    HttpServer.HttpServer,
    makeHttpServer(options),
  )

const removeHost = (url: string) => {
  if (url[0] === "/") {
    return url
  }
  const index = url.indexOf("/", url.indexOf("//") + 2)
  return index === -1 ? "/" : url.slice(index)
}
