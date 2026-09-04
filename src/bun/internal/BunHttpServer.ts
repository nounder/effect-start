/**
 * Ported from effect@4.0.0-rc.112.
 */
import type { Server as NativeServer, ServerWebSocket } from "bun"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as FiberSet from "effect/FiberSet"
import type * as FileSystem from "effect/FileSystem"
import * as Inspectable from "effect/Inspectable"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Path from "effect/Path"
import type * as Record from "effect/Record"
import type * as Schema from "effect/Schema"
import * as Scope from "effect/Scope"
import * as Semaphore from "effect/Semaphore"
import * as Stream from "effect/Stream"
import * as Cookies from "effect/unstable/http/Cookies"
import * as Etag from "effect/unstable/http/Etag"
import * as Headers from "effect/unstable/http/Headers"
import * as HttpEffect from "effect/unstable/http/HttpEffect"
import * as IncomingMessage from "effect/unstable/http/HttpIncomingMessage"
import type * as HttpMethod from "effect/unstable/http/HttpMethod"
import type * as HttpPlatform from "effect/unstable/http/HttpPlatform"
import * as HttpServer from "effect/unstable/http/HttpServer"
import * as HttpServerError from "effect/unstable/http/HttpServerError"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import type * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import type * as Multipart from "effect/unstable/http/Multipart"
import * as UrlParams from "effect/unstable/http/UrlParams"
import * as Socket from "effect/unstable/socket/Socket"
import * as BunFileSystem from "../BunFileSystem.ts"
import * as BunPath from "../BunPath.ts"
import * as BunHttpPlatform from "./BunHttpPlatform.ts"
import * as BunMultipart from "./BunMultipart.ts"
import * as BunStream from "./BunStream.ts"
import * as MainFiber from "./MainFiber.ts"

export interface WebSocketContext {
  readonly deferred: Deferred.Deferred<ServerWebSocket<WebSocketContext>>
  readonly closeDeferred: Deferred.Deferred<void, Socket.SocketError>
  readonly buffer: Array<Uint8Array | string>
  run: (_: Uint8Array | string) => void
}

export type WebSocketOptions =
  & Omit<
    Bun.WebSocketHandler<WebSocketContext>,
    "open" | "message" | "close" | "drain" | "ping" | "pong" | "data" | "binaryType"
  >
  & {
    readonly compressionThreshold?: number
  }

export type ServeOptions =
  & (
    | Bun.Serve.UnixServeOptions<WebSocketContext>
    | Bun.Serve.HostnamePortServeOptions<WebSocketContext>
  )
  & {
    readonly routes?: Bun.Serve.Routes<WebSocketContext, string>
    readonly disablePreemptiveShutdown?: boolean
    readonly gracefulShutdownTimeout?: Duration.Input
    readonly websocket?: WebSocketOptions
  }

export interface ManagedServer {
  readonly service: HttpServer.HttpServer["Service"]
  readonly replaceRoutes: (
    routes: Bun.Serve.Routes<WebSocketContext, string>,
    generation: Fiber.Fiber<unknown, unknown> | undefined,
  ) => void
}

export const layerHttpServices: Layer.Layer<
  HttpPlatform.HttpPlatform | Etag.Generator | FileSystem.FileSystem | Path.Path
> = Layer.mergeAll(
  BunHttpPlatform.layer,
  Etag.layerWeak,
  BunFileSystem.layer,
  BunPath.layer,
)

type FetchHandler = (
  request: Request,
  server: NativeServer<WebSocketContext>,
) => Response | Promise<Response>

