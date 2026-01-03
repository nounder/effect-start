import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as RouteBody from "./RouteBody.ts"
import * as Values from "./Values.ts"

export const RouteItems: unique symbol = Symbol()
export const RouteDescriptor: unique symbol = Symbol()
export const RouteBindings: unique symbol = Symbol()

export const TypeId: unique symbol = Symbol.for("effect-start/RouteSet")

export namespace RouteDescriptor {
  export type Any = {}
}

export namespace RouteSet {
  export type Tuple<
    D extends RouteDescriptor.Any = {},
  > = [
    ...RouteSet<D, {}, Tuple>[],
  ]

  export type RouteSet<
    D extends RouteDescriptor.Any = {},
    B = {},
    M extends Tuple = [],
  > =
    & Data<D, B, M>
    & {
      [TypeId]: typeof TypeId
    }
    & Pipeable.Pipeable
    & Iterable<Route.Route>

  export type Data<
    D extends RouteDescriptor.Any = {},
    B = {},
    M extends Tuple = [],
  > = {
    [RouteItems]: M
    [RouteDescriptor]: D
    [RouteBindings]: B
  }

  export type Proto =
    & Pipeable.Pipeable
    & Iterable<Route.Route>
    & {
      [TypeId]: typeof TypeId
    }

  export type Any = RouteSet<{}, {}, Tuple>

  export type Items<
    T extends Data<any, any, any>,
  > = T extends Data<
    any,
    any,
    infer M
  > ? M
    : never

  export type Descriptor<
    T extends Data<
      any,
      any,
      any
    >,
  > = T extends Data<
    any,
    any,
    infer M
  > ? _ExtractDescriptor<M>
    : never

  type _ExtractDescriptor<
    M extends Tuple,
  > = M extends [
    infer Head,
    ...infer Tail extends Tuple,
  ] ? (
      Head extends {
        handler: any
        [RouteDescriptor]: infer D
      } ?
          & D
          & _ExtractDescriptor<Tail>
        : Head extends {
          [RouteDescriptor]: infer D
          [RouteItems]: infer Nested extends Tuple
        } ?
            & D
            & _ExtractDescriptor<Nested>
            & _ExtractDescriptor<Tail>
        : _ExtractDescriptor<Tail>
    )
    : {}

  export type Bindings<
    T extends Data<any, any, any>,
  > = T extends Data<any, any, infer M> ? (
      _ExtractBindings<M>
    )
    : never

  type _ExtractBindings<
    M extends Tuple,
  > = M extends [
    infer Head,
    ...infer Tail extends Tuple,
  ] ? (
      Head extends Route.Route<
        any,
        infer B
      > ?
          | B
          | _ExtractBindings<Tail>
        : Head extends RouteSet<
          any,
          any,
          infer Nested
        > ?
            | _ExtractBindings<Nested>
            | _ExtractBindings<Tail>
        : _ExtractBindings<Tail>
    )
    : never
}

export namespace Route {
  export interface Route<
    D extends RouteDescriptor.Any = {},
    B = {},
    A = any,
    E = never,
    R = never,
  > extends
    RouteSet.RouteSet<D, {}, [
      Route<D, B, A>,
    ]>
  {
    readonly handler: Handler<B & D, A, E, R>
  }

  export type Handler<B, A, E, R> = (
    context: B,
    next: (context: B) => Effect.Effect<A>,
  ) => Effect.Effect<A, E, R>

  // handler that cannot modify the context
  export type HandlerImmutable<B, A, E, R> = (
    context: B,
    next: () => Effect.Effect<A>,
  ) => Effect.Effect<A, E, R>

  export type Bindings<T> = T extends RouteSet.RouteSet<
    infer D,
    any,
    infer Items
  > ? D & _ExtractBindings<Items>
    : never

  type _ExtractBindings<
    M extends RouteSet.Tuple,
  > = M extends [
    infer Head,
    ...infer Tail extends RouteSet.Tuple,
  ] ? (
      Head extends Route<
        infer D,
        infer B
      > ?
          & D
          & B
          & _ExtractBindings<Tail>
        : Head extends RouteSet.RouteSet<
          infer D,
          any,
          infer Nested
        > ?
            & D
            & _ExtractBindings<Nested>
            & _ExtractBindings<Tail>
        : _ExtractBindings<Tail>
    )
    : {}
}

const Proto: RouteSet.Proto = {
  [TypeId]: TypeId,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
  *[Symbol.iterator](this: RouteSet.Any) {
    for (const item of items(this)) {
      if (isRoute(item)) {
        yield item
      } else {
        yield* item as RouteSet.Any
      }
    }
  },
}

export function isRouteSet(
  input: unknown,
): input is RouteSet.Any {
  return Predicate.hasProperty(input, TypeId)
}

export function isRoute(
  input: unknown,
): input is Route.Route {
  return isRouteSet(input)
    && Predicate.hasProperty(input, "handler")
}

export function set<
  D extends RouteDescriptor.Any = {},
  B = {},
  I extends RouteSet.Tuple = [],
>(
  items: I = [] as unknown as I,
  descriptor: D = {} as D,
): RouteSet.RouteSet<D, B, I> {
  return Object.assign(
    Object.create(Proto),
    {
      [RouteItems]: items,
      [RouteDescriptor]: descriptor,
    },
  ) as RouteSet.RouteSet<D, B, I>
}

export function make<
  D extends RouteDescriptor.Any = {},
  B = {},
  A = any,
  E = never,
  R = never,
>(
  handler: Route.Handler<B & D, A, E, R>,
  descriptor?: D,
): Route.Route<D, B, A, E, R> {
  const items: any = []
  const route: Route.Route<D, B, A, E, R> = Object.assign(
    Object.create(Proto),
    {
      [RouteItems]: items,
      [RouteDescriptor]: descriptor,
      handler,
    },
  )

  items.push(route)

  return route
}

export const empty = set()

export function describe<
  D extends RouteDescriptor.Any,
>(
  descriptor: D,
) {
  return set([], descriptor)
}

export function items<
  T extends RouteSet.Data<any, any, any>,
>(
  self: T,
): RouteSet.Items<T> {
  return self[RouteItems]
}

export function descriptor<
  T extends RouteSet.Data<any, any, any>,
>(
  self: T,
): T[typeof RouteDescriptor] {
  return self[RouteDescriptor]
}

export type ExtractBindings<
  M extends RouteSet.Tuple,
> = M extends [
  infer Head,
  ...infer Tail extends RouteSet.Tuple,
] ? (
    Head extends Route.Route<
      any,
      infer B
    > ?
        & B
        & ExtractBindings<Tail>
      : Head extends RouteSet.RouteSet<
        any,
        infer B,
        infer Nested
      > ?
          & B
          & ExtractBindings<Nested>
          & ExtractBindings<Tail>
      : ExtractBindings<Tail>
  )
  : {}

export type ExtractContext<
  Items extends RouteSet.Tuple,
  Descriptor extends RouteDescriptor.Any,
> = ExtractBindings<Items> & Descriptor

export * from "./RouteHook.ts"
export * from "./RouteMount.ts"
export * from "./RouteSchema.ts"

export const text = RouteBody.build<string, "text">({
  format: "text",
})

export const html = RouteBody.build<string, "html">({
  format: "html",
})

export const json = RouteBody.build<Values.Json, "json">({
  format: "json",
})

export const bytes = RouteBody.build<Uint8Array, "bytes">({
  format: "bytes",
})
