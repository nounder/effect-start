/*
 * Adapted from effect-smol aka v4
 */
import * as Channel from "effect/Channel"
import type * as Chunk from "effect/Chunk"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as ExecutionStrategy from "effect/ExecutionStrategy"
import * as Exit from "effect/Exit"
import * as FiberRef from "effect/FiberRef"
import * as FiberSet from "effect/FiberSet"
import * as Function from "effect/Function"
import * as GlobalValue from "effect/GlobalValue"
import * as Layer from "effect/Layer"
import * as Mailbox from "effect/Mailbox"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"
import * as Scope from "effect/Scope"
import type * as AsyncProducer from "effect/SingleProducerAsyncInput"

export const TypeId = "~effect-start/Socket" as const

export const isSocket = (u: unknown): u is Socket => Predicate.hasProperty(u, TypeId)

export const Socket: Context.Tag<Socket, Socket> = Context.GenericTag<Socket>(
  "~effect-start/Socket",
)

export interface Socket {
  readonly [TypeId]: typeof TypeId
  readonly run: <_, E = never, R = never>(
    handler: (_: Uint8Array) => Effect.Effect<_, E, R> | void,
    options?: {
      readonly onOpen?: Effect.Effect<void> | undefined
    },
  ) => Effect.Effect<void, SocketError | E, R>
  readonly runString: <_, E = never, R = never>(
    handler: (_: string) => Effect.Effect<_, E, R> | void,
    options?: {
      readonly onOpen?: Effect.Effect<void> | undefined
    },
  ) => Effect.Effect<void, SocketError | E, R>
  readonly runRaw: <_, E = never, R = never>(
    handler: (_: string | Uint8Array) => Effect.Effect<_, E, R> | void,
    options?: {
      readonly onOpen?: Effect.Effect<void> | undefined
    },
  ) => Effect.Effect<void, SocketError | E, R>
  readonly writer: Effect.Effect<
    (chunk: Uint8Array | string | CloseEvent) => Effect.Effect<void, SocketError>,
    never,
    Scope.Scope
  >
}

export const make = (options: {
  readonly runRaw: <_, E, R>(
    handler: (_: string | Uint8Array) => Effect.Effect<_, E, R> | void,
    options?: {
      readonly onOpen?: Effect.Effect<void> | undefined
    },
  ) => Effect.Effect<void, SocketError | E, R>
  readonly run?: <_, E, R>(
    handler: (_: Uint8Array) => Effect.Effect<_, E, R> | void,
    options?: {
      readonly onOpen?: Effect.Effect<void> | undefined
    },
  ) => Effect.Effect<void, SocketError | E, R>
  readonly runString?: <_, E, R>(
    handler: (_: string) => Effect.Effect<_, E, R> | void,
    options?: {
      readonly onOpen?: Effect.Effect<void> | undefined
    },
  ) => Effect.Effect<void, SocketError | E, R>
  readonly writer: Effect.Effect<
    (chunk: Uint8Array | string | CloseEvent) => Effect.Effect<void, SocketError>,
    never,
    Scope.Scope
  >
}): Socket =>
  Socket.of({
    [TypeId]: TypeId,
    runRaw: options.runRaw,
    run: options.run ?? ((handler, opts) =>
      options.runRaw((data) =>
        typeof data === "string"
          ? handler(encoder.encode(data))
          : data instanceof Uint8Array
          ? handler(data)
          : handler(new Uint8Array(data)), opts)),
    runString: options.runString ??
      (options.run
        ? (handler, opts) => options.run!((data) => handler(decoder.decode(data)), opts)
        : (handler, opts) =>
          options.runRaw((data) =>
            typeof data === "string"
              ? handler(data)
              : data instanceof Uint8Array
              ? handler(decoder.decode(data))
              : handler(decoder.decode(new Uint8Array(data))), opts)),
    writer: options.writer,
  })

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const CloseEventTypeId = "~effect-start/Socket/CloseEvent" as const

export type CloseEventTypeId = typeof CloseEventTypeId

export class CloseEvent {
  readonly [CloseEventTypeId]: CloseEventTypeId
  readonly code: number
  readonly reason?: string
  constructor(code = 1000, reason?: string) {
    this[CloseEventTypeId] = CloseEventTypeId
    this.code = code
    this.reason = reason
  }
  toString() {
    return this.reason ? `${this.code}: ${this.reason}` : `${this.code}`
  }
}

