import * as Function from "effect/Function"
import * as Types from "effect/Types"
import * as PathPattern from "./PathPattern.ts"
import * as Route from "./Route.ts"
import * as RouteBody from "./RouteBody.ts"

const TypeId: unique symbol = Symbol.for("effect-start/RouteMount")

const RouteSetTypeId: unique symbol = Symbol.for("effect-start/RouteSet")

// only for structural type matching
const BuilderMapping: unique symbol = Symbol()

type Module = typeof import("./RouteMount.ts")

export type Self =
  | RouteMount.Builder
  | Module

export type Routes<S> = S extends RouteMount.Builder<infer M, any> ? M : {}

export type BuilderBindings<S> = RouteMount.BuilderBindings<S>

export const use = makeMethodDescriber("*")
export const get = makeMethodDescriber("GET")
export const post = makeMethodDescriber("POST")
export const put = makeMethodDescriber("PUT")
export const del = makeMethodDescriber("DELETE")
export const patch = makeMethodDescriber("PATCH")
export const head = makeMethodDescriber("HEAD")
export const options = makeMethodDescriber("OPTIONS")

// interface breaks circular reference: add → RouteMount.Builder → Module → add
interface Add {
  <
    S extends Self,
    P extends PathPattern.PathPattern,
    R extends RouteMount.Builder<any, any>,
  >(
    this: S,
    path: P,
    routes: R,
  ): RouteMount.Builder<
    & Routes<S>
    & {
      [K in P]: Route.RouteSet.RouteSet<
        Method,
        {},
        Route.RouteSet.Tuple<RouteBody.Format>
      >
    },
    RouteMount.BuilderBindings<S>
  >
}

export const add: Add = function(
  this: Self,
  path: string,
  routes: Route.RouteSet.Any,
) {
  const baseItems = Route.isRouteSet(this)
    ? Route.items(this)
    : [] as const

  const routeSet = routes
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
    [TypeId]: TypeId,
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
  M extends {
    [path: PathPattern.PathPattern]: Route.RouteSet.RouteSet<
      Method,
      {},
      Route.RouteSet.Tuple<RouteBody.Format>
    >
  } = {},
  B = {},
>(
  items: Route.RouteSet.Tuple,
): RouteMount.Builder<M, B> {
  return Object.assign(
    Object.create(Proto),
    {
      [Route.RouteItems]: items,
      [Route.RouteDescriptor]: {},
    },
  )
}

// TODO: put it in RouteMount namespace
export type Method<V extends RouteMount.HttpMethod = RouteMount.HttpMethod> = {
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
    M extends {
      [path: PathPattern.PathPattern]: Route.RouteSet.RouteSet<
        Method,
        {},
        Route.RouteSet.Tuple<RouteBody.Format>
      >
    } = {},
    B = {},
  > extends
    Route.RouteSet.RouteSet<
      {},
      B,
      Route.RouteSet.Tuple<{
        method: HttpMethod
      }>
    >,
    Module
  {
    [TypeId]: typeof TypeId
    [BuilderMapping]: M
  }

  export type EmptySet<
    M extends HttpMethod,
    B = {},
  > = Route.RouteSet.RouteSet<
    Method<M>,
    B,
    []
  >

  export type RouteValues<S> = S extends Builder<infer M, any> ? M[keyof M]
    : never

  export type BuilderBindings<S> = S extends Builder<infer M, infer B>
    ? Types.Simplify<B & WildcardBindings<M>>
    : {}

  type WildcardBindingsItem<T> = T extends Route.RouteSet.RouteSet<
    Method<"*">,
    any,
    infer IAny extends Route.RouteSet.Tuple
  > ? Route.ExtractBindings<IAny>
    : {}

  type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends
    (k: infer I) => void ? I : never

  export type WildcardBindings<M extends Record<string, Route.RouteSet.Any>> =
    UnionToIntersection<
      {
        [K in keyof M]: WildcardBindingsItem<M[K]>
      }[keyof M]
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

  export interface Describer<M extends HttpMethod> {
    <S extends Self, A extends Route.RouteSet.Any>(
      this: S,
      ab: (a: EmptySet<M, BuilderBindings<S>>) => A,
    ): Builder<
      Routes<S>,
      Types.Simplify<
        AccumulateBindings<
          M,
          BuilderBindings<S>,
          Route.ExtractBindings<Route.RouteSet.Items<A>>
        >
      >
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
      Routes<S>,
      Types.Simplify<
        AccumulateBindings<
          M,
          BuilderBindings<S>,
          Route.ExtractBindings<Route.RouteSet.Items<B>>
        >
      >
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
      Routes<S>,
      Types.Simplify<
        AccumulateBindings<
          M,
          BuilderBindings<S>,
          Route.ExtractBindings<Route.RouteSet.Items<C>>
        >
      >
    >
  }
}
