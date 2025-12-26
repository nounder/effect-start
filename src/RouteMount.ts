import * as Function from "effect/Function"
import * as Route from "./Route.ts"

const TypeId: unique symbol = Symbol.for("effect-start/RouteSet")

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

const Proto = Object.assign(
  Object.create(null),
  {
    [TypeId]: TypeId,
    *[Symbol.iterator](this: Route.RouteSet.Any) {
      for (const item of Route.items(this)) {
        yield* item
      }
    },
    use,
    get,
    post,
    put,
    del,
    patch,
    head,
    options,
  },
)

function make<
  D extends {} = {},
  B = {},
  I extends [...RouteMount.MountSet[]] = [],
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
  const fn = function(
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

    const wrappedResult = Route.set(
      Route.items(result) as Route.RouteSet.Tuple,
      { method },
    )

    return make(
      [
        ...baseItems,
        wrappedResult,
      ] as [...RouteMount.MountSet[]],
    )
  }
  return fn as RouteMount.Describer<M>
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
    Items extends [...MountSet[]] = [],
  > extends Route.RouteSet.RouteSet<D, B, Items>, Module {
  }

  export type EmptySet<
    M extends HttpMethod,
    B = {},
  > = Route.RouteSet.RouteSet<
    Method<M>,
    {},
    keyof B extends never ? [] : [Route.Route.Route<{}, B & {}, void>]
  >

  export type Items<S> = S extends Builder<any, any, infer I> ? I : []

  export type BuilderBindings<S> = S extends
    Route.RouteSet.Data<any, infer B, any> ? B : {}

  export interface Describer<M extends HttpMethod> {
    <S extends Self, A extends Route.RouteSet.Any>(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
    ): Builder<
      {},
      BuilderBindings<S> & Route.ExtractBindings<Route.RouteSet.Items<A>>,
      [
        ...Items<S>,
        Route.RouteSet.RouteSet<Method<M>, {}, Route.RouteSet.Items<A>>,
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
      BuilderBindings<S> & Route.ExtractBindings<Route.RouteSet.Items<B>>,
      [
        ...Items<S>,
        Route.RouteSet.RouteSet<Method<M>, {}, Route.RouteSet.Items<B>>,
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
      BuilderBindings<S> & Route.ExtractBindings<Route.RouteSet.Items<C>>,
      [
        ...Items<S>,
        Route.RouteSet.RouteSet<Method<M>, {}, Route.RouteSet.Items<C>>,
      ]
    >
  }
}
