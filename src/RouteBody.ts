import * as Effect from "effect/Effect"
import type * as Stream from "effect/Stream"
import type * as Utils from "effect/Utils"
import * as Entity from "./Entity.ts"
import * as Route from "./Route.ts"
import * as StreamExtra from "./internal/StreamExtra.ts"
import type * as Values from "./internal/Values.ts"

export type Format = "text" | "html" | "json" | "bytes" | "sse" | "*"

const formatToContentType: Record<Format, string | undefined> = {
  text: "text/plain; charset=utf-8",
  html: "text/html; charset=utf-8",
  json: "application/json",
  bytes: "application/octet-stream",
  sse: "text/event-stream",
  "*": undefined,
}

type UnwrapStream<T> = T extends Stream.Stream<infer V, any, any> ? V : T

type YieldError<T> = T extends Utils.YieldWrap<Effect.Effect<any, infer E, any>> ? E : never

type YieldContext<T> = T extends Utils.YieldWrap<Effect.Effect<any, any, infer R>> ? R : never

type Next<B, A> = (context?: Partial<B> & Record<string, unknown>) => Entity.Entity<UnwrapStream<A>>

type HandlerReturn<A> =
  | A
  | Entity.Entity<A, any>
  | Entity.Entity<Uint8Array, any>
  | ((self: Route.RouteSet.Any) => Route.RouteSet.Any)

type HandlerFunction<B, A, E, R> = (
  context: Values.Simplify<B>,
  next: Next<B, A>,
) =>
  | Effect.Effect<HandlerReturn<A>, E, R>
  | Generator<Utils.YieldWrap<Effect.Effect<unknown, E, R>>, HandlerReturn<A>, unknown>

export type GeneratorHandler<B, A, Y> = (
  context: Values.Simplify<B>,
  next: Next<B, A>,
) => Generator<Y, HandlerReturn<A>, never>

export type HandlerInput<B, A, E, R> =
  | A
  | Entity.Entity<A, any>
  | Effect.Effect<HandlerReturn<A>, E, R>
  | HandlerFunction<B, A, E, R>

function isHandlerFunction<B, A, E, R>(
  handler: HandlerInput<B, A, E, R>,
): handler is HandlerFunction<B, A, E, R> {
  return typeof handler === "function"
}

export function handle<B, A, Y extends Utils.YieldWrap<Effect.Effect<any, any, any>>>(
  handler: GeneratorHandler<B, A, Y>,
): Route.Route.Handler<B, A, YieldError<Y>, YieldContext<Y>>
export function handle<B, A, E, R>(
  handler: HandlerInput<B, A, E, R>,
): Route.Route.Handler<B, A, E, R>
export function handle<B, A, E, R>(
  handler: HandlerInput<B, A, E, R>,
): Route.Route.Handler<B, A, E, R> {
  if (isHandlerFunction(handler)) {
    return ((context: any, next: any) => {
      const result = handler(context, next)
      const effect = Effect.isEffect(result)
        ? result
        : Effect.gen(function* () {
            return yield* result
          })
      return Effect.flatMap(effect, normalizeToEntity)
    }) as Route.Route.Handler<B, A, E, R>
  }
  if (Effect.isEffect(handler)) {
    return ((_context: any, _next: any) =>
      Effect.flatMap(handler, normalizeToEntity)) as Route.Route.Handler<B, A, E, R>
  }
  if (Entity.isEntity(handler)) {
    return (_context, _next) => Effect.succeed(handler as Entity.Entity<A>)
  }
  return ((_context: any, _next: any) => normalizeToEntity(handler)) as Route.Route.Handler<
    B,
    A,
    E,
    R
  >
}

function normalizeToEntity(value: unknown): Effect.Effect<Entity.Entity<any>> {
  if (typeof value === "function") {
    const result = (value as (self: Route.RouteSet.Any) => Route.RouteSet.Any)(Route.empty)
    const routes = Route.items(result)
    const route = routes[0]
    if (route) {
      return route.handler({}, () => Entity.make("")) as Effect.Effect<Entity.Entity<any>>
    }
  }
  if (Entity.isEntity(value)) {
    return Effect.succeed(value)
  }
  return Effect.succeed(Entity.make(value, { status: 200 }))
}

export interface BuildReturn<Value, F extends Format, Body = never> {
  <
    D extends Route.RouteDescriptor.Any,
    B,
    I extends Route.Route.Tuple,
    A extends F extends "json" ? Value : Value | Stream.Stream<Value, any, any>,
    Y extends Utils.YieldWrap<Effect.Effect<any, any, any>>,
  >(
    handler: GeneratorHandler<NoInfer<D & B & Route.ExtractBindings<I> & { format: F }>, A, Y>,
  ): (
    self: Route.RouteSet<D, B, I>,
  ) => Route.RouteSet<
    D,
    B,
    [
      ...I,
      Route.Route<
        { format: F },
        {},
        [Body] extends [never] ? A : Body,
        YieldError<Y>,
        YieldContext<Y>
      >,
    ]
  >

