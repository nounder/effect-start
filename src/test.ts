import { Effect, identity, Layer, pipe } from "effect"
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
    )