export const make = Effect.fnUntraced(function*(options: ServeOptions) {
  const initialGeneration = MainFiber.get()
  let ownerGeneration = initialGeneration
  const parentScope = yield* Effect.scope
  const compressionThreshold = options.websocket?.compressionThreshold ?? 1_024
  const websocket = { ...options.websocket }
  delete websocket.compressionThreshold

  const handlerStack: Array<FetchHandler> = [
    () => new Response("not found", { status: 404 }),
  ]
  const handlerGenerations = new Map<FetchHandler, Fiber.Fiber<unknown, unknown> | undefined>()
  const configuredRoutes = options.routes ?? {}
  let currentRoutes = configuredRoutes
  const server = Bun.serve<WebSocketContext, string>({
    ...options,
    routes: currentRoutes,
    fetch: handlerStack[0],
    websocket: {
      ...websocket,
      open(ws) {
        Deferred.doneUnsafe(ws.data.deferred, Exit.succeed(ws))
      },
      message(ws, message) {
        ws.data.run(message)
      },
      close(ws, code, closeReason) {
        const closeCode = typeof code === "number" ? code : 1001
        Deferred.doneUnsafe(
          ws.data.closeDeferred,
          Socket.defaultCloseCodeIsError(closeCode)
            ? Exit.fail(
              new Socket.SocketError({
                reason: new Socket.SocketCloseError({ code: closeCode, closeReason }),
              }),
            )
            : Exit.void,
        )
      },
    },
  })

  const stop = yield* Effect.promise(() => server.stop()).pipe(Effect.cached)
  const shutdown = (generation: Fiber.Fiber<unknown, unknown> | undefined) =>
    Effect.suspend(() => MainFiber.get() === generation && ownerGeneration === generation ? stop : Effect.void)
  const preemptiveShutdown = (generation: Fiber.Fiber<unknown, unknown> | undefined) =>
    options.disablePreemptiveShutdown
      ? Effect.void
      : Effect.timeoutOrElse(shutdown(generation), {
        duration: options.gracefulShutdownTimeout ?? Duration.seconds(20),
        orElse: () => Effect.void,
      })

  yield* Scope.addFinalizer(parentScope, shutdown(initialGeneration))

  const discardStaleHandlers = (generation: Fiber.Fiber<unknown, unknown> | undefined) => {
    for (let index = handlerStack.length - 1; index > 0; index--) {
      const handler = handlerStack[index]
      if (handlerGenerations.get(handler) === generation) continue
      handlerGenerations.delete(handler)
      handlerStack.splice(index, 1)
    }
  }

  const reload = (generation: Fiber.Fiber<unknown, unknown> | undefined) => {
    if (MainFiber.get() !== generation) return
    server.reload({
      fetch: handlerStack[handlerStack.length - 1],
      routes: currentRoutes,
    })
  }

  const service = HttpServer.make({
    address: "unix" in options && options.unix !== undefined
      ? { _tag: "UnixAddress", path: options.unix }
      : { _tag: "TcpAddress", port: server.port!, hostname: server.hostname! },
    serve: Effect.fnUntraced(function*(httpApp, middleware) {
      const generation = MainFiber.get()
      const parent = yield* Effect.fiber
      const services = parent.context
      const serveScope = Context.getUnsafe(services, Scope.Scope)
      const requestScope = Scope.forkUnsafe(serveScope, "parallel")
      const httpEffect = HttpEffect.toHandled(
        httpApp,
        (request, response) =>
          Effect.sync(() => {
            ;(request as BunServerRequest).resolve(
              makeResponse(request, response, services, requestScope),
            )
          }),
        middleware,
      )

      function handler(request: Request, nativeServer: NativeServer<WebSocketContext>) {
        return new Promise<Response>((resolve) => {
          const context = Context.add(
            services,
            HttpServerRequest.HttpServerRequest,
            new BunServerRequest(
              request,
              resolve,
              removeHost(request.url),
              nativeServer,
              compressionThreshold,
            ),
          )
          const fiber = Fiber.runIn(
            Effect.runForkWith(context)(httpEffect),
            requestScope,
          )
          request.signal.addEventListener(
            "abort",
            () => fiber.interruptUnsafe(parent.id, HttpServerError.ClientAbort.annotation),
            { once: true },
          )
        })
      }

      yield* Scope.addFinalizerExit(serveScope, () => {
        const index = handlerStack.indexOf(handler)
        if (index !== -1) {
          handlerStack.splice(index, 1)
          handlerGenerations.delete(handler)
        }
        reload(generation)
        return handlerStack.length === 1 ? preemptiveShutdown(generation) : Effect.void
      })
      if (MainFiber.get() !== generation) return
      discardStaleHandlers(generation)
      handlerStack.push(handler)
      handlerGenerations.set(handler, generation)
      ownerGeneration = generation
      reload(generation)
    }),
  })

  return {
    service,
    replaceRoutes(routes, generation) {
      if (MainFiber.get() !== generation) return
      discardStaleHandlers(generation)
      currentRoutes = { ...configuredRoutes, ...routes }
      reload(generation)
    },
  }
})

const makeResponse = (
  request: HttpServerRequest.HttpServerRequest,
  response: HttpServerResponse.HttpServerResponse,
  context: Context.Context<never>,
  scope: Scope.Scope,
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
  if (response.statusText !== undefined) fields.statusText = response.statusText
  if (request.method === "HEAD") return new Response(undefined, fields)

  const body = HttpEffect.scopeTransferToStream(response).body
  switch (body._tag) {
    case "Empty":
      return new Response(undefined, fields)
    case "Uint8Array":
    case "Raw": {
      if (body.body instanceof Response) {
        for (const [key, value] of fields.headers.entries()) {
          body.body.headers.set(key, value)
        }
        return body.body
      }
      return new Response(body.body as any, fields)
    }
    case "FormData":
      return new Response(body.formData as any, fields)
    case "Stream":
      return new Response(
        Stream.toReadableStreamWith(
          Stream.unwrap(Effect.withFiber((fiber) => {
            Fiber.runIn(fiber, scope)
            return Effect.succeed(body.stream)
          })),
          context,
        ),
        fields,
      )
  }
}

