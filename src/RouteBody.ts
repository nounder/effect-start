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

const formatToContentType: Record<Format, string | undefined> = {
  text: "text/plain; charset=utf-8",
  html: "text/html; charset=utf-8",
  json: "application/json",
  bytes: "application/octet-stream",
  "*": undefined,
}

type UnwrapStream<T> = T extends Stream.Stream<infer V, any, any> ? V : T

type YieldError<T> = T extends Utils.YieldWrap<Effect.Effect<any, infer E, any>>
  ? E
  : never

type YieldContext<T> = T extends
  Utils.YieldWrap<Effect.Effect<any, any, infer R>> ? R
  : never

export type GeneratorHandler<B, A, Y> = (
  context: Values.Simplify<B>,
  next: (
    context?: Partial<B> & Record<string, unknown>,
  ) => Entity.Entity<UnwrapStream<A>>,
) => Generator<Y, A | Entity.Entity<A>, never>

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

export function handle<
  B,
  A,
  Y extends Utils.YieldWrap<Effect.Effect<any, any, any>>,
>(
  handler: GeneratorHandler<B, A, Y>,
): Route.Route.Handler<B, A, YieldError<Y>, YieldContext<Y>>
export function handle<B, A, E, R>(
  handler: HandlerInput<B, A, E, R>,
): Route.Route.Handler<B, A, E, R>
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
    Effect.succeed(normalizeToEntity(handler as A) as Entity.Entity<A>)
}

function normalizeToEntity<A>(value: A | Entity.Entity<A>): Entity.Entity<A> {
  if (Entity.isEntity(value)) {
    return value as Entity.Entity<A>
  }
  return Entity.make(value as A, { status: 200 })
}

export interface BuildReturn<
  Value,
  F extends Format,
> {
  <
    D extends Route.RouteDescriptor.Any,
    B,
    I extends Route.Route.Tuple,
    A extends F extends "json" ? Value
      : Value | Stream.Stream<Value, any, any>,
    Y extends Utils.YieldWrap<Effect.Effect<any, any, any>>,
  >(
    handler: GeneratorHandler<
      NoInfer<D & B & Route.ExtractBindings<I> & { format: F }>,
      A,
      Y
    >,
  ): (
    self: Route.RouteSet.RouteSet<D, B, I>,
  ) => Route.RouteSet.RouteSet<
    D,
    B,
    [
      ...I,
      Route.Route.Route<{ format: F }, {}, A, YieldError<Y>, YieldContext<Y>>,
    ]
  >

  <
    D extends Route.RouteDescriptor.Any,
    B,
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
  ): (
    self: Route.RouteSet.RouteSet<D, B, I>,
  ) => Route.RouteSet.RouteSet<
    D,
    B,
    [...I, Route.Route.Route<{ format: F }, {}, A, E, R>]
  >
}

export function build<
  Value,
  F extends Format,
>(
  descriptors: { format: F },
) {
  return (function<
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
      const contentType = formatToContentType[descriptors.format]
      const baseHandler = handle(handler)
      const wrappedHandler: Route.Route.Handler<
        D & B & Route.ExtractBindings<I> & { format: F },
        A,
        E,
        R
      > = (ctx, next) =>
        Effect.map(
          baseHandler(ctx as any, next as any),
          (entity) =>
            entity.headers["content-type"]
              ? entity
              : Entity.make(entity.body, {
                status: entity.status,
                url: entity.url,
                headers: { ...entity.headers, "content-type": contentType },
              }),
        )

      const route = Route.make<{ format: F }, {}, A, E, R>(
        wrappedHandler as any,
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
  }) as unknown as BuildReturn<Value, F>
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
  Y extends Utils.YieldWrap<Effect.Effect<any, any, any>>,
>(
  handler: GeneratorHandler<
    NoInfer<D & B & Route.ExtractBindings<I> & { format: "*" }>,
    A,
    Y
  >,
): (
  self: Route.RouteSet.RouteSet<D, B, I>,
) => Route.RouteSet.RouteSet<
  D,
  B,
  [
    ...I,
    Route.Route.Route<{ format: "*" }, {}, A, YieldError<Y>, YieldContext<Y>>,
  ]
>
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
): (
  self: Route.RouteSet.RouteSet<D, B, I>,
) => Route.RouteSet.RouteSet<
  D,
  B,
  [...I, Route.Route.Route<{ format: "*" }, {}, A, E, R>]
>
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