export const isCloseEvent = (u: unknown): u is CloseEvent => Predicate.hasProperty(u, CloseEventTypeId)

export type SocketErrorTypeId = "~effect-start/Socket/SocketError"

export const SocketErrorTypeId: SocketErrorTypeId = "~effect-start/Socket/SocketError"

export const isSocketError = (u: unknown): u is SocketError => Predicate.hasProperty(u, SocketErrorTypeId)

export class SocketReadError extends Schema.TaggedError<SocketReadError>()("SocketReadError", {
  cause: Schema.Defect,
}) {
  override readonly message = `An error occurred during Read`
}

export class SocketWriteError extends Schema.TaggedError<SocketWriteError>()("SocketWriteError", {
  cause: Schema.Defect,
}) {
  override readonly message = `An error occurred during Write`
}

export class SocketOpenError extends Schema.TaggedError<SocketOpenError>()("SocketOpenError", {
  kind: Schema.Literal("Unknown", "Timeout"),
  cause: Schema.Defect,
}) {
  override get message() {
    return this.kind === "Timeout"
      ? `timeout waiting for "open"`
      : `An error occurred during Open`
  }
}

export class SocketCloseError extends Schema.TaggedError<SocketCloseError>()("SocketCloseError", {
  code: Schema.Number,
  closeReason: Schema.optional(Schema.String),
}) {
  static isClean(isClean: (code: number) => boolean) {
    return function(u: unknown): u is SocketError & { readonly reason: SocketCloseError } {
      return SocketError.is(u) && u.reason._tag === "SocketCloseError" && isClean(u.reason.code)
    }
  }

  override get message() {
    if (this.closeReason) {
      return `${this.code}: ${this.closeReason}`
    }
    return `${this.code}`
  }
}

export const SocketErrorReason = Schema.Union(
  SocketReadError,
  SocketWriteError,
  SocketOpenError,
  SocketCloseError,
)

export type SocketErrorReason =
  | SocketReadError
  | SocketWriteError
  | SocketOpenError
  | SocketCloseError

export class SocketError extends Schema.TaggedError<SocketError>(SocketErrorTypeId)("SocketError", {
  reason: SocketErrorReason,
}) {
  constructor(props: { readonly reason: SocketErrorReason }) {
    if ("cause" in props.reason) {
      super({ ...props, cause: props.reason.cause } as any)
    } else {
      super(props)
    }
  }

  readonly [SocketErrorTypeId]: SocketErrorTypeId = SocketErrorTypeId

  static is(u: unknown): u is SocketError {
    return isSocketError(u)
  }

  override readonly message = this.reason.message
}

export const toChannelMap = <IE, A>(
  self: Socket,
  f: (data: Uint8Array | string) => A,
): Channel.Channel<
  Chunk.Chunk<A>,
  Chunk.Chunk<Uint8Array | string | CloseEvent>,
  SocketError | IE,
  IE,
  void,
  unknown
> =>
  Effect
    .gen(function*() {
      const scope = yield* Effect.scope
      const mailbox = yield* Mailbox.make<A, SocketError | IE>()
      const writeScope = yield* Scope.fork(scope, ExecutionStrategy.sequential)
      const write = yield* Scope.extend(self.writer, writeScope)
      function* emit(chunk: Chunk.Chunk<Uint8Array | string | CloseEvent>) {
        for (const data of chunk) {
          yield* write(data)
        }
      }
      const input: AsyncProducer.AsyncInputProducer<
        IE,
        Chunk.Chunk<Uint8Array | string | CloseEvent>,
        unknown
      > = {
        awaitRead: () => Effect.void,
        emit(chunk) {
          return Effect.catchAllCause(
            Effect.gen(() => emit(chunk)),
            (cause) => mailbox.failCause(cause),
          )
        },
        error(error) {
          return Effect.zipRight(
            Scope.close(writeScope, Exit.void),
            mailbox.failCause(error),
          )
        },
        done() {
          return Scope.close(writeScope, Exit.void)
        },
      }

      yield* self
        .runRaw((data) => {
          mailbox.unsafeOffer(f(data))
        })
        .pipe(
          Mailbox.into(mailbox),
          Effect.forkIn(scope),
          Effect.interruptible,
        )

      return Channel.embedInput(Mailbox.toChannel(mailbox), input)
    })
    .pipe(Channel.unwrapScoped)

export const toChannel = <IE>(
  self: Socket,
): Channel.Channel<
  Chunk.Chunk<Uint8Array>,
  Chunk.Chunk<Uint8Array | string | CloseEvent>,
  SocketError | IE,
  IE,
  void,
  unknown