function wsDefaultRun(this: WebSocketContext, data: Uint8Array | string) {
  this.buffer.push(data)
}

class BunServerRequest extends Inspectable.Class implements HttpServerRequest.HttpServerRequest {
  readonly [HttpServerRequest.TypeId]: typeof HttpServerRequest.TypeId
  readonly [IncomingMessage.TypeId]: typeof IncomingMessage.TypeId
  readonly source: Request
  readonly url: string
  public resolve: (response: Response) => void
  public headersOverride?: Headers.Headers
  private bunServer: NativeServer<WebSocketContext>
  private compressionThreshold: number
  private remoteAddressOverride?: Option.Option<string>

  constructor(
    source: Request,
    resolve: (response: Response) => void,
    url: string,
    bunServer: NativeServer<WebSocketContext>,
    compressionThreshold: number,
    headersOverride?: Headers.Headers,
    remoteAddressOverride?: Option.Option<string>,
  ) {
    super()
    this[HttpServerRequest.TypeId] = HttpServerRequest.TypeId
    this[IncomingMessage.TypeId] = IncomingMessage.TypeId
    this.source = source
    this.resolve = resolve
    this.url = url
    this.bunServer = bunServer
    this.compressionThreshold = compressionThreshold
    this.headersOverride = headersOverride
    this.remoteAddressOverride = remoteAddressOverride
  }

  toJSON(): unknown {
    return IncomingMessage.inspect(this, {
      _id: "HttpServerRequest",
      method: this.method,
      url: this.originalUrl,
    })
  }

  modify(options: {
    readonly url?: string
    readonly headers?: Headers.Headers
    readonly remoteAddress?: Option.Option<string>
  }) {
    return new BunServerRequest(
      this.source,
      this.resolve,
      options.url ?? this.url,
      this.bunServer,
      this.compressionThreshold,
      options.headers ?? this.headersOverride,
      "remoteAddress" in options ? options.remoteAddress : this.remoteAddressOverride,
    )
  }

  get method(): HttpMethod.HttpMethod {
    return this.source.method.toUpperCase() as HttpMethod.HttpMethod
  }

  get originalUrl(): string {
    return this.source.url
  }

  get remoteAddress(): Option.Option<string> {
    return this.remoteAddressOverride ?? Option.fromNullishOr(this.bunServer.requestIP(this.source)?.address)
  }

  get headers(): Headers.Headers {
    this.headersOverride ??= Headers.fromInput(this.source.headers)
    return this.headersOverride
  }

  private cachedCookies?: Record.ReadonlyRecord<string, string>
  get cookies(): Record.ReadonlyRecord<string, string> {
    return this.cachedCookies ??= Cookies.parseHeader(this.headers.cookie ?? "")
  }

  get stream(): Stream.Stream<Uint8Array, HttpServerError.HttpServerError> {
    return this.source.body
      ? BunStream.fromReadableStream({
        evaluate: () => this.source.body ?? emptyReadableStream,
        onError: (cause) =>
          new HttpServerError.HttpServerError({
            reason: new HttpServerError.RequestParseError({ request: this, cause }),
          }),
      })
      : Stream.fail(
        new HttpServerError.HttpServerError({
          reason: new HttpServerError.RequestParseError({
            request: this,
            description: "can not create stream from empty body",
          }),
        }),
      )
  }

  private textEffect?: Effect.Effect<string, HttpServerError.HttpServerError>
  get text(): Effect.Effect<string, HttpServerError.HttpServerError> {
    return this.textEffect ??= Effect.runSync(Effect.cached(
      Effect.tryPromise({
        try: () => this.source.text(),
        catch: (cause) =>
          new HttpServerError.HttpServerError({
            reason: new HttpServerError.RequestParseError({ request: this, cause }),
          }),
      }),
    ))
  }

  get json(): Effect.Effect<Schema.Json, HttpServerError.HttpServerError> {
    return Effect.flatMap(this.text, (text) =>
      Effect.try({
        try: () => JSON.parse(text) as Schema.Json,
        catch: (cause) =>
          new HttpServerError.HttpServerError({
            reason: new HttpServerError.RequestParseError({ request: this, cause }),
          }),
      }))
  }

