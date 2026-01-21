import * as Function from "effect/Function"
import * as Types from "effect/Types"
import * as Http from "./Http.ts"
import * as PathPattern from "./PathPattern.ts"
import * as Route from "./Route.ts"
import * as RouteBody from "./RouteBody.ts"

const RouteSetTypeId: unique symbol = Symbol.for("effect-start/RouteSet")

type Module = typeof import("./RouteMount.ts")

export type Self =
  | RouteMount.Builder
  | Module

export const use = makeMethodDescriber("*")
export const get = makeMethodDescriber("GET")
export const post = makeMethodDescriber("POST")
export const put = makeMethodDescriber("PUT")
export const del = makeMethodDescriber("DELETE")
export const patch = makeMethodDescriber("PATCH")
export const head = makeMethodDescriber("HEAD")
export const options = makeMethodDescriber("OPTIONS")

export const add: RouteMount.Add = function(
  this: Self,
  path: string,
  routes:
    | Route.RouteSet.Any
    | ((
      self: RouteMount.Builder<{}, []>,
    ) => Route.RouteSet.Any),
) {
  const baseItems = Route.isRouteSet(this)
    ? Route.items(this)
    : [] as const

  const routeSet = typeof routes === "function"
    ? routes(make<{}, []>([]))
    : routes
  const routeItems = Route.items(routeSet)
  const newItems = routeItems.map((item) => {
    const itemDescriptor = Route.descriptor(item) as { path?: string }
    const concatenatedPath = typeof itemDescriptor?.path === "string"
      ? path + itemDescriptor.path
      : path
    const newDescriptor = { ...itemDescriptor, path: concatenatedPath }
    return Route.isRoute(item)
      ? Route.make(
        item.handler as Route.Route.Handler<any, any, any, any>,
        newDescriptor,
      )
      : Route.set(Route.items(item), newDescriptor)
  })

  return make([
    ...baseItems,
    ...newItems,
  ] as any)
}

const Proto = Object.assign(
  Object.create(null),
  {
    [RouteSetTypeId]: RouteSetTypeId,
    *[Symbol.iterator](this: Route.RouteSet.Any) {
      yield* Route.items(this)
    },
    use,
    get,
    post,
    put,
    del,
    patch,
    head,
    options,
    add,
  },
)

function make<
  D extends {} = {},
  I extends Route.Route.Tuple<{
    method: string
  }> = [],
>(
  items: I,
): RouteMount.Builder<D, I> {
  return Object.assign(
    Object.create(Proto),
    {
      [Route.RouteItems]: items,
      [Route.RouteDescriptor]: {},
    },
  )
}

function makeMethodDescriber<M extends RouteMount.Method>(
  method: M,
): RouteMount.Describer<M> {
  function describeMethod(
    this: Self,
    ...fs: ((self: Route.RouteSet.Any) => Route.RouteSet.Any)[]
  ): Route.RouteSet.Any {
    const baseItems = Route.isRouteSet(this)
      ? Route.items(this)
      : [] as const

    const methodSet = Route.set<{ method: M }, []>([], { method })
    const f = Function.flow(
      ...fs as [(_: Route.RouteSet.Any) => Route.RouteSet.Any],
    )
    const result = f(methodSet)
    const resultItems = Route.items(result)

    // Items are already flat (only Routes), just merge method into each descriptor
    const flattenedItems = resultItems.map((item) => {
      const itemDescriptor = Route.descriptor(item)
      const newDescriptor = { method, ...itemDescriptor }
      return Route.make(
        (item as Route.Route.Route).handler as Route.Route.Handler<
          any,
          any,
          any,
          any
        >,
        newDescriptor,
      )
    })

    return make(
      [
        ...baseItems,
        ...flattenedItems,
      ] as any,
    )
  }
  return describeMethod as RouteMount.Describer<M>
}

export type MountedRoute = Route.Route.Route<
  {
    method: RouteMount.Method
    path: PathPattern.PathPattern
    format?: string
  },
  {},
  any,
  any,
  any
>

export namespace RouteMount {
  export type Method =
    | "*"
    | Http.Method

