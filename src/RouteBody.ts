import * as Effect from "effect/Effect"
import type * as Types from "effect/Types"
import type * as Utils from "effect/Utils"
import * as Route from "./Route.ts"

type Format<V extends string> = {
  format: V
}

export type HandlerInput<B, A, E, R> =
  | A
  | Effect.Effect<A, E, R>
  | ((context: Types.Simplify<B>, next: () => Effect.Effect<A>) =>
    | Effect.Effect<A, E, R>
    | Generator<Utils.YieldWrap<Effect.Effect<any, E, R>>, A, any>)

/**
 * Normalize handler.
 */
export function handle<B, A, E, R>(
  handler: (context: B, next: () => Effect.Effect<A>) =>
    | Effect.Effect<A, E, R>
    | Generator<Utils.YieldWrap<Effect.Effect<any, E, R>>, A, any>,
): Route.Route.HandlerImmutable<B, A, E, R>
export function handle<A, E, R>(
  handler: Effect.Effect<A, E, R>,
): Route.Route.HandlerImmutable<{}, A, E, R>
export function handle<A>(
  handler: A,
): Route.Route.HandlerImmutable<{}, A, never, never>
export function handle<B, A, E, R>(
  handler: HandlerInput<B, A, E, R>,
): Route.Route.HandlerImmutable<B, A, E, R> {
  if (typeof handler === "function") {
    return (
      context: B,
      next: () => Effect.Effect<A>,
    ): Effect.Effect<A, E, R> => {
      const result = (handler as Function)(context, next)
      if (Effect.isEffect(result)) {
        return result as Effect.Effect<A, E, R>
      }
      return Effect.gen(function*() {
        return yield* result
      }) as Effect.Effect<A, E, R>
    }
  }
  if (Effect.isEffect(handler)) {
    return (_context, _next) => handler
  }
  return (_context, _next) => Effect.succeed(handler as A)
}

export function build<
  Value,
  F extends string,
>(
  descriptors: Format<F>,
) {
  return function<
    D extends Route.RouteDescriptor.Any,
    B extends {},
    I extends Route.RouteSet.Tuple,
    A extends Value,
    E = never,
    R = never,
  >(
    handler: HandlerInput<
      NoInfer<
        D & B & Route.ExtractBindings<I> & Format<F>
      >,
      A,
      E,
      R
    >,
  ) {
    return function(
      self: Route.RouteSet.RouteSet<D, B, I>,
    ) {
      const route = Route.make(
        handle(handler) as any,
        descriptors,
      )

      return Route.set(
        [
          ...Route.items(self),
          route,
        ] as [...I, Route.Route.Route<Format<F>, {}, A, E, R>],
      )
    }
  }
}