> => {
  const encoder = new TextEncoder()
  return toChannelMap(
    self,
    (data) => typeof data === "string" ? encoder.encode(data) : data,
  )
}

export const toChannelString: {
  (encoding?: string | undefined): <IE>(self: Socket) => Channel.Channel<
    Chunk.Chunk<string>,
    Chunk.Chunk<Uint8Array | string | CloseEvent>,
    SocketError | IE,
    IE,
    void,
    unknown
  >
  <IE>(
    self: Socket,
    encoding?: string | undefined,
  ): Channel.Channel<
    Chunk.Chunk<string>,
    Chunk.Chunk<Uint8Array | string | CloseEvent>,
    SocketError | IE,
    IE,
    void,
    unknown
  >
} = Function.dual((args) => isSocket(args[0]), <IE>(
  self: Socket,
  encoding?: string | undefined,
): Channel.Channel<
  Chunk.Chunk<string>,
  Chunk.Chunk<Uint8Array | string | CloseEvent>,
  SocketError | IE,
  IE,
  void,
  unknown
> => {
  const decoder = new TextDecoder(encoding)
  return toChannelMap(
    self,
    (data) => typeof data === "string" ? data : decoder.decode(data),
  )
})

export const toChannelWith = <IE = never>() =>
(
  self: Socket,
): Channel.Channel<
  Chunk.Chunk<Uint8Array>,
  Chunk.Chunk<Uint8Array | string | CloseEvent>,
  SocketError | IE,
  IE,
  void,
  unknown
> => toChannel(self)

export const makeChannel = <IE = never>(): Channel.Channel<
  Chunk.Chunk<Uint8Array>,
  Chunk.Chunk<Uint8Array | string | CloseEvent>,
  SocketError | IE,
  IE,
  void,
  unknown,
  Socket
> => Channel.unwrap(Effect.map(Socket, toChannelWith<IE>()))

export const defaultCloseCodeIsError = (_code: number) => true

export interface WebSocket {
  readonly _: unique symbol
}

export const WebSocket: Context.Tag<WebSocket, globalThis.WebSocket> = Context
  .GenericTag(
    "effect-start/Socket/WebSocket",
  )

export interface WebSocketConstructor {
  readonly _: unique symbol
}

export const WebSocketConstructor: Context.Tag<
  WebSocketConstructor,
  (
    url: string,
    protocols?: string | Array<string> | undefined,
  ) => globalThis.WebSocket
> = Context.GenericTag("effect-start/Socket/WebSocketConstructor")

export const layerWebSocketConstructorGlobal: Layer.Layer<WebSocketConstructor> = Layer.succeed(
  WebSocketConstructor,
  (url, protocols) => new globalThis.WebSocket(url, protocols),
)

type WebSocketOptions = {
  readonly closeCodeIsError?: ((code: number) => boolean) | undefined
  readonly openTimeout?: Duration.DurationInput | undefined
  readonly protocols?: string | Array<string> | undefined
}

export const makeWebSocket = (
  url: string | Effect.Effect<string>,
  options?: WebSocketOptions,
): Effect.Effect<Socket, never, WebSocketConstructor> =>
  fromWebSocket(
    Effect.acquireRelease(
      (typeof url === "string" ? Effect.succeed(url) : url).pipe(
        Effect.flatMap((url) => Effect.map(WebSocketConstructor, (f) => f(url, options?.protocols))),
      ),
      (ws) => Effect.sync(() => ws.close(1000)),
    ),
    options,
  )

