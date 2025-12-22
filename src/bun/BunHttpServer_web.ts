import * as Cookies from "@effect/platform/Cookies"
import type * as FileSystem from "@effect/platform/FileSystem"
import * as Headers from "@effect/platform/Headers"
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpIncomingMessage from "@effect/platform/HttpIncomingMessage"
import type { HttpMethod } from "@effect/platform/HttpMethod"
import * as HttpServerError from "@effect/platform/HttpServerError"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import type * as Multipart from "@effect/platform/Multipart"
import type * as Path from "@effect/platform/Path"
import * as Socket from "@effect/platform/Socket"
import * as UrlParams from "@effect/platform/UrlParams"
import type {
  Server as BunServerInstance,
  ServerWebSocket,
} from "bun"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as FiberSet from "effect/FiberSet"
import * as Inspectable from "effect/Inspectable"
import * as Option from "effect/Option"
import type { ReadonlyRecord } from "effect/Record"
import * as Runtime from "effect/Runtime"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"

export interface WebSocketContext {
  readonly deferred: Deferred.Deferred<ServerWebSocket<WebSocketContext>>
  readonly closeDeferred: Deferred.Deferred<void, Socket.SocketError>
  readonly buffer: Array<Uint8Array | string>
  run: (_: Uint8Array | string) => void
}

