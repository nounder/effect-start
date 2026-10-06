/**
 * Ported from @effect/platform-node-shared@4.0.1.
 */
import type * as Array from "effect/Array"
import * as Channel from "effect/Channel"
import * as Context from "effect/Context"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Latch from "effect/Latch"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as Socket from "effect/socket/Socket"
import * as NNet from "node:net"
import type { Duplex } from "node:stream"

export class NetSocket extends Context.Service<NetSocket, NNet.Socket>()(
  "@effect/platform-node/NodeSocket/NetSocket",
) {}

export const makeNet = (
  options: NNet.NetConnectOpts & {
    readonly openTimeout?: Duration.Input | undefined
  },
): Effect.Effect<Socket.Socket> =>
  fromDuplex(
    Effect.contextWith((context: Context.Context<Scope.Scope>) => {
      let conn: NNet.Socket | undefined
      return Effect.flatMap(
        Scope.addFinalizer(
          Context.get(context, Scope.Scope),
          Effect.sync(() => {
            if (!conn) return
            if (conn.closed === false) {
              if ("destroySoon" in conn) {
                conn.destroySoon()
              } else {
                ;(conn as NNet.Socket).destroy()
              }
            }
          }),
        ),
        () =>
          Effect.callback<NNet.Socket, Socket.SocketError, never>((resume) => {
            conn = NNet.createConnection(options)
            conn.once("connect", () => {
              resume(Effect.succeed(conn!))
            })
            conn.on("error", (cause: Error) => {
              resume(Effect.fail(
                new Socket.SocketError({
                  reason: new Socket.SocketOpenError({ kind: "Unknown", cause }),
                }),
              ))
            })
          }),
      )
    }),
    options,
  )

const readAvailable = (
  conn: Duplex,
): Array.NonEmptyReadonlyArray<Uint8Array | string> | undefined => {
  const first = conn.read() as Uint8Array | string | null
  if (first === null) return undefined
  const second = conn.read() as Uint8Array | string | null
  if (second === null) return [first]
  const out: [Uint8Array | string, ...globalThis.Array<Uint8Array | string>] = [first, second]
  let chunk: Uint8Array | string | null
  while ((chunk = conn.read() as Uint8Array | string | null) !== null) {
    out.push(chunk)
  }
  return out
}