export const fromWebSocket = <RO>(
  acquire: Effect.Effect<globalThis.WebSocket, SocketError, RO>,
  options?: {
    readonly closeCodeIsError?: (code: number) => boolean
    readonly openTimeout?: Duration.DurationInput
  },
): Effect.Effect<Socket, never, Exclude<RO, Scope.Scope>> =>
  Effect.withFiberRuntime((fiber) => {
    let currentWS: globalThis.WebSocket | undefined
    const latch = Effect.unsafeMakeLatch(false)
    const acquireContext = fiber.currentContext as Context.Context<RO>
    const closeCodeIsError = options?.closeCodeIsError ?? defaultCloseCodeIsError

    const runRaw = <_, E, R>(
      handler: (_: string | Uint8Array) => Effect.Effect<_, E, R> | void,
      opts?: {
        readonly onOpen?: Effect.Effect<void> | undefined
      },
    ) =>
      Effect
        .scopedWith(Effect.fnUntraced(function*(scope) {
          const fiberSet = yield* FiberSet.make<any, E | SocketError>().pipe(
            Scope.extend(scope),
          )
          const ws = yield* Scope.extend(acquire, scope)
          const run = yield* Effect.provideService(
            FiberSet.runtime(fiberSet)<R>(),
            WebSocket,
            ws,
          )
          let open = false

          function onMessage(event: MessageEvent) {
            if (event.data instanceof Blob) {
              return Effect.promise(() => event.data.arrayBuffer() as Promise<ArrayBuffer>).pipe(
                Effect.andThen((buffer) => handler(new Uint8Array(buffer))),
                run,
              )
            }
            const result = handler(event.data)
            if (Effect.isEffect(result)) {
              run(result)
            }
          }
          function onError(cause: Event) {
            ws.removeEventListener("message", onMessage)
            ws.removeEventListener("close", onClose)
            Deferred.unsafeDone(
              fiberSet.deferred,
              Effect.fail(
                new SocketError({
                  reason: open
                    ? new SocketReadError({ cause })
                    : new SocketOpenError({ kind: "Unknown", cause }),
                }),
              ),
            )
          }
          function onClose(event: globalThis.CloseEvent) {
            const code = typeof event.code === "number" ? event.code : 1001
            ws.removeEventListener("message", onMessage)
            ws.removeEventListener("error", onError)
            Deferred.unsafeDone(
              fiberSet.deferred,
              Effect.fail(
                new SocketError({
                  reason: new SocketCloseError({
                    code,
                    closeReason: event.reason,
                  }),
                }),
              ),
            )
          }

          ws.addEventListener("close", onClose, { once: true })
          ws.addEventListener("error", onError, { once: true })
          ws.addEventListener("message", onMessage)

          if (ws.readyState !== 1) {
            const openDeferred = Deferred.unsafeMake<void>(fiber.id())
            ws.addEventListener("open", () => {
              open = true
              Deferred.unsafeDone(openDeferred, Effect.void)
            }, { once: true })
            yield* Deferred.await(openDeferred).pipe(
              Effect.timeoutFail({
                duration: options?.openTimeout ?? 10000,
                onTimeout: () =>
                  new SocketError({
                    reason: new SocketOpenError({
                      kind: "Timeout",
                      cause: new Error("timeout waiting for \"open\""),
                    }),
                  }),
              }),
              Effect.raceFirst(FiberSet.join(fiberSet)),
            )
          }
          open = true
          currentWS = ws
          yield* latch.open
          if (opts?.onOpen) yield* opts.onOpen
          return yield* FiberSet.join(fiberSet).pipe(
            Effect.catchIf(
              SocketCloseError.isClean((_) => !closeCodeIsError(_)),
              (_) => Effect.void,
            ),
          )
        }))
        .pipe(
          Effect.mapInputContext((input: Context.Context<R>) => Context.merge(acquireContext, input)),
          Effect.ensuring(Effect.sync(() => {
            latch.unsafeClose()
            currentWS = undefined
          })),
          Effect.interruptible,
        )

    const write = (chunk: Uint8Array | string | CloseEvent) =>
      latch.whenOpen(Effect.sync(() => {
        const ws = currentWS!
        if (isCloseEvent(chunk)) {
          ws.close(chunk.code, chunk.reason)
        } else {
          ws.send(chunk as any)
        }
      }))
    const writer = Effect.succeed(write)

    return Effect.succeed(make({
      runRaw,
      writer,
    }))
  })

export const makeWebSocketChannel = <IE = never>(
  url: string,
  options?: {
    readonly closeCodeIsError?: (code: number) => boolean
  },
): Channel.Channel<
  Chunk.Chunk<Uint8Array>,
  Chunk.Chunk<Uint8Array | string | CloseEvent>,
  SocketError | IE,
  IE,
  void,
  unknown,
  WebSocketConstructor
> =>
  Channel.unwrapScoped(
    Effect.map(makeWebSocket(url, options), toChannelWith<IE>()),
  )

export const layerWebSocket = (
  url: string | Effect.Effect<string>,
  options?: WebSocketOptions,
): Layer.Layer<Socket, never, WebSocketConstructor> =>
  Layer.effect(
    Socket,
    makeWebSocket(url, options),
  )

