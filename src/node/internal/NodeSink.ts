/**
 * Ported from effect@4.0.0-rc.112.
 */
import type * as Arr from "effect/Array"
import * as Cause from "effect/Cause"
import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Pull from "effect/Pull"
import * as Sink from "effect/Sink"
import type { Writable } from "node:stream"

export const fromWritable = <E, A = Uint8Array | string>(
  options: {
    readonly evaluate: Function.LazyArg<Writable | NodeJS.WritableStream>
    readonly onError: (error: unknown) => E
    readonly endOnDone?: boolean | undefined
    readonly encoding?: BufferEncoding | undefined
  },
): Sink.Sink<void, A, never, E> =>
  Sink.fromChannel(Channel.mapDone(fromWritableChannel<never, E, A>(options), (_) => [_]))

export const fromWritableChannel = <IE, E, A = Uint8Array | string>(
  options: {
    readonly evaluate: Function.LazyArg<Writable | NodeJS.WritableStream>
    readonly onError: (error: unknown) => E
    readonly endOnDone?: boolean | undefined
    readonly encoding?: BufferEncoding | undefined
  },
): Channel.Channel<never, IE | E, void, Arr.NonEmptyReadonlyArray<A>, IE> =>
  Channel.fromTransform((pull: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, IE, unknown>) => {
    const writable = options.evaluate() as Writable
    return Effect.succeed(pullIntoWritable({ ...options, writable, pull }))
  })

export const pullIntoWritable = <A, IE, E>(options: {
  readonly pull: Pull.Pull<Arr.NonEmptyReadonlyArray<A>, IE, unknown>
  readonly writable: Writable
  readonly onError: (error: unknown) => E
  readonly endOnDone?: boolean | undefined
  readonly encoding?: BufferEncoding | undefined
}): Pull.Pull<never, IE | E, unknown> =>
  options.pull.pipe(
    Effect.flatMap((chunk) => {
      let i = 0
      return Effect.callback<void, E>(function loop(resume) {
        for (; i < chunk.length;) {
          const success = options.writable.write(chunk[i++], options.encoding as any)
          if (!success) {
            options.writable.once("drain", () => (loop as any)(resume))
            return
          }
        }
        resume(Effect.void)
      })
    }),
    Effect.forever({ disableYield: true }),
    Effect.raceFirst(Effect.callback<never, E>((resume) => {
      const onError = (error: unknown) => resume(Effect.fail(options.onError(error)))
      options.writable.once("error", onError)
      return Effect.sync(() => {
        options.writable.off("error", onError)
      })
    })),
    options.endOnDone !== false ?
      Pull.catchDone((_) => {
        if ("closed" in options.writable && options.writable.closed) {
          return Cause.done(_)
        }
        return Effect.callback<never, E | Cause.Done<unknown>>((resume) => {
          options.writable.once("finish", () => resume(Cause.done(_)))
          options.writable.end()
        })
      }) :
      Function.identity,
  )
