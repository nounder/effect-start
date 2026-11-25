import * as NDns from "node:dns/promises"
/** Ported from @effect/platform-bun@4.1.2. */
import type { Server as NativeServer, ServerWebSocket } from "bun"
import type * as Array from "effect/Array"
import * as Cause from "effect/Cause"
import * as Channel from "effect/Channel"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import type * as FileSystem from "effect/FileSystem"
import * as Cookies from "effect/http/Cookies"
import * as Etag from "effect/http/Etag"
import * as Headers from "effect/http/Headers"
import * as HttpEffect from "effect/http/HttpEffect"
import * as IncomingMessage from "effect/http/HttpIncomingMessage"
import type * as HttpMethod from "effect/http/HttpMethod"
import type * as HttpPlatform from "effect/http/HttpPlatform"
import * as HttpServer from "effect/http/HttpServer"
import * as HttpServerError from "effect/http/HttpServerError"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import type * as Multipart from "effect/http/Multipart"
import * as UrlParams from "effect/http/UrlParams"
import * as Inspectable from "effect/Inspectable"
import * as Layer from "effect/Layer"
import * as NetAddress from "effect/net/NetAddress"
import * as Option from "effect/Option"
import type * as Path from "effect/Path"
import type * as Record from "effect/Record"
import * as Scheduler from "effect/Scheduler"
import type * as Schema from "effect/Schema"
import * as Scope from "effect/Scope"
import * as Semaphore from "effect/Semaphore"
import * as Socket from "effect/socket/Socket"
import * as Stream from "effect/Stream"
import * as RouteSocket from "../../internal/RouteSocket.ts"
import * as BunFileSystem from "../BunFileSystem.ts"
import * as BunPath from "../BunPath.ts"
import * as BunHttpPlatform from "./BunHttpPlatform.ts"
import * as BunMultipart from "./BunMultipart.ts"
import * as BunStream from "./BunStream.ts"
import * as MainFiber from "./MainFiber.ts"

export interface WebSocketContext {
  readonly deferred: Deferred.Deferred<ServerWebSocket<WebSocketContext>>
  closeError: Socket.SocketError | undefined
  onClose: (error: Socket.SocketError) => void
  readonly buffer: Array<Uint8Array | string>
  run: (_: Uint8Array | string) => void
}

export type WebSocketOptions = Omit<
  Bun.WebSocketHandler<WebSocketContext>,
  "open" | "message" | "close" | "drain" | "ping" | "pong" | "data" | "binaryType"
> & {
  readonly compressionThreshold?: number
}

export type ServeOptions = (
  | Bun.Serve.UnixServeOptions<WebSocketContext>
  | Bun.Serve.HostnamePortServeOptions<WebSocketContext>
) & {
  readonly disablePreemptiveShutdown?: boolean
  readonly gracefulShutdownTimeout?: Duration.Input
  readonly websocket?: WebSocketOptions
}

export const layerHttpServices: Layer.Layer<
  HttpPlatform.HttpPlatform | Etag.Generator | FileSystem.FileSystem | Path.Path
> = Layer.mergeAll(BunHttpPlatform.layer, Etag.layerWeak, BunFileSystem.layer, BunPath.layer)

type FetchHandler = (
  request: Request,
  server: NativeServer<WebSocketContext>,
) => Response | Promise<Response>

