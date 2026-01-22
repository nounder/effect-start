import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as RouteBody from "./RouteBody.ts"
import * as RouteTree from "./RouteTree.ts"
import * as Values from "./Values.ts"

export const RouteItems: unique symbol = Symbol()
export const RouteDescriptor: unique symbol = Symbol()
// only for structural type matching
export const RouteBindings: unique symbol = Symbol()

export const TypeId: unique symbol = Symbol.for("effect-start/RouteSet")

export namespace RouteDescriptor {
  export type Any = {
    [key: string]: unknown
  }
}

export namespace RouteSet {
  export type RouteSet<
    D extends RouteDescriptor.Any = {},
    B = {},
    M extends Route.Tuple = [],
  > =
    & Data<D, B, M>
    & {
      [TypeId]: typeof TypeId
    }
    & Pipeable.Pipeable
    & Iterable<M[number]>

  export type Data<
    D extends RouteDescriptor.Any = {},
    B = {},
    M extends Route.Tuple = [],
  > = {
    [RouteItems]: M
    [RouteDescriptor]: D
    [RouteBindings]: B
  }

  export type Proto =
    & Pipeable.Pipeable
    & Iterable<Route.Route<any, any, any, any, any>>
    & {
      [TypeId]: typeof TypeId
    }

  export type Any = RouteSet<{}, {}, Route.Tuple>

  export type Infer<R> = R extends RouteSet<infer D, infer B, infer I>
    ? RouteSet<D, B, I>
    : R

  export type Items<
    T extends Data<any, any, any>,
  > = T extends Data<
    any,
    any,
    infer M
  > ? M
    : never

  export type Descriptor<
    T extends Data<any, any, any>,
  > = T extends Data<infer D, any, any> ? D : never
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
      Route<D, B, A, E, R>,
    ]>
  {
    readonly handler: Handler<B & D, A, E, R>
  }

  export type With<D extends RouteDescriptor.Any> =
    & Route<any, any, any, any, any>
    & {
      [RouteDescriptor]: D
    }

  export type Tuple<
    _D extends RouteDescriptor.Any = {},
  > = [
    ...Route<any, any, any, any, any>[],
  ]

  export type Handler<B, A, E, R> = (
    context: B,
    next: (context: B) => Effect.Effect<A>,
  ) => Effect.Effect<A, E, R>

  // handler that cannot modify the context
  export type HandlerImmutable<B, A, E, R> = (
    context: B,
    next: () => Effect.Effect<A>,
  ) => Effect.Effect<A, E, R>

  /**
   * Extracts only the bindings (B) from routes, excluding descriptors.
   */
  export type Bindings<
    T extends RouteSet.Any,
    M extends Tuple = RouteSet.Items<T>,
  > = M extends [
    infer Head,
    ...infer Tail extends Tuple,
  ] ? (
      Head extends Route<any, infer B, any, any, any>
        ? ShallowMerge<B, Bindings<T, Tail>>
        : Bindings<T, Tail>
    )
    : {}

  /**
   * Extracts the full handler context from a RouteSet.
   * Merges descriptors and bindings from all routes, with later values
   * taking precedence via ShallowMerge to avoid `never` from conflicting
   * literal types (e.g. `{ method: "*" } & { method: "GET" }`).
   */
  export type Context<T extends RouteSet.Any> =
    & Omit<
      RouteSet.Descriptor<T>,
      keyof ExtractContext<RouteSet.Items<T>>
    >
    & ExtractContext<RouteSet.Items<T>>

  type ExtractContext<
    M extends Tuple,
  > = M extends [
    infer Head,
    ...infer Tail extends Tuple,
  ] ? (
      Head extends Route<
        infer D,
        infer B,
        any,
        any,
        any
      > ? ShallowMerge<
          & Omit<D, keyof B>
          & B,
          ExtractContext<Tail>
        >
        : ExtractContext<Tail>
    )
    : {}
}

const Proto: RouteSet.Proto = {
  [TypeId]: TypeId,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
  *[Symbol.iterator](this: RouteSet.Any) {
    yield* items(this)
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
  I extends Route.Tuple = [],
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
  D extends RouteDescriptor.Any,
  B,
  A,
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
): T[typeof RouteDescriptor]
export function descriptor<
  T extends RouteSet.Data<any, any, any>,
>(
  self: Iterable<T>,
): T[typeof RouteDescriptor][]
export function descriptor(
  self:
    | RouteSet.Data<any, any, any>
    | Iterable<RouteSet.Data<any, any, any>>,
): RouteDescriptor.Any | RouteDescriptor.Any[] {
  if (RouteDescriptor in self) {
    return self[RouteDescriptor]
  }
  return [...self].map((r) => r[RouteDescriptor])
}

export type ExtractBindings<
  M extends Route.Tuple,
> = M extends [
  infer Head,
  ...infer Tail extends Route.Tuple,
] ? (
    Head extends Route.Route<
      any,
      infer B,
      any,
      any,
      any
    > ? ShallowMerge<B, ExtractBindings<Tail>>
      : ExtractBindings<Tail>
  )
  : {}

// Shallow merge two object types.
// For overlapping keys, intersect the values.
type ShallowMerge<A, B> =
  & Omit<A, keyof B>
  & {
    [K in keyof B]: K extends keyof A ? A[K] & B[K] : B[K]
  }

export type ExtractContext<
  Items extends Route.Tuple,
  Descriptor extends RouteDescriptor.Any,
> = ExtractBindings<Items> & Descriptor

export * from "./RouteHook.ts"
export * from "./RouteSchema.ts"

export {
  add,
  del,
  get,
  head,
  options,
  patch,
  post,
  put,
  use,
} from "./RouteMount.ts"

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

export class Routes extends Context.Tag("effect-start/Routes")<
  Routes,
  RouteTree.RouteTree
>() {}

export function layer(routes: RouteTree.RouteMap | RouteTree.RouteTree) {
  return Layer.sync(
    Routes,
    () =>
      RouteTree.isRouteTree(routes)
        ? routes
        : RouteTree.make(routes),
  )
}

export {
  make as tree,
} from "./RouteTree.ts"