  get urlParamsBody(): Effect.Effect<UrlParams.UrlParams, HttpServerError.HttpServerError> {
    return Effect.flatMap(this.text, (text) =>
      Effect.try({
        try: () => UrlParams.fromInput(new URLSearchParams(text)),
        catch: (cause) =>
          new HttpServerError.HttpServerError({
            reason: new HttpServerError.RequestParseError({ request: this, cause }),
          }),
      }))
  }

  private multipartEffect?: Effect.Effect<
    Multipart.Persisted,
    Multipart.MultipartError,
    Scope.Scope | FileSystem.FileSystem | Path.Path
  >
  get multipart(): Effect.Effect<
    Multipart.Persisted,
    Multipart.MultipartError,
    Scope.Scope | FileSystem.FileSystem | Path.Path
  > {
    return this.multipartEffect ??= Effect.runSync(Effect.cached(
      BunMultipart.persisted(this.source),
    ))
  }

  get multipartStream(): Stream.Stream<Multipart.Part, Multipart.MultipartError> {
    return BunMultipart.stream(this.source)
  }

  private arrayBufferEffect?: Effect.Effect<ArrayBuffer, HttpServerError.HttpServerError>
  get arrayBuffer(): Effect.Effect<ArrayBuffer, HttpServerError.HttpServerError> {
    if (this.arrayBufferEffect !== undefined) return this.arrayBufferEffect
    this.arrayBufferEffect = Effect.runSync(Effect.cached(
      Effect.tryPromise({
        try: () => this.source.arrayBuffer(),
        catch: (cause) =>
          new HttpServerError.HttpServerError({
            reason: new HttpServerError.RequestParseError({ request: this, cause }),
          }),
      }),
    ))
    this.textEffect = Effect.map(
      this.arrayBufferEffect,
      (buffer) => new TextDecoder().decode(buffer),
    )
    return this.arrayBufferEffect
  }

  get upgrade(): Effect.Effect<Socket.Socket, HttpServerError.HttpServerError> {
    return Effect.callback((resume) => {
      const deferred = Deferred.makeUnsafe<ServerWebSocket<WebSocketContext>>()
      const closeDeferred = Deferred.makeUnsafe<void, Socket.SocketError>()
      const semaphore = Semaphore.makeUnsafe(1)
      const upgraded = this.bunServer.upgrade(this.source, {
        data: {
          deferred,
          closeDeferred,
          buffer: [],
          run: wsDefaultRun,
        },
      })

      if (!upgraded) {
        resume(Effect.fail(
          new HttpServerError.HttpServerError({
            reason: new HttpServerError.RequestParseError({
              request: this,
              description: "Not an upgradeable ServerRequest",
            }),
          }),
        ))
        return
      }

      resume(Effect.map(Deferred.await(deferred), (ws) => {
        const write = (chunk: Uint8Array | string | Socket.CloseEvent) =>
          Effect.sync(() => {
            if (typeof chunk === "string") {
              ws.sendText(chunk, chunk.length >= this.compressionThreshold)
            } else if (Socket.isCloseEvent(chunk)) {
              ws.close(chunk.code, chunk.reason)
            } else {
              ws.sendBinary(chunk, chunk.byteLength >= this.compressionThreshold)
            }
            return true
          })
        const writer = Effect.succeed(write)
        const runRaw = Effect.fnUntraced(
          function*<R, E, A>(
            handler: (_: Uint8Array | string) => Effect.Effect<A, E, R> | void,
            options?: { readonly onOpen?: Effect.Effect<void> },
          ) {
            const fiberSet = yield* FiberSet.make<any, E>()
            const run = yield* FiberSet.runtime(fiberSet)<R>()
            const receive = (data: Uint8Array | string) => {
              const result = handler(data)
              if (Effect.isEffect(result)) run(result)
            }
            ws.data.run = receive
            ws.data.buffer.forEach(receive)
            ws.data.buffer.length = 0
            if (options?.onOpen !== undefined) yield* options.onOpen
            return yield* FiberSet.join(fiberSet)
          },
          Effect.scoped,
          Effect.onExit((exit) => Effect.sync(() => ws.close(Exit.isSuccess(exit) ? 1000 : 1011))),
          Effect.raceFirst(Deferred.await(closeDeferred)),
          semaphore.withPermits(1),
        )

        return Socket.make({ runRaw, writer })
      }))
    })
  }
}

const emptyReadableStream = new ReadableStream({
  start(controller) {
    controller.enqueue(new Uint8Array())
    controller.close()
  },
})

const removeHost = (url: string): string => {
  if (url[0] === "/") return url
  const index = url.indexOf("/", url.indexOf("//") + 2)
  return index === -1 ? "/" : url.slice(index)
}
