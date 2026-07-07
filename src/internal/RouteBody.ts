import * as Effect from "effect/Effect"
import type * as Stream from "effect/Stream"
import type * as Utils from "effect/Utils"
import * as Entity from "../Entity.ts"
import * as Route from "../Route.ts"
import * as StreamExtra from "./StreamExtra.ts"
import type * as Values from "./Values.ts"

type YieldError<T> = T extends Utils.YieldWrap<Effect.Effect<any, infer E, any>> ? E
  : never
type YieldContext<T> = T extends Utils.YieldWrap<Effect.Effect<any, any, infer R>> ? R
  : never

export type Format = "text" | "html" | "json" | "bytes" | "sse" | "*"

const formatToContentType: Record<Format, string | undefined> = {
  text: "text/plain; charset=utf-8",
  html: "text/html; charset=utf-8",
  json: "application/json",
  bytes: "application/octet-stream",
  sse: "text/event-stream",
  "*": undefined,
}

type HandlerReturn<A, Value = A> =
  | A
  | Entity.Entity<Value, any>
  | Entity.Entity<Stream.Stream<Value, any, any>, any>
  // support returing bytes from text/json/etc
  | Entity.Entity<Uint8Array, any>
  | ((self: Route.RouteSet.Any) => Route.RouteSet.Any)

type HandlerFunction<B, A, E, R, Value = A> = (
  context: Values.Simplify<B>,
  next: Entity.Entity<
    A extends Stream.Stream<infer V, any, any> ? V : A,
    never
  >,
) =>
  | Effect.Effect<HandlerReturn<A, Value>, E, R>
  | Generator<
    Utils.YieldWrap<Effect.Effect<unknown, E, R>>,
    HandlerReturn<A, Value>,
    unknown
  >

export type GeneratorHandler<B, A, Y, Value = A> = (
  context: Values.Simplify<B>,
  next: Entity.Entity<
    A extends Stream.Stream<infer V, any, any> ? V : A,
    never
  >,
) => Generator<Y, HandlerReturn<A, Value>, never>

export type HandlerInput<B, A, E, R, Value = A> =
  | A
  | Entity.Entity<Value, any>
  | Effect.Effect<HandlerReturn<A, Value>, E, R>
  | HandlerFunction<B, A, E, R, Value>

function isHandlerFunction<B, A, E, R, Value>(
  handler: HandlerInput<B, A, E, R, Value>,
): handler is HandlerFunction<B, A, E, R, Value> {
  return typeof handler === "function"
}

/** @internal */
export function normalize<
  B,
  A,
  Y extends Utils.YieldWrap<Effect.Effect<any, any, any>>,
  Value = A,
>(
  handler: GeneratorHandler<B, A, Y, Value>,
): Route.Route.Handler<B, A, YieldError<Y>, YieldContext<Y>>
/** @internal */
export function normalize<B, A, E, R, Value = A>(
  handler: HandlerInput<B, A, E, R, Value>,
): Route.Route.Handler<B, A, E, R>
export function normalize<B, A, E, R, Value = A>(
  handler: HandlerInput<B, A, E, R, Value>,
): Route.Route.Handler<B, A, E, R> {
  if (isHandlerFunction(handler)) {
    return ((context: any, next: any) => {
      const result = handler(context, next)
      const effect = Effect.isEffect(result)
        ? result
        : Effect.gen(function*() {
          return yield* result
        })
      return Effect.flatMap(effect, normalizeToEntity)
    }) as Route.Route.Handler<B, A, E, R>
  }
  if (Effect.isEffect(handler)) {
    return ((_context: any, _next: any) => Effect.flatMap(handler, normalizeToEntity)) as Route.Route.Handler<
      B,
      A,
      E,
      R
    >
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
    const result = (value as (self: Route.RouteSet.Any) => Route.RouteSet.Any)(
      Route.empty,
    )
    const routes = Route.items(result)
    const route = routes[0]
    if (route) {
      return route.handler({}, Entity.make("")) as Effect.Effect<
        Entity.Entity<any>
      >
    }
  }
  if (Entity.isEntity(value)) {
    return Effect.succeed(value)
  }
  return Effect.succeed(Entity.make(value, { status: 200 }))
}

