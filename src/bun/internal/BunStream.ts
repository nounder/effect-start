/**
 * Ported from effect@4.0.0-rc.112.
 */
import * as Arr from "effect/Array"
import * as Cause from "effect/Cause"
import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"
import type * as Function from "effect/Function"
import type * as Pull from "effect/Pull"
import * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"

export const fromReadableStream = <A, E>(
  options: {
    readonly evaluate: Function.LazyArg<ReadableStream<A>>
    readonly onError: (error: unknown) => E
    readonly releaseLockOnEnd?: boolean | undefined
  },
): Stream.Stream<A, E> =>
  Stream.fromChannel(Channel.fromTransform(Effect.fnUntraced(function*(_, scope) {
    const reader = options.evaluate().getReader()
    yield* Scope.addFinalizer(
      scope,
      options.releaseLockOnEnd ? Effect.sync(() => reader.releaseLock()) : Effect.promise(() => reader.cancel()),
    )
    function readMany(): Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E> {
      const result = reader.readMany()
      if ("then" in result) {
        return Effect.callback<Arr.NonEmptyReadonlyArray<A>, E | Cause.Done>((resume) => {
          result.then((_) => resume(handleResult(_)), (e) => resume(Effect.fail(options.onError(e))))
        })
      }
      return handleResult(result)
    }
    function handleResult(
      result: Bun.ReadableStreamDefaultReadManyResult<A>,
    ): Pull.Pull<Arr.NonEmptyReadonlyArray<A>, E> {
      if (result.done) {
        return Cause.done()
      } else if (!Arr.isReadonlyArrayNonEmpty(result.value)) {
        return readMany()
      }
      return Effect.succeed(result.value)
    }
    // @effect-diagnostics-next-line returnEffectInGen:off
    return Effect.suspend(readMany)
  })))
