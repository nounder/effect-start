import { Array, Effect, Exit, identity, Layer, pipe } from "effect"
import type { FiberFailure } from "effect/Runtime"
import type { YieldWrap } from "effect/Utils"

/**
 * Creates a scoped Effects and runs is asynchronously.
 * Great for testing.
 */
export const effectFn =
  (layer?: Layer.Layer<any>) =>
  <Eff extends YieldWrap<Effect.Effect<any, any, any>>, AEff>(
    f: () => Generator<Eff, AEff, never>,
  ): Promise<any> =>
    pipe(
      Effect.gen(f),
      Effect.scoped,
      layer ? Effect.provide(layer) : identity,
      // @ts-expect-error will have to figure out how to clear deps
      Effect.runPromise,
      // When effect fails, instead of throwing FiberFailure,
      // throw a plain Error with the strack trace and hides
      // effect internals.
      // Otherwise, at least on Bun, the strack trace is repeated,
      // with some junks in between taking half of the screen.
      v =>
        v.catch(err => {
          const newErr = new Error(err.message)
          const stack: string = err.stack ?? ""

          newErr.stack = pipe(
            stack.split("\n"),
            Array.takeWhile(s => !/\(.*\/node_modules\//.test(s)),
            Array.join("\n"),
          )

          throw newErr
        }),
    )