export interface BuildReturn<Value, F extends Format, Body = never> {
  <
    D,
    B,
    I extends Route.Route.Tuple,
    A extends F extends "json" ? Value : Value | Stream.Stream<Value, any, any> = Value,
    Y extends Utils.YieldWrap<Effect.Effect<any, any, any>> = never,
  >(
    handler: GeneratorHandler<
      NoInfer<D & B & Route.ExtractBindings<I> & { format: F }>,
      A,
      Y,
      Value
    >,
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
    D,
    B,
    I extends Route.Route.Tuple,
    A extends F extends "json" ? Value : Value | Stream.Stream<Value, any, any> = Value,
    E = never,
    R = never,
  >(
    handler: HandlerInput<
      NoInfer<D & B & Route.ExtractBindings<I> & { format: F }>,
      A,
      E,
      R,
      Value
    >,
  ): (
    self: Route.RouteSet<D, B, I>,
  ) => Route.RouteSet<
    D,
    B,
    [
      ...I,
      Route.Route<{ format: F }, {}, [Body] extends [never] ? A : Body, E, R>,
    ]
  >
}

export function build<Value, F extends Format>(
  options: { format: F },
): BuildReturn<Value, F>
export function build<Value, Body, F extends Format>(options: {
  format: F
  handle: (body: Value) => Body
}): BuildReturn<Value, F, Body>
export function build<Value, F extends Format>(options: {
  format: F
  handle?: (body: any) => any
}): any {
  const { handle: handleBody, ...descriptors } = options
  return function<
    D,
    B,
    I extends Route.Route.Tuple,
    A extends F extends "json" ? Value : Value | Stream.Stream<Value, any, any>,
    E = never,
    R = never,
  >(
    handler: HandlerInput<
      NoInfer<D & B & Route.ExtractBindings<I> & { format: F }>,
      A,
      E,
      R,
      Value
    >,
  ) {
    return (self: Route.RouteSet<D, B, I>) => {
      const contentType = formatToContentType[descriptors.format]
      const baseHandler = normalize(handler)
      const wrappedHandler: Route.Route.Handler<{ format: F }, A, E, R> = (
        ctx,
        next,
      ) =>
        baseHandler(
          ctx as D & B & Route.ExtractBindings<I> & { format: F },
          next,
        )
          .pipe(
            Effect.map((entity) => {
              const body = handleBody && !StreamExtra.isStream(entity.body)
                ? handleBody(entity.body)
                : entity.body
              if (
                body === entity.body &&
                (entity.headers["content-type"] || contentType === undefined)
              ) {
                return entity
              }
              return Entity.make(body as A, {
                status: entity.status,
                url: entity.url,
                headers: entity
                    .headers["content-type"] || contentType === undefined
                  ? entity.headers
                  : { ...entity.headers, "content-type": contentType },
              })
            }),
          )

      const route = Route.make<{ format: F }, {}, A, E, R>(
        wrappedHandler,
        descriptors,
      )

      return Route.set<D, B, [...I, Route.Route<{ format: F }, {}, A, E, R>]>(
        [...Route.items(self), route],
        Route.descriptor(self),
      )
    }
  } as BuildReturn<Value, F>
}

export type RenderValue =
  | string
  | Uint8Array
  | Stream.Stream<string | Uint8Array, any, any>

export function handle<
  D extends {},
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
  self: Route.RouteSet<D, B, I>,
) => Route.RouteSet<
  D,
  B,
  [...I, Route.Route<{ format: "*" }, {}, A, YieldError<Y>, YieldContext<Y>>]
>
export function handle<
  D extends {},
  B extends {},
  I extends Route.Route.Tuple,
  A extends RenderValue,
  E = never,
  R = never,
>(
  handler: HandlerInput<
    NoInfer<D & B & Route.ExtractBindings<I> & { format: "*" }>,
    A,
    E,
    R
  >,
): (
  self: Route.RouteSet<D, B, I>,
) => Route.RouteSet<D, B, [...I, Route.Route<{ format: "*" }, {}, A, E, R>]>
export function handle<
  D extends {},
  B extends {},
  I extends Route.Route.Tuple,
  A extends RenderValue,
  E = never,
  R = never,
>(
  handler: HandlerInput<
    NoInfer<D & B & Route.ExtractBindings<I> & { format: "*" }>,
    A,
    E,
    R
  >,
) {
  return (self: Route.RouteSet<D, B, I>) => {
    const baseHandler = normalize(handler)
    const route = Route.make<{ format: "*" }, {}, A, E, R>(
      (ctx, next) =>
        baseHandler(
          ctx as D & B & Route.ExtractBindings<I> & { format: "*" },
          next,
        ),
      { format: "*" },
    )

    return Route.set<D, B, [...I, Route.Route<{ format: "*" }, {}, A, E, R>]>(
      [...Route.items(self), route],
      Route.descriptor(self),
    )
  }
}