  export type MountSet = Route.RouteSet.RouteSet<
    { method: Method },
    {},
    Route.Route.Tuple
  >

  export interface Builder<
    D extends {} = {},
    I extends Route.Route.Tuple = [],
  > extends Route.RouteSet.RouteSet<D, {}, I>, Module {
  }

  export type EmptySet<
    M extends Method,
    B = {},
  > = Route.RouteSet.RouteSet<
    { method: M },
    B,
    []
  >

  export type Items<S> = S extends Builder<any, infer I> ? I : []

  export type BuilderBindings<S> = S extends Builder<any, infer I>
    ? Types.Simplify<WildcardBindings<I>>
    : {}

  type WildcardBindingsItem<T> = T extends Route.Route.Route<
    { method: "*" },
    infer B,
    any,
    any,
    any
  > ? B
    : {}

  type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends
    (k: infer I) => void ? I : never

  export type WildcardBindings<I extends Route.Route.Tuple> =
    UnionToIntersection<
      {
        [K in keyof I]: WildcardBindingsItem<I[K]>
      }[number]
    >

  type PrefixPathItem<Prefix extends string, T> = T extends
    Route.Route.Route<infer D, infer B, infer A, infer E, infer R>
    ? D extends { path: infer P extends string } ? Route.Route.Route<
        Omit<D, "path"> & { path: `${Prefix}${P}` },
        B,
        A,
        E,
        R
      >
    : Route.Route.Route<D & { path: Prefix }, B, A, E, R>
    : T

  export type PrefixPath<
    Prefix extends string,
    I extends Route.Route.Tuple,
  > = {
    [K in keyof I]: PrefixPathItem<Prefix, I[K]>
  } extends infer R extends Route.Route.Tuple ? R : never

  export interface Add {
    <S extends Self, P extends string, R extends Route.RouteSet.Any>(
      this: S,
      path: P,
      routes: R,
    ): Builder<
      {},
      [
        ...Items<S>,
        ...PrefixPath<P, Route.RouteSet.Items<R>>,
      ]
    >

    <S extends Self, P extends string, R extends Route.RouteSet.Any>(
      this: S,
      path: P,
      /**
       * Callback form provides a builder seeded with higher-level bindings so
       * nested routes can type-infer outer context when mounting.
       */
      routes: (self: Builder<{}, []>) => R,
    ): Builder<
      {},
      [
        ...Items<S>,
        ...PrefixPath<P, Route.RouteSet.Items<R>>,
      ]
    >
  }

  // Flatten items: merge method into descriptor and accumulate bindings through the chain
  export type FlattenItems<
    M extends Method,
    B,
    I extends Route.Route.Tuple,
  > = I extends [
    Route.Route.Route<infer D, infer RB, infer A, infer E, infer R>,
    ...infer Tail extends Route.Route.Tuple,
  ] ? [
      Route.Route.Route<{ method: M } & D, B & RB, A, E, R>,
      ...FlattenItems<M, B & RB, Tail>,
    ]
    : []

  export interface Describer<M extends Method> {
    <S extends Self, A extends Route.RouteSet.Any>(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
    ): Builder<
      {},
      [
        ...Items<S>,
        ...FlattenItems<M, BuilderBindings<S>, Route.RouteSet.Items<A>>,
      ]
    >

    <
      S extends Self,
      A extends Route.RouteSet.Any,
      B extends Route.RouteSet.Any,
    >(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
      bc: (b: A) => B,
    ): Builder<
      {},
      [
        ...Items<S>,
        ...FlattenItems<M, BuilderBindings<S>, Route.RouteSet.Items<B>>,
      ]
    >

    <
      S extends Self,
      A extends Route.RouteSet.Any,
      B extends Route.RouteSet.Any,
      C extends Route.RouteSet.Any,
    >(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
      bc: (b: A) => B,
      cd: (c: B) => C,
    ): Builder<
      {},
      [
        ...Items<S>,
        ...FlattenItems<M, BuilderBindings<S>, Route.RouteSet.Items<C>>,
      ]
    >