export const make = Effect.fnUntraced(function* (options: ServeOptions) {
  const initialGeneration = MainFiber.get()
  let ownerGeneration = initialGeneration
  const parentScope = yield* Effect.scope
  const compressionThreshold = options.websocket?.compressionThreshold ?? 1_024
  const websocket = { ...options.websocket }
  delete websocket.compressionThreshold

  const handlerStack: Array<FetchHandler> = [() => new Response("not found", { status: 404 })]
  const handlerGenerations = new Map<FetchHandler, Fiber.Fiber<unknown, unknown> | undefined>()
  const listenOptions =
    "unix" in options && options.unix !== undefined
      ? options
      : {
          ...options,
          hostname:
            "hostname" in options && options.hostname !== undefined
              ? yield* Effect.tryPromise({
                  try: () => NDns.lookup(options.hostname!),
                  catch: (cause) => new HttpServerError.ServeError({ cause }),
                }).pipe(
                  Effect.map((address) => address.address),
                  Effect.orDie,
                )
              : "0.0.0.0",
        }
  const server = Bun.serve<WebSocketContext, string>({
    // Opt-in: Effect timeouts bound requests instead. Bun's types omit it for Unix sockets, where it applies too.
    ...({
      ...listenOptions,
      idleTimeout: (options as { readonly idleTimeout?: number }).idleTimeout ?? 0,
    } as ServeOptions),
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
        const error = new Socket.SocketError({
          reason: new Socket.SocketCloseError({ code: closeCode, closeReason }),
        })
        ws.data.closeError = error
        ws.data.onClose(error)
      },
    },
  })

  const stop = yield* Effect.tryPromise({
    try: () => server.stop(true),
    catch: (cause) => new HttpServerError.ServeError({ cause }),
  }).pipe(Effect.orDie, Effect.cached)
  const shutdown = (generation: Fiber.Fiber<unknown, unknown> | undefined) =>
    Effect.suspend(() =>
      MainFiber.get() === generation && ownerGeneration === generation ? stop : Effect.void,
    )
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
    })
  }

  const service = HttpServer.make({
    address:
      "unix" in options && options.unix !== undefined
        ? NetAddress.unixPathAddress(options.unix)
        : NetAddress.inetAddressFromIpStringUnsafe(server.hostname!, server.port!),
    serve: Effect.fnUntraced(function* (httpApp, middleware) {
      const generation = MainFiber.get()
      const parent = yield* Effect.fiber
      const services = parent.context
      const serveScope = Context.getUnsafe(services, Scope.Scope)
      const requestScope = Scope.forkUnsafe(serveScope, "parallel")
      const handlerScope = yield* Scope.make()
      const httpEffect = HttpEffect.toHandled(
        httpApp.pipe(Effect.provideService(RouteSocket.HandlerScope, handlerScope)),
        (request, response) =>
          Effect.sync(() => {
            const bunRequest = request as BunServerRequest
            bunRequest.resolve(makeResponse(bunRequest, response, services, requestScope))
            if (upgradedSources.has(bunRequest.source)) return upgradedResponse
          }),
        middleware,
      )

      function handler(request: Request, nativeServer: NativeServer<WebSocketContext>) {
        if (request.method === "CONNECT") {
          return Promise.resolve(new Response(null, { status: 501 }))
        }
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
          const fiber = Fiber.runIn(Effect.runForkWith(context)(httpEffect), requestScope)
          request.signal.addEventListener(
            "abort",
            () => {
              // Bun aborts the signal when an upgraded WebSocket closes, which is not a client abort.
              if (upgradedSources.has(request)) return
              fiber.interruptUnsafe(parent.id, HttpServerError.ClientAbort.annotation)
            },
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
      yield* Scope.addFinalizer(serveScope, Scope.close(handlerScope, Exit.void))
      if (MainFiber.get() !== generation) return
      discardStaleHandlers(generation)
      handlerStack.push(handler)
      handlerGenerations.set(handler, generation)
      ownerGeneration = generation
      reload(generation)
    }),
  })

  return service
})

// Reported to middleware in place of the handler's discarded response.
const upgradedResponse = HttpServerResponse.empty({ status: 101 })

// Keyed by source so request copies from `modify` share the upgrade state.
const upgradedSources = new WeakSet<Request>()

