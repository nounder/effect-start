import {
  Array,
  Effect,
  identity,
  Layer,
  Logger,
  pipe,
  Scope,
} from "effect"
import type { YieldWrap } from "effect/Utils"

/**
 * Creates a scoped Effects and runs is asynchronously.
 * Useful for testing.
 */
export const effectFn = <RL>(layer?: Layer.Layer<RL, any>) =>
<
  Eff extends YieldWrap<Effect.Effect<any, any, RE>>,
  AEff,
  RE extends RL | Scope.Scope,
>(
  f: () => Generator<Eff, AEff, never>,
): Promise<void> =>
  pipe(
    Effect.gen(f),
    Effect.scoped,
    Effect.provide(Logger.pretty),
    Effect.provide(layer ?? Layer.empty),
    // @ts-expect-error will have to figure out how to clear deps
    Effect.runPromise,
    v => v.then(() => {}, clearStackTraces),
  )

/*
 * When effect fails, instead of throwing FiberFailure,
 * throw a plain Error with the strack trace and hides
 * effect internals.
 * Otherwise, at least on Bun, the strack trace is repeated,
 * with some junks in between taking half of the screen.
 *
 * Direct children that starts with a dot are excluded because
 * some tools, like effect-bundler, use it to generate temporary
 * files that are then loaded into a runtime.
 */
const clearStackTraces = (err: any | Error) => {
  const ExternalStackTraceLineRegexp = /\(.*\/node_modules\/[^\.]/

  const newErr = new Error(err.message)
  const stack: string = err.stack ?? ""

  newErr.stack = pipe(
    stack.split("\n"),
    Array.takeWhile(s => !ExternalStackTraceLineRegexp.test(s)),
    Array.join("\n"),
  )

  throw newErr
}