    <
      S extends Self,
      A extends Route.RouteSet.Any,
      B extends Route.RouteSet.Any,
      C extends Route.RouteSet.Any,
      D extends Route.RouteSet.Any,
    >(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
      bc: (b: A) => B,
      cd: (c: B) => C,
      de: (d: C) => D,
    ): Builder<
      {},
      [
        ...Items<S>,
        ...FlattenItems<M, BuilderBindings<S>, Route.RouteSet.Items<D>>,
      ]
    >

    <
      S extends Self,
      A extends Route.RouteSet.Any,
      B extends Route.RouteSet.Any,
      C extends Route.RouteSet.Any,
      D extends Route.RouteSet.Any,
      E extends Route.RouteSet.Any,
    >(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
      bc: (b: A) => B,
      cd: (c: B) => C,
      de: (d: C) => D,
      ef: (e: D) => E,
    ): Builder<
      {},
      [
        ...Items<S>,
        ...FlattenItems<M, BuilderBindings<S>, Route.RouteSet.Items<E>>,
      ]
    >

    <
      S extends Self,
      A extends Route.RouteSet.Any,
      B extends Route.RouteSet.Any,
      C extends Route.RouteSet.Any,
      D extends Route.RouteSet.Any,
      E extends Route.RouteSet.Any,
      F extends Route.RouteSet.Any,
    >(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
      bc: (b: A) => B,
      cd: (c: B) => C,
      de: (d: C) => D,
      ef: (e: D) => E,
      fg: (f: E) => F,
    ): Builder<
      {},
      [
        ...Items<S>,
        ...FlattenItems<M, BuilderBindings<S>, Route.RouteSet.Items<F>>,
      ]
    >

    <
      S extends Self,
      A extends Route.RouteSet.Any,
      B extends Route.RouteSet.Any,
      C extends Route.RouteSet.Any,
      D extends Route.RouteSet.Any,
      E extends Route.RouteSet.Any,
      F extends Route.RouteSet.Any,
      G extends Route.RouteSet.Any,
    >(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
      bc: (b: A) => B,
      cd: (c: B) => C,
      de: (d: C) => D,
      ef: (e: D) => E,
      fg: (f: E) => F,
      gh: (g: F) => G,
    ): Builder<
      {},
      [
        ...Items<S>,
        ...FlattenItems<M, BuilderBindings<S>, Route.RouteSet.Items<G>>,
      ]
    >

    <
      S extends Self,
      A extends Route.RouteSet.Any,
      B extends Route.RouteSet.Any,
      C extends Route.RouteSet.Any,
      D extends Route.RouteSet.Any,
      E extends Route.RouteSet.Any,
      F extends Route.RouteSet.Any,
      G extends Route.RouteSet.Any,
      H extends Route.RouteSet.Any,
    >(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
      bc: (b: A) => B,
      cd: (c: B) => C,
      de: (d: C) => D,
      ef: (e: D) => E,
      fg: (f: E) => F,
      gh: (g: F) => G,
      hi: (h: G) => H,
    ): Builder<
      {},
      [
        ...Items<S>,
        ...FlattenItems<M, BuilderBindings<S>, Route.RouteSet.Items<H>>,
      ]
    >

    <
      S extends Self,
      A extends Route.RouteSet.Any,
      B extends Route.RouteSet.Any,
      C extends Route.RouteSet.Any,
      D extends Route.RouteSet.Any,
      E extends Route.RouteSet.Any,
      F extends Route.RouteSet.Any,
      G extends Route.RouteSet.Any,
      H extends Route.RouteSet.Any,
      I extends Route.RouteSet.Any,
    >(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
      bc: (b: A) => B,
      cd: (c: B) => C,
      de: (d: C) => D,
      ef: (e: D) => E,
      fg: (f: E) => F,
      gh: (g: F) => G,
      hi: (h: G) => H,
      ij: (i: H) => I,
    ): Builder<
      {},
      [
        ...Items<S>,
        ...FlattenItems<M, BuilderBindings<S>, Route.RouteSet.Items<I>>,
      ]
    >
  }
}
