import * as Function from "effect/Function"
import * as Types from "effect/Types"
import * as Route from "./Route.ts"

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
      self: RouteMount.Builder<{}, RouteMount.BuilderBindings<Self>, []>,
    ) => Route.RouteSet.Any),
) {
  const baseItems = Route.isRouteSet(this)
    ? Route.items(this)
    : [] as const

  const routeSet = typeof routes === "function"
    ? routes(make<{}, RouteMount.BuilderBindings<Self>, []>([]))
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
  B = {},
  I extends Route.RouteSet.Tuple<{ method: string; path?: string }> = [],
>(
  items: I,
): RouteMount.Builder<D, B, I> {
  return Object.assign(
    Object.create(Proto),
    {
      [Route.RouteItems]: items,
      [Route.RouteDescriptor]: {},
    },
  )
}

type Method<V extends RouteMount.HttpMethod> = {
  method: V
}

function makeMethodDescriber<M extends RouteMount.HttpMethod>(
  method: M,
): RouteMount.Describer<M> {
  function describeMethod(
    this: Self,
    ...fs: ((self: Route.RouteSet.Any) => Route.RouteSet.Any)[]
  ): Route.RouteSet.Any {
    const baseItems = Route.isRouteSet(this)
      ? Route.items(this)
      : [] as const

    const methodSet = Route.set<Method<M>, []>([], { method })
    const f = Function.flow(
      ...fs as [(_: Route.RouteSet.Any) => Route.RouteSet.Any],
    )
    const result = f(methodSet)
    const resultItems = Route.items(result)

    if (method === "*" && baseItems.length > 0) {
      const lastItem = baseItems[baseItems.length - 1]
      const lastDescriptor = Route.descriptor(lastItem) as { method?: string }

      if (lastDescriptor?.method === "*") {
        const mergedItems = [
          ...Route.items(lastItem),
          ...resultItems,
        ]
        const mergedSet = Route.set(mergedItems, { method: "*" })

        return make([
          ...baseItems.slice(0, -1),
          mergedSet,
        ] as any)
      }
    }

    const wrappedResult = Route.set(
      resultItems as Route.RouteSet.Tuple,
      { method },
    )

    return make(
      [
        ...baseItems,
        wrappedResult,
      ],
    )
  }
  return describeMethod as RouteMount.Describer<M>
}

export namespace RouteMount {
  export type HttpMethod =
    | "*"
    | "GET"
    | "POST"
    | "PUT"
    | "DELETE"
    | "PATCH"
    | "HEAD"
    | "OPTIONS"

  export type MountSet = Route.RouteSet.RouteSet<
    Method<HttpMethod>,
    {},
    Route.RouteSet.Tuple
  >

  export interface Builder<
    D extends {} = {},
    B = {},
    I extends Route.RouteSet.Tuple = [],
  > extends Route.RouteSet.RouteSet<D, B, I>, Module {
  }

  export type EmptySet<
    M extends HttpMethod,
    B = {},
  > = Route.RouteSet.RouteSet<
    Method<M>,
    B,
    []
  >

  export type Items<S> = S extends Builder<any, any, infer I> ? I : []

  export type BuilderBindings<S> = S extends Builder<any, infer B, infer I>
    ? Types.Simplify<B & WildcardBindings<I>>
    : {}

  type WildcardBindingsItem<T> = T extends
    Route.RouteSet.RouteSet<
      Method<"*">,
      any,
      infer IAny extends Route.RouteSet.Tuple
    > ? Route.ExtractBindings<IAny>
    : {}

  type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends
    (k: infer I) => void ? I : never

  export type WildcardBindings<I extends Route.RouteSet.Tuple> =
    UnionToIntersection<
      {
        [K in keyof I]: WildcardBindingsItem<I[K]>
      }[number]
    >

  export type AccumulateBindings<
    M extends HttpMethod,
    Prev,
    New,
  > = M extends "*" ? Prev & New : Prev

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
    : T extends Route.RouteSet.RouteSet<infer D, infer B, infer Items>
      ? D extends { path: infer P extends string } ? Route.RouteSet.RouteSet<
          Omit<D, "path"> & { path: `${Prefix}${P}` },
          B,
          Items
        >
      : Route.RouteSet.RouteSet<D & { path: Prefix }, B, Items>
    : T

  export type PrefixPath<
    Prefix extends string,
    I extends Route.RouteSet.Tuple,
  > = {
    [K in keyof I]: PrefixPathItem<Prefix, I[K]>
  } extends infer R extends Route.RouteSet.Tuple ? R : never

  export interface Add {
    <S extends Self, P extends string, R extends Route.RouteSet.Any>(
      this: S,
      path: P,
      routes: R,
    ): Builder<
      {},
      BuilderBindings<S>,
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
      routes: (self: Builder<{}, BuilderBindings<S>, []>) => R,
    ): Builder<
      {},
      BuilderBindings<S>,
      [
        ...Items<S>,
        ...PrefixPath<P, Route.RouteSet.Items<R>>,
      ]
    >
  }

  export interface Describer<M extends HttpMethod> {
    <S extends Self, A extends Route.RouteSet.Any>(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
    ): Builder<
      {},
      Types.Simplify<
        AccumulateBindings<
          M,
          BuilderBindings<S>,
          Route.ExtractBindings<Route.RouteSet.Items<A>>
        >
      >,
      [
        ...Items<S>,
        Route.RouteSet.RouteSet<
          Method<M>,
          BuilderBindings<S>,
          Route.RouteSet.Items<A>
        >,
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
      Types.Simplify<
        AccumulateBindings<
          M,
          BuilderBindings<S>,
          Route.ExtractBindings<Route.RouteSet.Items<B>>
        >
      >,
      [
        ...Items<S>,
        Route.RouteSet.RouteSet<
          Method<M>,
          BuilderBindings<S>,
          Route.RouteSet.Items<B>
        >,
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
      Types.Simplify<
        AccumulateBindings<
          M,
          BuilderBindings<S>,
          Route.ExtractBindings<Route.RouteSet.Items<C>>
        >
      >,
      [
        ...Items<S>,
        Route.RouteSet.RouteSet<
          Method<M>,
          BuilderBindings<S>,
          Route.RouteSet.Items<C>
        >,
      ]
    >
  }
}
