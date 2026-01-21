import * as Effect from "effect/Effect"
import type * as Stream from "effect/Stream"
import type * as Utils from "effect/Utils"
import * as Route from "./Route.ts"

export type Format =
  | "text"
  | "html"
  | "json"
  | "bytes"

type UnwrapStream<T> = T extends Stream.Stream<infer V, any, any> ? V : T

export type HandlerInput<B, A, E, R> =
  | A
  | Effect.Effect<A, E, R>
  | ((context: _Simplify<B>, next: () => Effect.Effect<UnwrapStream<A>>) =>
    | Effect.Effect<A, E, R>
    | Generator<Utils.YieldWrap<Effect.Effect<any, E, R>>, A, any>)

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
  F extends Format,
>(
  descriptors: { format: F },
) {
  return function<
    D extends Route.RouteDescriptor.Any,
    B extends {},
    I extends Route.Route.Tuple,
    A extends F extends "json"
      ? Value
      : Value | Stream.Stream<Value, any, any>,
    E = never,
    R = never,
  >(
    handler: HandlerInput<
      NoInfer<
        D & B & Route.ExtractBindings<I> & { format: F }
      >,
      A,
      E,
      R
    >,
  ) {
    return function(
      self: Route.RouteSet.RouteSet<D, B, I>,
    ) {
      const route = Route.make<{ format: F }, {}, A, E, R>(
        handle(handler) as any,
        descriptors,
      )

      const items: [...I, Route.Route.Route<{ format: F }, {}, A, E, R>] = [
        ...Route.items(self),
        route,
      ]

      return Route.set<
        D,
        B,
        [...I, Route.Route.Route<{ format: F }, {}, A, E, R>]
      >(
        items,
        Route.descriptor(self),
      )
    }
  }
}

// used to simplify the context type passed to route handlers
// for those who prefer to write code by hand :)
type _Simplify<T> = {
  -readonly [K in keyof T]: T[K] extends object
    ? { -readonly [P in keyof T[K]]: T[K][P] }
    : T[K]
} extends infer U ? { [K in keyof U]: U[K] } : never
