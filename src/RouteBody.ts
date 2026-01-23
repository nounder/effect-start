import * as Effect from "effect/Effect"
import type * as Stream from "effect/Stream"
import type * as Utils from "effect/Utils"
import * as Entity from "./Entity.ts"
import * as Route from "./Route.ts"
import type * as Values from "./Values.ts"

export type Format =
  | "text"
  | "html"
  | "json"
  | "bytes"
  | "*"

type UnwrapStream<T> = T extends Stream.Stream<infer V, any, any> ? V : T

export type HandlerInput<B, A, E, R> =
  | A
  | Entity.Entity<A>
  | Effect.Effect<A | Entity.Entity<A>, E, R>
  | ((
    context: Values.Simplify<B>,
    next: (
      context?: Partial<B> & Record<string, unknown>,
    ) => Entity.Entity<UnwrapStream<A>>,
  ) =>
    | Effect.Effect<A | Entity.Entity<A>, E, R>
    | Generator<
      Utils.YieldWrap<Effect.Effect<unknown, E, R>>,
      A | Entity.Entity<A>,
      unknown
    >)

export function handle<B, A, E, R>(
  handler: (
    context: B,
    next: (context?: Partial<B> & Record<string, unknown>) => Entity.Entity<A>,
  ) =>
    | Effect.Effect<A | Entity.Entity<A>, E, R>
    | Generator<
      Utils.YieldWrap<Effect.Effect<unknown, E, R>>,
      A | Entity.Entity<A>,
      unknown
    >,
): Route.Route.Handler<B, A, E, R>
export function handle<A, E, R>(
  handler: Effect.Effect<A | Entity.Entity<A>, E, R>,
): Route.Route.Handler<{}, A, E, R>
export function handle<A>(
  handler: A | Entity.Entity<A>,
): Route.Route.Handler<{}, A, never, never>
export function handle<B, A, E, R>(
  handler: HandlerInput<B, A, E, R>,
): Route.Route.Handler<B, A, E, R> {
  if (typeof handler === "function") {
    return (
      context: B,
      next: (
        context?: Partial<B> & Record<string, unknown>,
      ) => Entity.Entity<A>,
    ): Effect.Effect<Entity.Entity<A>, E, R> => {
      const result = (handler as Function)(context, next)
      const effect = Effect.isEffect(result)
        ? result as Effect.Effect<A | Entity.Entity<A>, E, R>
        : Effect.gen(function*() {
          return yield* result
        }) as Effect.Effect<A | Entity.Entity<A>, E, R>
      return Effect.map(effect, normalizeToEntity)
    }
  }
  if (Effect.isEffect(handler)) {
    return (_context, _next) =>
      Effect.map(handler, normalizeToEntity) as Effect.Effect<
        Entity.Entity<A>,
        E,
        R
      >
  }
  if (Entity.isEntity(handler)) {
    return (_context, _next) => Effect.succeed(handler as Entity.Entity<A>)
  }
  return (_context, _next) =>
    Effect.succeed(Entity.make(handler as A, { status: 200 }))
}

function normalizeToEntity<A>(value: A | Entity.Entity<A>): Entity.Entity<A> {
  if (Entity.isEntity(value)) {
    return value as Entity.Entity<A>
  }
  return Entity.make(value as A, { status: 200 })
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
    A extends F extends "json" ? Value
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

export type RenderValue =
  | string
  | Uint8Array
  | Stream.Stream<string | Uint8Array, any, any>

export function render<
  D extends Route.RouteDescriptor.Any,
  B extends {},
  I extends Route.Route.Tuple,
  A extends RenderValue,
  E = never,
  R = never,
>(
  handler: HandlerInput<
    NoInfer<
      D & B & Route.ExtractBindings<I> & { format: "*" }
    >,
    A,
    E,
    R
  >,
) {
  return function(
    self: Route.RouteSet.RouteSet<D, B, I>,
  ) {
    const route = Route.make<{ format: "*" }, {}, A, E, R>(
      handle(handler) as any,
      { format: "*" },
    )

    const items: [...I, Route.Route.Route<{ format: "*" }, {}, A, E, R>] = [
      ...Route.items(self),
      route,
    ]

    return Route.set<
      D,
      B,
      [...I, Route.Route.Route<{ format: "*" }, {}, A, E, R>]
    >(
      items,
      Route.descriptor(self),
    )
  }
}