const makeResponse = (
  request: BunServerRequest,
  response: HttpServerResponse.HttpServerResponse,
  context: Context.Context<never>,
  scope: Scope.Scope,
): Response => {
  if (HttpServerResponse.omitsBody(response, request.method === "HEAD")) {
    return HttpServerResponse.toWeb(response, { withoutBody: true })
  }
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

  const transferred = HttpEffect.scopeTransferToStream(response)
  const body = transferred.body
  switch (body._tag) {
    case "Empty":
      return new Response(undefined, fields)
    case "Uint8Array":
      return new Response(body.text ?? (body.body as BodyInit), fields)
    case "Raw":
      return body.body instanceof Response
        ? HttpServerResponse.toWeb(transferred)
        : new Response(body.body as BodyInit, fields)
    case "FormData":
      return new Response(body.formData as BodyInit, fields)
    case "Stream": {
      const reader = Stream.toReadableStreamWith(
        // Attach before transforming: startup can suspend. Register the request finalizer before the first pull.
        Stream.fromChannel(
          Channel.fromTransform((upstream, streamScope) =>
            Effect.withFiber((fiber) => {
              Fiber.runIn(fiber, scope)
              return Channel.toTransform(body.stream.channel)(upstream, streamScope)
            }),
          ),
        ),
        context,
        { signal: request.source.signal },
      ).getReader()
      return new Response(
        new ReadableStream({
          pull: (controller) =>
            reader.read().then(
              (next) => (next.done ? controller.close() : controller.enqueue(next.value)),
              // On hot reload the request scope closes and Effect errors the body, which Bun would print.
              // Bun stays silent for `undefined` and still resets the connection, so the client sees the cut.
              (error) => controller.error(scope.state._tag === "Closed" ? undefined : error),
            ),
          cancel: (reason) => reader.cancel(reason),
        }),
        fields,
      )
    }
  }
}

function wsDefaultRun(this: WebSocketContext, data: Uint8Array | string) {
  this.buffer.push(data)
}