export class ServerRequestImpl extends Inspectable.Class
  implements HttpServerRequest.HttpServerRequest
{
  readonly [HttpServerRequest.TypeId]: HttpServerRequest.TypeId
  readonly [HttpIncomingMessage.TypeId]: HttpIncomingMessage.TypeId
  readonly source: Request
  resolve: (response: Response) => void
  readonly url: string
  private bunServer: BunServerInstance<WebSocketContext>
  headersOverride?: Headers.Headers
  private remoteAddressOverride?: string

  constructor(
    source: Request,
    resolve: (response: Response) => void,
    url: string,
    bunServer: BunServerInstance<WebSocketContext>,
    headersOverride?: Headers.Headers,
    remoteAddressOverride?: string,
  ) {
    super()
    this[HttpServerRequest.TypeId] = HttpServerRequest.TypeId
    this[HttpIncomingMessage.TypeId] = HttpIncomingMessage.TypeId
    this.source = source
    this.resolve = resolve
    this.url = url
    this.bunServer = bunServer
    this.headersOverride = headersOverride
    this.remoteAddressOverride = remoteAddressOverride
  }

  toJSON(): unknown {
    return HttpIncomingMessage.inspect(this, {
      _id: "@effect/platform/HttpServerRequest",
      method: this.method,
      url: this.originalUrl,
    })
  }

  modify(
    options: {
      readonly url?: string | undefined
      readonly headers?: Headers.Headers | undefined
      readonly remoteAddress?: string | undefined
    },
  ) {
    return new ServerRequestImpl(
      this.source,
      this.resolve,
      options.url ?? this.url,
      this.bunServer,
      options.headers ?? this.headersOverride,
      options.remoteAddress ?? this.remoteAddressOverride,
    )
  }

  get method(): HttpMethod {
    return this.source.method.toUpperCase() as HttpMethod
  }

  get originalUrl() {
    return this.source.url
  }

  get remoteAddress(): Option.Option<string> {
    return this.remoteAddressOverride
      ? Option.some(this.remoteAddressOverride)
      : Option.fromNullable(this.bunServer.requestIP(this.source)?.address)
  }

  get headers(): Headers.Headers {
    this.headersOverride ??= Headers.fromInput(this.source.headers)
    return this.headersOverride
  }

  private cachedCookies: ReadonlyRecord<string, string> | undefined
  get cookies() {
    if (this.cachedCookies) {
      return this.cachedCookies
    }
    return this.cachedCookies = Cookies.parseHeader(this.headers.cookie ?? "")
  }

  get stream(): Stream.Stream<Uint8Array, HttpServerError.RequestError> {
    return this.source.body
      ? Stream.fromReadableStream(
        () => this.source.body as ReadableStream<Uint8Array>,
        (cause) =>
          new HttpServerError.RequestError({
            request: this,
            reason: "Decode",
            cause,
          }),
      )
      : Stream.fail(
        new HttpServerError.RequestError({
          request: this,
          reason: "Decode",
          description: "can not create stream from empty body",
        }),
      )
  }

  private textEffect:
    | Effect.Effect<string, HttpServerError.RequestError>
    | undefined

  get text(): Effect.Effect<string, HttpServerError.RequestError> {
    if (this.textEffect) {
      return this.textEffect
    }
    this.textEffect = Effect.runSync(Effect.cached(
      Effect.tryPromise({
        try: () => this.source.text(),
        catch: (cause) =>
          new HttpServerError.RequestError({
            request: this,
            reason: "Decode",
            cause,
          }),
      }),
    ))
    return this.textEffect
  }

  get json(): Effect.Effect<unknown, HttpServerError.RequestError> {
    return Effect.tryMap(this.text, {
      try: (_) => JSON.parse(_) as unknown,
      catch: (cause) =>
        new HttpServerError.RequestError({
          request: this,
          reason: "Decode",
          cause,
        }),
    })
  }

  get urlParamsBody(): Effect.Effect<
    UrlParams.UrlParams,
    HttpServerError.RequestError
  > {
    return Effect.flatMap(this.text, (_) =>
      Effect.try({
        try: () => UrlParams.fromInput(new URLSearchParams(_)),
        catch: (cause) =>
          new HttpServerError.RequestError({
            request: this,
            reason: "Decode",
            cause,
          }),
      }))
  }

  private multipartEffect:
    | Effect.Effect<
      Multipart.Persisted,
      Multipart.MultipartError,
      Scope.Scope | FileSystem.FileSystem | Path.Path
    >
    | undefined

  get multipart(): Effect.Effect<
    Multipart.Persisted,
    Multipart.MultipartError,
    Scope.Scope | FileSystem.FileSystem | Path.Path
  > {
    if (this.multipartEffect) {
      return this.multipartEffect
    }
    this.multipartEffect = Effect.runSync(Effect.cached(
      Effect.die("Multipart not implemented"),
    ))
    return this.multipartEffect
  }

  get multipartStream(): Stream.Stream<
    Multipart.Part,
    Multipart.MultipartError
  > {
    return Stream.die("Multipart stream not implemented")
  }

  private arrayBufferEffect:
    | Effect.Effect<ArrayBuffer, HttpServerError.RequestError>
    | undefined
  get arrayBuffer(): Effect.Effect<ArrayBuffer, HttpServerError.RequestError> {
    if (this.arrayBufferEffect) {
      return this.arrayBufferEffect
    }
    this.arrayBufferEffect = Effect.runSync(Effect.cached(
      Effect.tryPromise({
        try: () => this.source.arrayBuffer(),
        catch: (cause) =>
          new HttpServerError.RequestError({
            request: this,
            reason: "Decode",
            cause,
          }),
      }),
    ))
    return this.arrayBufferEffect
  }

  get upgrade(): Effect.Effect<Socket.Socket, HttpServerError.RequestError> {
    return Effect.flatMap(
      Effect.all([
        Deferred.make<ServerWebSocket<WebSocketContext>>(),
        Deferred.make<void, Socket.SocketError>(),
        Effect.makeSemaphore(1),
      ]),
      ([deferred, closeDeferred, semaphore]) =>
        Effect.async<Socket.Socket, HttpServerError.RequestError>((resume) => {
          const success = this.bunServer.upgrade(
            this.source,
            {
              data: {
                deferred,
                closeDeferred,
                buffer: [],
                run: wsDefaultRun,
              },
            },
          )
          if (!success) {
            resume(Effect.fail(
              new HttpServerError.RequestError({
                request: this,
                reason: "Decode",
                description: "Not an upgradeable ServerRequest",
              }),
            ))
            return
          }
          resume(Effect.map(Deferred.await(deferred), (ws) => {
            const write = (chunk: Uint8Array | string | Socket.CloseEvent) =>
              Effect.sync(() => {
                if (typeof chunk === "string") {
                  ws.sendText(chunk)
                } else if (Socket.isCloseEvent(chunk)) {
                  ws.close(chunk.code, chunk.reason)
                } else {
                  ws.sendBinary(chunk)
                }

                return true
              })
            const writer = Effect.succeed(write)
            const runRaw = Effect.fnUntraced(
              function*<RR, EE, _>(
                handler: (
                  _: Uint8Array | string,
                ) => Effect.Effect<_, EE, RR> | void,
                opts?: { readonly onOpen?: Effect.Effect<void> | undefined },
              ) {
                const set = yield* FiberSet.make<unknown, EE>()
                const run = yield* FiberSet.runtime(set)<RR>()
                function runRawInner(data: Uint8Array | string) {
                  const result = handler(data)
                  if (Effect.isEffect(result)) {
                    run(result)
                  }
                }
                ws.data.run = runRawInner
                ws.data.buffer.forEach(runRawInner)
                ws.data.buffer.length = 0
                if (opts?.onOpen) yield* opts.onOpen
                return yield* FiberSet.join(set)
              },
              Effect.scoped,
              Effect.onExit((exit) => {
                ws.close(exit._tag === "Success" ? 1000 : 1011)
                return Effect.void
              }),
              Effect.raceFirst(Deferred.await(closeDeferred)),
              semaphore.withPermits(1),
            )

            const encoder = new TextEncoder()
            const run = <RR, EE, _>(
              handler: (_: Uint8Array) => Effect.Effect<_, EE, RR> | void,
              opts?: {
                readonly onOpen?: Effect.Effect<void> | undefined
              },
            ) =>
              runRaw(
                (data) =>
                  typeof data === "string"
                    ? handler(encoder.encode(data))
                    : handler(data),
                opts,
              )

            return Socket.Socket.of({
              [Socket.TypeId]: Socket.TypeId,
              run,
              runRaw,
              writer,
            })
          }))
        }),
    )
  }
}

function wsDefaultRun(this: WebSocketContext, _: Uint8Array | string) {
  this.buffer.push(_)
}

export function makeResponse(
  request: HttpServerRequest.HttpServerRequest,
  response: HttpServerResponse.HttpServerResponse,
  runtime: Runtime.Runtime<never>,
): Response {
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
