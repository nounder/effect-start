/*
 * Adapted from effect-smol aka v4
 */
import * as Channel from "effect/Channel"
import type * as Chunk from "effect/Chunk"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as FiberSet from "effect/FiberSet"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as NNet from "node:net"
import type * as NStream from "node:stream"
import * as Socket from "../Socket.ts"

export interface NetSocket {
  readonly _: unique symbol
}

export const NetSocket: Context.Tag<NetSocket, NNet.Socket> = Context.GenericTag(
  "effect-start/node/NodeSocket/NetSocket",
)

export const makeNet = (
  options: NNet.NetConnectOpts & {
    readonly openTimeout?: Duration.DurationInput | undefined
  },
): Effect.Effect<Socket.Socket> =>
  fromDuplex(
    Effect.gen(function*() {
      let conn: NNet.Socket | undefined
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          if (!conn || conn.destroyed) return
          if ("destroySoon" in conn && typeof conn.destroySoon === "function") {
            conn.destroySoon()
          } else {
            conn.destroy()
          }
        })
      )
      return yield* Effect.async<NNet.Socket, Socket.SocketError>((resume) => {
        conn = NNet.createConnection(options)
        const onConnect = () => {
          conn!.off("error", onError)
          resume(Effect.succeed(conn!))
        }
        const onError = (cause: Error) => {
          conn!.off("connect", onConnect)
          resume(
            Effect.fail(
              new Socket.SocketError({
                reason: new Socket.SocketOpenError({ kind: "Unknown", cause }),
              }),
            ),
          )
        }
        conn.once("connect", onConnect)
        conn.once("error", onError)
      })
    }),
    options,
  )

export const fromDuplex = <RO>(
  open: Effect.Effect<NStream.Duplex, Socket.SocketError, RO>,
  options?: {
    readonly openTimeout?: Duration.DurationInput | undefined
  },
): Effect.Effect<Socket.Socket, never, Exclude<RO, Scope.Scope>> =>
  Effect.withFiberRuntime((fiber) => {
    let currentSocket: NStream.Duplex | undefined
    const latch = Effect.unsafeMakeLatch(false)
    const openContext = fiber.currentContext as Context.Context<RO>

    const run = <_, E, R>(
      handler: (_: Uint8Array) => Effect.Effect<_, E, R> | void,
      opts?: {
        readonly onOpen?: Effect.Effect<void> | undefined
      },
    ) =>
      Effect
        .scopedWith(Effect.fnUntraced(function*(scope) {
          const fiberSet = yield* FiberSet.make<any, E | Socket.SocketError>().pipe(
            Scope.extend(scope),
          )
          let conn: NStream.Duplex | undefined
          yield* Scope.addFinalizer(
            scope,
            Effect.sync(() => {
              if (!conn) return
              conn.off("data", onData)
              conn.off("end", onEnd)
              conn.off("error", onError)
              conn.off("close", onClose)
            }),
          )

          const acquire = Scope.extend(open, scope)
          conn = yield* options?.openTimeout
            ? acquire.pipe(
              Effect.timeoutFail({
                duration: options.openTimeout,
                onTimeout: () =>
                  new Socket.SocketError({
                    reason: new Socket.SocketOpenError({
                      kind: "Timeout",
                      cause: new Error("Connection timed out"),
                    }),
                  }),
              }),
            )
            : acquire

          conn.on("end", onEnd)
          conn.on("error", onError)
          conn.on("close", onClose)
          const runFork = yield* Effect.provideService(
            FiberSet.runtime(fiberSet)<R>(),
            NetSocket,
            conn as NNet.Socket,
          )
          conn.on("data", onData)

          currentSocket = conn
          yield* latch.open
          if (opts?.onOpen) yield* opts.onOpen

          return yield* FiberSet.join(fiberSet)

          function onData(chunk: Uint8Array) {
            const result = handler(chunk)
            if (Effect.isEffect(result)) {
              runFork(result)
            }
          }

          function onEnd() {
            Deferred.unsafeDone(fiberSet.deferred, Effect.void)
          }

          function onError(cause: Error) {
            Deferred.unsafeDone(
              fiberSet.deferred,
              Effect.fail(
                new Socket.SocketError({
                  reason: new Socket.SocketReadError({ cause }),
                }),
              ),
            )
          }

          function onClose(hadError: boolean) {
            Deferred.unsafeDone(
              fiberSet.deferred,
              Effect.fail(
                new Socket.SocketError({
                  reason: new Socket.SocketCloseError({ code: hadError ? 1006 : 1000 }),
                }),
              ),
            )
          }
        }))
        .pipe(
          Effect.mapInputContext((input: Context.Context<R>) => Context.merge(openContext, input)),
          Effect.ensuring(Effect.sync(() => {
            latch.unsafeClose()
            currentSocket = undefined
          })),
          Effect.interruptible,
        )

    const write = (chunk: Uint8Array | string | Socket.CloseEvent) =>
      latch.whenOpen(
        Effect.async<void, Socket.SocketError>((resume) => {
          const conn = currentSocket!
          if (Socket.isCloseEvent(chunk)) {
            conn.destroy(chunk.code > 1000 ? new Error(`closed with code ${chunk.code}`) : undefined)
            resume(Effect.void)
            return
          }

          try {
            conn.write(chunk, (cause?: Error | null) => {
              resume(
                cause
                  ? Effect.fail(
                    new Socket.SocketError({
                      reason: new Socket.SocketWriteError({ cause }),
                    }),
                  )
                  : Effect.void,
              )
            })
          } catch (cause) {
            resume(
              Effect.fail(
                new Socket.SocketError({
                  reason: new Socket.SocketWriteError({ cause }),
                }),
              ),
            )
          }
        }),
      )

    const writer = Effect.acquireRelease(
      Effect.succeed(write),
      () =>
        Effect.sync(() => {
          if (!currentSocket || currentSocket.writableEnded) return
          currentSocket.end()
        }),
    )

    return Effect.succeed(Socket.make({
      run,
      runRaw: run,
      writer,
    }))
  })

export const makeNetChannel = <IE = never>(
  options: NNet.NetConnectOpts & {
    readonly openTimeout?: Duration.DurationInput | undefined
  },
): Channel.Channel<
  Chunk.Chunk<Uint8Array>,
  Chunk.Chunk<Uint8Array | string | Socket.CloseEvent>,
  Socket.SocketError | IE,
  IE,
  void,
  unknown
> =>
  Channel.unwrap(
    Effect.map(makeNet(options), Socket.toChannelWith<IE>()),
  )

export const layerNet: (
  options: NNet.NetConnectOpts & {
    readonly openTimeout?: Duration.DurationInput | undefined
  },
) => Layer.Layer<Socket.Socket> = Function.flow(makeNet, Layer.effect(Socket.Socket))