  <
    D extends Route.RouteDescriptor.Any,
    B,
    I extends Route.Route.Tuple,
    A extends F extends "json" ? Value : Value | Stream.Stream<Value, any, any>,
    E = never,
    R = never,
  >(
    handler: HandlerInput<NoInfer<D & B & Route.ExtractBindings<I> & { format: F }>, A, E, R>,
  ): (
    self: Route.RouteSet<D, B, I>,
  ) => Route.RouteSet<
    D,
    B,
    [...I, Route.Route<{ format: F }, {}, [Body] extends [never] ? A : Body, E, R>]
  >
}

export function build<Value, F extends Format>(options: { format: F }): BuildReturn<Value, F>
export function build<Value, Body, F extends Format>(options: {
  format: F
  handle: (body: Value) => Body
}): BuildReturn<Value, F, Body>
export function build<Value, F extends Format>(options: {
  format: F
  handle?: (body: any) => any
}): any {
  const { handle: handleBody, ...descriptors } = options
  return function <
    D extends Route.RouteDescriptor.Any,
    B,
    I extends Route.Route.Tuple,
    A extends F extends "json" ? Value : Value | Stream.Stream<Value, any, any>,
    E = never,
    R = never,
  >(handler: HandlerInput<NoInfer<D & B & Route.ExtractBindings<I> & { format: F }>, A, E, R>) {
    return (self: Route.RouteSet<D, B, I>) => {
      const contentType = formatToContentType[descriptors.format]
      const baseHandler = handle(handler)
      const wrappedHandler: Route.Route.Handler<{ format: F }, A, E, R> = (ctx, next) =>
        baseHandler(ctx as D & B & Route.ExtractBindings<I> & { format: F }, next).pipe(
          Effect.map((entity) => {
            const body =
              handleBody && !StreamExtra.isStream(entity.body)
                ? handleBody(entity.body)
                : entity.body
            if (
              body === entity.body &&
              (entity.headers["content-type"] || contentType === undefined)
            )
              return entity
            return Entity.make(body as A, {
              status: entity.status,
              url: entity.url,
              headers:
                entity.headers["content-type"] || contentType === undefined
                  ? entity.headers
                  : { ...entity.headers, "content-type": contentType },
            })
          }),
        )

      const route = Route.make<{ format: F }, {}, A, E, R>(wrappedHandler, descriptors)

      return Route.set<D, B, [...I, Route.Route<{ format: F }, {}, A, E, R>]>(
        [...Route.items(self), route],
        Route.descriptor(self),
      )
    }
  } as BuildReturn<Value, F>
}

export type RenderValue = string | Uint8Array | Stream.Stream<string | Uint8Array, any, any>

export function render<
  D extends Route.RouteDescriptor.Any,
  B extends {},
  I extends Route.Route.Tuple,
  A extends RenderValue,
  Y extends Utils.YieldWrap<Effect.Effect<any, any, any>>,
>(
  handler: GeneratorHandler<NoInfer<D & B & Route.ExtractBindings<I> & { format: "*" }>, A, Y>,
): (
  self: Route.RouteSet<D, B, I>,
) => Route.RouteSet<
  D,
  B,
  [...I, Route.Route<{ format: "*" }, {}, A, YieldError<Y>, YieldContext<Y>>]
>
export function render<
  D extends Route.RouteDescriptor.Any,
  B extends {},
  I extends Route.Route.Tuple,
  A extends RenderValue,
  E = never,
  R = never,
>(
  handler: HandlerInput<NoInfer<D & B & Route.ExtractBindings<I> & { format: "*" }>, A, E, R>,
): (
  self: Route.RouteSet<D, B, I>,
) => Route.RouteSet<D, B, [...I, Route.Route<{ format: "*" }, {}, A, E, R>]>
export function render<
  D extends Route.RouteDescriptor.Any,
  B extends {},
  I extends Route.Route.Tuple,
  A extends RenderValue,
  E = never,
  R = never,
>(handler: HandlerInput<NoInfer<D & B & Route.ExtractBindings<I> & { format: "*" }>, A, E, R>) {
  return (self: Route.RouteSet<D, B, I>) => {
    const baseHandler = handle(handler)
    const route = Route.make<{ format: "*" }, {}, A, E, R>(
      (ctx, next) => baseHandler(ctx as D & B & Route.ExtractBindings<I> & { format: "*" }, next),
      { format: "*" },
    )

    return Route.set<D, B, [...I, Route.Route<{ format: "*" }, {}, A, E, R>]>(
      [...Route.items(self), route],
      Route.descriptor(self),
    )
  }
}
