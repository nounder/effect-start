import * as Function from "effect/Function"
import type * as Types from "effect/Types"
import type * as Http from "./internal/Http.ts"
import type * as PathPattern from "./internal/PathPattern.ts"
import * as Route from "./Route.ts"
import type * as RouteBody from "./RouteBody.ts"

const RouteSetTypeId = "~effect-start/RouteSet" as const

export type Self = Route.RouteSet.Any | typeof import("./RouteMount.ts")

export const use = makeMethodDescriber("*")
export const get = makeMethodDescriber("GET")
export const post = makeMethodDescriber("POST")
export const put = makeMethodDescriber("PUT")
export const del = makeMethodDescriber("DELETE")
export const patch = makeMethodDescriber("PATCH")
export const head = makeMethodDescriber("HEAD")
export const options = makeMethodDescriber("OPTIONS")

const Proto = Object.assign(Object.create(null), {
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
})

function make<
  D extends {} = {},
  I extends Route.Route.Tuple<{
    method: string
  }> = [],
>(items: I): RouteMount.Builder<D, I> {
  return Object.assign(Object.create(Proto), {
    [Route.RouteItems]: items,
    [Route.RouteDescriptor]: {},
  })
}

function makeMethodDescriber<M extends RouteMount.Method>(method: M): RouteMount.Describer<M> {
  function describeMethod(
    this: Self,
    ...fs: Array<(self: Route.RouteSet.Any) => Route.RouteSet.Any>
  ): Route.RouteSet.Any {
    const baseItems = Route.isRouteSet(this) ? Route.items(this) : ([] as const)

    const methodSet = Route.set<{ method: M }, []>([], { method })
    const f = Function.flow(...(fs as [(_: Route.RouteSet.Any) => Route.RouteSet.Any]))
    const result = f(methodSet)
    const resultItems = Route.items(result)

    // Items are already flat (only Routes), merge method into each descriptor
    const flattenedItems = resultItems.map((item) => {
      const itemDescriptor = Route.descriptor(item)
      const newDescriptor = { method, ...itemDescriptor }
      return Route.make(
        (item as Route.Route).handler as Route.Route.Handler<any, any, any, any>,
        newDescriptor,
      )
    })

    return make([...baseItems, ...flattenedItems] as any)
  }
  return describeMethod as RouteMount.Describer<M>
}

export type MountedRoute = Route.Route<
  {
    method: RouteMount.Method
    path: PathPattern.PathPattern
    format?: RouteBody.Format
  },
  {},
  any,
  any,
  any
>

export namespace RouteMount {
  export type Method = "*" | Http.Method

  export type MountSet = Route.RouteSet<{ method: Method }, {}, Route.Route.Tuple>

  export type Builder<D extends {} = {}, I extends Route.Route.Tuple = []> = Route.RouteSet<
    D,
    {},
    I
  > &
    (HasMethod<I> extends true ? {} : { use: Describer<"*"> }) & {
      get: Describer<"GET">
      post: Describer<"POST">
      put: Describer<"PUT">
      del: Describer<"DELETE">
      patch: Describer<"PATCH">
      head: Describer<"HEAD">
      options: Describer<"OPTIONS">
    }

  type HasMethod<I extends Route.Route.Tuple> = I extends [
    infer Head,
    ...infer Tail extends Route.Route.Tuple,
  ]
    ? Head extends Route.Route<{ method: infer M }, any, any, any, any>
      ? M extends Http.Method
        ? true
        : HasMethod<Tail>
      : HasMethod<Tail>
    : false

  export type EmptySet<M extends Method, B = {}> = Route.RouteSet<{ method: M }, B, []>

  export type Items<S> = S extends Builder<any, infer I> ? I : []

  export type BuilderBindings<S> =
    S extends Builder<any, infer I> ? Types.Simplify<WildcardBindings<I>> : {}

  type WildcardBindingsItem<T> =
    T extends Route.Route<{ method: "*" }, infer B, any, any, any> ? B : {}

  type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
    k: infer I,
  ) => void
    ? I
    : never

  export type WildcardBindings<I extends Route.Route.Tuple> = UnionToIntersection<
    {
      [K in keyof I]: WildcardBindingsItem<I[K]>
    }[number]
  >

  export type FlattenItems<M extends Method, I extends Route.Route.Tuple> = I extends [
    Route.Route<infer D, infer RB, infer A, infer E, infer R>,
    ...infer Tail extends Route.Route.Tuple,
  ]
    ? [Route.Route<Types.Simplify<{ method: M } & D> & {}, RB, A, E, R>, ...FlattenItems<M, Tail>]
    : []

  export interface Describer<M extends Method> {
    <S extends Self, A extends Route.RouteSet.Any>(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
    ): Builder<{}, [...Items<S>, ...FlattenItems<M, Route.RouteSet.Items<A>>]>

    <S extends Self, A extends Route.RouteSet.Any, B extends Route.RouteSet.Any>(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
      bc: (b: A) => B,
    ): Builder<{}, [...Items<S>, ...FlattenItems<M, Route.RouteSet.Items<B>>]>

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
    ): Builder<{}, [...Items<S>, ...FlattenItems<M, Route.RouteSet.Items<C>>]>

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
    ): Builder<{}, [...Items<S>, ...FlattenItems<M, Route.RouteSet.Items<D>>]>

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
    ): Builder<{}, [...Items<S>, ...FlattenItems<M, Route.RouteSet.Items<E>>]>

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
    ): Builder<{}, [...Items<S>, ...FlattenItems<M, Route.RouteSet.Items<F>>]>

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
    ): Builder<{}, [...Items<S>, ...FlattenItems<M, Route.RouteSet.Items<G>>]>

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
    ): Builder<{}, [...Items<S>, ...FlattenItems<M, Route.RouteSet.Items<H>>]>

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
    ): Builder<{}, [...Items<S>, ...FlattenItems<M, Route.RouteSet.Items<I>>]>
  }
}