export const layerWebSocketGlobal = (
  url: string | Effect.Effect<string>,
  options?: WebSocketOptions,
): Layer.Layer<Socket, never, never> =>
  Layer.provide(
    layerWebSocket(url, options),
    layerWebSocketConstructorGlobal,
  )

export const currentSendQueueCapacity: FiberRef.FiberRef<number> = GlobalValue.globalValue(
  "@effect/platform/Socket/currentSendQueueCapacity",
  () => FiberRef.unsafeMake(16),
)

export interface InputTransformStream {
  readonly readable:
    | ReadableStream<Uint8Array>
    | ReadableStream<string>
    | ReadableStream<Uint8Array | string>
  readonly writable: WritableStream<Uint8Array>
}

export const fromTransformStream = <R>(
  acquire: Effect.Effect<InputTransformStream, SocketError, R>,
  options?: {
    readonly closeCodeIsError?: (code: number) => boolean
  },
): Effect.Effect<Socket, never, Exclude<R, Scope.Scope>> =>
  Effect.withFiberRuntime((fiber) => {
    const latch = Effect.unsafeMakeLatch(false)
    let currentStream: {
      readonly stream: InputTransformStream
      readonly fiberSet: FiberSet.FiberSet<any, any>
    } | undefined
    const acquireContext = fiber.currentContext as Context.Context<R>
    const closeCodeIsError = options?.closeCodeIsError ?? defaultCloseCodeIsError
    const runRaw = <_, E, R>(
      handler: (_: string | Uint8Array) => Effect.Effect<_, E, R> | void,
      opts?: {
        readonly onOpen?: Effect.Effect<void> | undefined
      },
    ) =>
      Effect
        .scopedWith(Effect.fnUntraced(function*(scope) {
          const stream = yield* Scope.extend(acquire, scope)
          const reader = stream.readable.getReader()
          yield* Scope.addFinalizer(scope, Effect.promise(() => reader.cancel()))
          const fiberSet = yield* FiberSet.make<any, E | SocketError>().pipe(
            Scope.extend(scope),
          )
          const runFork = yield* FiberSet.runtime(fiberSet)<R>()

          yield* Effect
            .tryPromise({
              try: async () => {
                while (true) {
                  const { done, value } = await reader.read()
                  if (done) {
                    throw new SocketError({ reason: new SocketCloseError({ code: 1000 }) })
                  }
                  const result = handler(value)
                  if (Effect.isEffect(result)) {
                    runFork(result)
                  }
                }
              },
              catch: (cause) =>
                isSocketError(cause)
                  ? cause
                  : new SocketError({ reason: new SocketReadError({ cause }) }),
            })
            .pipe(
              FiberSet.run(fiberSet),
            )

          currentStream = { stream, fiberSet }
          yield* latch.open
          if (opts?.onOpen) yield* opts.onOpen

          return yield* FiberSet.join(fiberSet).pipe(
            Effect.catchIf(
              SocketCloseError.isClean((_) => !closeCodeIsError(_)),
              (_) => Effect.void,
            ),
          )
        }))
        .pipe(
          Effect.mapInputContext((input: Context.Context<R>) => Context.merge(acquireContext, input)),
          Effect.ensuring(Effect.sync(() => {
            latch.unsafeClose()
            currentStream = undefined
          })),
          Effect.interruptible,
        )

    const writers = new WeakMap<
      InputTransformStream,
      WritableStreamDefaultWriter<Uint8Array>
    >()
    const getWriter = (stream: InputTransformStream) => {
      let writer = writers.get(stream)
      if (!writer) {
        writer = stream.writable.getWriter()
        writers.set(stream, writer)
      }
      return writer
    }
    const write = (chunk: Uint8Array | string | CloseEvent) =>
      latch.whenOpen(Effect.suspend(() => {
        const { fiberSet, stream } = currentStream!
        if (isCloseEvent(chunk)) {
          return Deferred.fail(
            fiberSet.deferred,
            new SocketError({
              reason: new SocketCloseError({
                code: chunk.code,
                closeReason: chunk.reason,
              }),
            }),
          )
        }
        return Effect.promise(() =>
          getWriter(stream).write(
            typeof chunk === "string" ? encoder.encode(chunk) : chunk,
          )
        )
      }))
    const writer = Effect.acquireRelease(
      Effect.succeed(write),
      () =>
        Effect.promise(async () => {
          if (!currentStream) return
          await getWriter(currentStream.stream).close()
        }),
    )

    return Effect.succeed(make({
      runRaw,
      writer,
    }))
  })