const formDecoder = new TextDecoder("utf-8", { ignoreBOM: true })

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
  private peerAddressOverride?: Option.Option<string>
  readonly protocol: "http" | "https" | undefined

  constructor(
    source: Request,
    resolve: (response: Response) => void,
    url: string,
    bunServer: NativeServer<WebSocketContext>,
    compressionThreshold: number,
    headersOverride?: Headers.Headers,
    remoteAddressOverride?: Option.Option<string>,
    peerAddressOverride?: Option.Option<string>,
    protocol?: "http" | "https",
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
    this.peerAddressOverride = peerAddressOverride
    this.protocol = protocol
  }

  toJSON(): unknown {
    return IncomingMessage.inspect(this, {
      _id: "HttpServerRequest",
      method: this.method,
      url: UrlParams.redactUrl(this.originalUrl),
    })
  }

  modify(options: {
    readonly url?: string
    readonly headers?: Headers.Headers
    readonly remoteAddress?: Option.Option<string>
    readonly peerAddress?: Option.Option<string>
    readonly protocol?: "http" | "https"
  }) {
    return new BunServerRequest(
      this.source,
      this.resolve,
      options.url ?? this.url,
      this.bunServer,
      this.compressionThreshold,
      options.headers ?? this.headersOverride,
      "remoteAddress" in options ? options.remoteAddress : this.remoteAddressOverride,
      options.peerAddress ?? this.peerAddressOverride,
      options.protocol ?? this.protocol,
    )
  }

  get method(): HttpMethod.HttpMethod {
    return this.source.method.toUpperCase() as HttpMethod.HttpMethod
  }

  get originalUrl(): string {
    return this.source.url
  }

  get remoteAddress(): Option.Option<string> {
    return (
      this.remoteAddressOverride ??
      Option.fromNullishOr(this.bunServer.requestIP(this.source)?.address)
    )
  }

  get peerAddress(): Option.Option<string> {
    return this.peerAddressOverride ?? this.remoteAddress
  }

  get headers(): Headers.Headers {
    this.headersOverride ??= Headers.fromInput(this.source.headers)
    return this.headersOverride
  }

  private cachedCookies?: Record.ReadonlyRecord<string, string>
  get cookies(): Record.ReadonlyRecord<string, string> {
    return (this.cachedCookies ??= Cookies.parseHeader(this.headers.cookie ?? ""))
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
    return (this.textEffect ??= Effect.map(this.arrayBuffer, (buffer) =>
      new TextDecoder().decode(buffer),
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
      }),
    )
  }

  get urlParamsBody(): Effect.Effect<UrlParams.UrlParams, HttpServerError.HttpServerError> {
    return Effect.flatMap(this.arrayBuffer, (bytes) =>
      Effect.try({
        // A leading "?" is form data; URLSearchParams would drop it as a query prefix.
        try: () =>
          UrlParams.fromInput(new URLSearchParams(formDecoder.decode(bytes).replace(/^\?/, "%3F"))),
        catch: (cause) =>
          new HttpServerError.HttpServerError({
            reason: new HttpServerError.RequestParseError({ request: this, cause }),
          }),
      }),
    )
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
    return (this.multipartEffect ??= Effect.runSync(
      Effect.cached(BunMultipart.persisted(this.source)),
    ))
  }

  get multipartStream(): Stream.Stream<Multipart.Part, Multipart.MultipartError> {
    return BunMultipart.stream(this.source)
  }

  private arrayBufferEffect?: Effect.Effect<ArrayBuffer, HttpServerError.HttpServerError>
  get arrayBuffer(): Effect.Effect<ArrayBuffer, HttpServerError.HttpServerError> {
    if (this.arrayBufferEffect !== undefined) return this.arrayBufferEffect
    this.arrayBufferEffect = Effect.runSync(
      Effect.cached(
        // Reuse the Web reader so that MaxBodySize is enforced.
        Effect.mapError(HttpServerRequest.fromWeb(this.source).arrayBuffer, (error) => {
          if (error.reason._tag !== "RequestParseError") return error
          return new HttpServerError.HttpServerError({
            reason: new HttpServerError.RequestParseError({
              request: this,
              cause: error.reason.cause,
              ...(error.reason.reason && { reason: error.reason.reason }),
            }),
          })
        }),
      ),
    )
    return this.arrayBufferEffect
  }

  upgradeWith(options: {
    readonly headers?: Headers.Input
  }): Effect.Effect<Socket.Socket, HttpServerError.HttpServerError> {
    if (Object.keys(Headers.fromInput(options.headers)).length === 0) return this.upgrade
    return Effect.fail(
      new HttpServerError.HttpServerError({
        reason: new HttpServerError.InternalError({
          request: this,
          description: "WebSocket upgrades do not support custom response headers",
        }),
      }),
    )
  }

  get upgrade(): Effect.Effect<Socket.Socket, HttpServerError.HttpServerError> {
    return Effect.callback<Socket.Socket, HttpServerError.HttpServerError>((resume) => {
      const deferred = Deferred.makeUnsafe<ServerWebSocket<WebSocketContext>>()
      const semaphore = Semaphore.makeUnsafe(1)

      const success = this.bunServer.upgrade(this.source, {
        data: {
          deferred,
          buffer: [],
          closeError: undefined,
          run: wsDefaultRun,
          onClose: () => {},
        },
      })
      if (!success) {
        const protocol = this.source.headers.get("upgrade")
        resume(
          Effect.fail(
            new HttpServerError.HttpServerError({
              reason: new HttpServerError.RequestParseError({
                request: this,
                description:
                  protocol !== null && protocol.toLowerCase() !== "websocket"
                    ? "Bun.serve only supports WebSocket upgrades"
                    : "Not an upgradeable ServerRequest",
              }),
            }),
          ),
        )
        return
      }
      upgradedSources.add(this.source)
      const compressionThreshold = this.compressionThreshold
      resume(
        Effect.map(Deferred.await(deferred), (ws) => {
          const write = (chunk: Uint8Array | string | Socket.CloseEvent) =>
            Effect.sync(() => {
              if (typeof chunk === "string") {
                ws.sendText(chunk, chunk.length >= compressionThreshold)
              } else if (Socket.isCloseEvent(chunk)) {
                ws.close(chunk.code, chunk.reason)
              } else {
                ws.sendBinary(chunk, chunk.byteLength >= compressionThreshold)
              }
            })
          const writeAll = (chunks: ReadonlyArray<Uint8Array | string>) =>
            Effect.sync(() => {
              for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i]
                if (typeof chunk === "string") {
                  ws.sendText(chunk, chunk.length >= compressionThreshold)
                } else {
                  ws.sendBinary(chunk, chunk.byteLength >= compressionThreshold)
                }
              }
            })
          const writer: Socket.Socket["writer"] = Effect.succeed({ write, writeAll })

          const reader: Socket.Socket["reader"] = Effect.gen(function* () {
            const dispatcher = (yield* Scheduler.Scheduler).makeDispatcher()
            yield* Effect.acquireRelease(semaphore.take(1), () => semaphore.release(1))
            const closeError =
              ws.data.closeError ??
              (ws.readyState >= 2
                ? new Socket.SocketError({
                    reason: new Socket.SocketCloseError({ code: 1006 }),
                  })
                : undefined)
            if (closeError !== undefined && ws.data.buffer.length === 0) {
              return yield* closeError
            }
            const scope = yield* Effect.scope

            type ReadResume = (
              effect: Effect.Effect<
                Array.NonEmptyReadonlyArray<Uint8Array | string>,
                Socket.SocketError
              >,
            ) => void

            let buffer: Array<Uint8Array | string> = ws.data.buffer.splice(0)
            let error: Socket.SocketError | undefined = closeError
            let waiter: ReadResume | undefined
            let flushScheduled = false

            function takeBuffer(): Array.NonEmptyReadonlyArray<Uint8Array | string> {
              const chunk = buffer
              buffer = []
              return chunk as unknown as Array.NonEmptyReadonlyArray<Uint8Array | string>
            }
            function deliver() {
              flushScheduled = false
              if (waiter === undefined || buffer.length === 0) return
              const resumeRead = waiter
              waiter = undefined
              resumeRead(Effect.succeed(takeBuffer()))
            }
            function push(data: Uint8Array | string) {
              buffer.push(data)
              if (waiter !== undefined && !flushScheduled) {
                flushScheduled = true
                dispatcher.scheduleTask(deliver, 0)
              }
            }
            function fail(err: Socket.SocketError) {
              if (error === undefined) error = err
              if (waiter !== undefined) {
                const resumeRead = waiter
                waiter = undefined
                resumeRead(buffer.length > 0 ? Effect.succeed(takeBuffer()) : Effect.fail(error))
              }
            }

            ws.data.run = push
            ws.data.onClose = fail
            yield* Scope.addFinalizerExit(scope, (exit) =>
              Effect.suspend(() => {
                // resume a pull blocked in another fiber before detaching
                fail(
                  new Socket.SocketError({
                    reason: new Socket.SocketCloseError({ code: 1006 }),
                  }),
                )
                ws.data.run = wsDefaultRun
                ws.data.onClose = () => {}
                ws.close(
                  Exit.isSuccess(exit) ? 1000 : Cause.hasInterruptsOnly(exit.cause) ? 1001 : 1011,
                )
                return Effect.void
              }),
            )

            return {
              pull: Effect.callback<
                Array.NonEmptyReadonlyArray<Uint8Array | string>,
                Socket.SocketError
              >((resumeRead) => {
                if (buffer.length > 0) return resumeRead(Effect.succeed(takeBuffer()))
                if (error !== undefined) return resumeRead(Effect.fail(error))
                waiter = resumeRead
                return Effect.sync(() => {
                  if (waiter === resumeRead) waiter = undefined
                })
              }),
              upgrade: Socket.SocketUpgradeError.unsupported,
            }
          })

          return Socket.make({ reader, writer })
        }),
      )
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