export const fromDuplex = <RO>(
  open: Effect.Effect<Duplex, Socket.SocketError, RO>,
  options?: {
    readonly openTimeout?: Duration.Input | undefined
  },
): Effect.Effect<Socket.Socket, never, Exclude<RO, Scope.Scope>> =>
  Effect.withFiber<Socket.Socket, never, Exclude<RO, Scope.Scope>>((fiber) => {
    let currentSocket: Duplex | undefined
    const latch = Latch.makeUnsafe(false)
    const openServices = fiber.context as Context.Context<RO>

    const reader: Socket.Socket["reader"] = Effect
      .gen(function*() {
        const scope = yield* Effect.scope
        const conn = yield* Scope.provide(open, scope).pipe(
          options?.openTimeout !== undefined ?
            Effect.timeoutOrElse({
              duration: options.openTimeout,
              orElse: () =>
                Effect.fail(
                  new Socket.SocketError({
                    reason: new Socket.SocketOpenError({ kind: "Timeout", cause: new Error("Connection timed out") }),
                  }),
                ),
            }) :
            Function.identity,
        )

        type ReadResume = (
          effect: Effect.Effect<Array.NonEmptyReadonlyArray<Uint8Array | string>, Socket.SocketError>,
        ) => void

        let error: Socket.SocketError | undefined
        let waiter: ReadResume | undefined
        // Bytes consumed by read() while the parked pull was interrupted.
        let pending: Array.NonEmptyReadonlyArray<Uint8Array | string> | undefined
        let reading = false
        let closed = false

        // The only place a waiter is resumed, so delivery order has one owner:
        // retained bytes first, then freshly read bytes, then the error.
        function drain() {
          if (waiter === undefined || reading) return
          let chunk = pending
          pending = undefined
          if (chunk === undefined && !closed) {
            // A data listener can interrupt and replace the pull synchronously.
            // The replacement must wait for this read to preserve byte order.
            reading = true
            try {
              chunk = readAvailable(conn)
            } finally {
              reading = false
            }
          }
          // A close during read() discards the bytes it consumed.
          if (closed) chunk = undefined
          if (waiter === undefined) {
            pending = chunk
            return
          }
          const result = chunk !== undefined
            ? Effect.succeed(chunk)
            : error !== undefined
            ? Effect.fail(error)
            : undefined
          if (result === undefined) return
          const resume = waiter
          waiter = undefined
          resume(result)
        }
        // Normal EOF: already consumed bytes are still delivered before the error.
        function end(err: Socket.SocketError) {
          error ??= err
          drain()
        }
        // Teardown or failure: consumed bytes are discarded.
        function close(err: Socket.SocketError) {
          error ??= err
          closed = true
          pending = undefined
          drain()
        }
        function onEnd() {
          end(new Socket.SocketError({ reason: new Socket.SocketCloseError({ code: 1000 }) }))
        }
        function onError(cause: Error) {
          close(
            new Socket.SocketError({
              reason: new Socket.SocketReadError({ cause }),
            }),
          )
        }
        function onClose(hadError: boolean) {
          const err = new Socket.SocketError({
            reason: new Socket.SocketCloseError({ code: hadError ? 1006 : 1000 }),
          })
          if (hadError) close(err)
          else end(err)
        }

        function attachReadListeners(conn: Duplex) {
          conn.on("readable", drain)
          conn.on("end", onEnd)
          conn.on("error", onError)
          conn.on("close", onClose)
        }

        function detachReadListeners(conn: Duplex) {
          conn.off("readable", drain)
          conn.off("end", onEnd)
          conn.off("error", onError)
          conn.off("close", onClose)
        }

        conn.pause()
        attachReadListeners(conn)
        yield* Scope.addFinalizer(
          scope,
          Effect.sync(() => {
            // resume a pull blocked in another fiber before detaching
            close(
              new Socket.SocketError({
                reason: new Socket.SocketCloseError({ code: 1006 }),
              }),
            )
            detachReadListeners(conn)
            latch.closeUnsafe()
            currentSocket = undefined
          }),
        )

        currentSocket = conn
        latch.openUnsafe()

        const pull = Effect.callback<Array.NonEmptyReadonlyArray<Uint8Array | string>, Socket.SocketError>((resume) => {
          waiter = resume
          drain()
          // Resumed synchronously: nothing to cancel.
          if (waiter !== resume) return
          return Effect.sync(() => {
            if (waiter === resume) waiter = undefined
          })
        })

        return { pull, upgrade: Socket.SocketUpgradeError.unsupported }
      })
      .pipe(
        Effect.updateContext((input: Context.Context<Scope.Scope>) => Context.merge(openServices, input)),
      ) as Socket.Socket["reader"]

    const awaitDrain = (conn: Duplex) =>
      Effect.callback<void, Socket.SocketError>((resume) => {
        function cleanup() {
          conn.off("drain", onDrain)
          conn.off("error", onError)
          conn.off("close", onClose)
        }
        function onDrain() {
          cleanup()
          resume(Effect.void)
        }
        function onError(cause: Error) {
          cleanup()
          resume(Effect.fail(
            new Socket.SocketError({
              reason: new Socket.SocketWriteError({ cause }),
            }),
          ))
        }
        function onClose() {
          cleanup()
          resume(Effect.fail(
            new Socket.SocketError({
              reason: new Socket.SocketWriteError({ cause: new Error("socket closed") }),
            }),
          ))
        }
        conn.on("drain", onDrain)
        conn.on("error", onError)
        conn.on("close", onClose)
        return Effect.sync(cleanup)
      })

    const write = (
      chunk: Uint8Array | string | Socket.CloseEvent,
    ): Effect.Effect<void, Socket.SocketError> =>
      Effect.suspend(() => {
        const conn = currentSocket
        if (conn === undefined) return latch.whenOpen(write(chunk))
        if (Socket.isCloseEvent(chunk)) {
          conn.destroy(chunk.code > 1000 ? new Error(`closed with code ${chunk.code}`) : undefined)
          return Effect.void
        }
        try {
          return conn.write(chunk) ? Effect.void : awaitDrain(conn)
        } catch (cause) {
          return Effect.fail(
            new Socket.SocketError({
              reason: new Socket.SocketWriteError({ cause }),
            }),
          )
        }
      })

    const writeAll = (
      chunks: Array.NonEmptyReadonlyArray<Uint8Array | string>,
    ): Effect.Effect<void, Socket.SocketError> =>
      Effect.suspend(() => {
        const conn = currentSocket
        if (conn === undefined) return latch.whenOpen(writeAll(chunks))
        let needsDrain = false
        try {
          if (chunks.length === 1) {
            needsDrain = !conn.write(chunks[0])
          } else {
            conn.cork()
            try {
              for (let i = 0; i < chunks.length; i++) {
                needsDrain = !conn.write(chunks[i]) || needsDrain
              }
            } finally {
              conn.uncork()
            }
          }
        } catch (cause) {
          return Effect.fail(
            new Socket.SocketError({
              reason: new Socket.SocketWriteError({ cause }),
            }),
          )
        }
        return needsDrain ? awaitDrain(conn) : Effect.void
      })

    const writer: Socket.Socket["writer"] = Effect.acquireRelease(
      Effect.succeed({ write, writeAll }),
      () =>
        Effect.sync(() => {
          if (!currentSocket || currentSocket.writableEnded) return
          currentSocket.end()
        }),
    )

    return Effect.succeed(Socket.make({ reader, writer }))
  })

export const makeNetChannel = <IE = never>(
  options: NNet.NetConnectOpts,
): Channel.Channel<
  Array.NonEmptyReadonlyArray<Uint8Array>,
  Socket.SocketError | IE,
  void,
  Array.NonEmptyReadonlyArray<Uint8Array | string | Socket.CloseEvent>,
  IE
> =>
  Channel.unwrap(
    Effect.map(makeNet(options), Socket.toChannelWith<IE>()),
  )

export const layerNet: (options: NNet.NetConnectOpts) => Layer.Layer<
  Socket.Socket,
  Socket.SocketError
> = Function.flow(makeNet, Layer.effect(Socket.Socket))
