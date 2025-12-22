import * as Function from "effect/Function"
import * as Route from "./Route.ts"

const TypeId: unique symbol = Symbol.for("effect-start/RouteSet")

type Module = typeof import("./RouteMethod.ts")

export type Self =
  | RouteMethod.Builder
  | Module

export const get = makeMethodDescriber("GET")
export const post = makeMethodDescriber("POST")
export const put = makeMethodDescriber("PUT")
export const del = makeMethodDescriber("DELETE")
export const patch = makeMethodDescriber("PATCH")
export const head = makeMethodDescriber("HEAD")
export const options = makeMethodDescriber("OPTIONS")

const Proto = {
  [TypeId]: TypeId,
  *[Symbol.iterator](this: Route.RouteSet.Any) {
    for (const item of this[Route.RouteItems]) {
      yield* item
    }
  },
  get,
  post,
  put,
  del,
  patch,
  head,
  options,
}

function makeMethodSet<
  M extends [...RouteMethod.MethodSet[]] = [],
>(
  items: M,
): RouteMethod.Builder<M> {
  return Object.assign(
    Object.create(Proto),
    {
      [Route.RouteItems]: items,
      [Route.RouteDescriptor]: {},
    },
  )
}

function makeMethodDescriber<Method extends RouteMethod.HttpMethod>(
  method: Method,
): RouteMethod.Describer<Method> {
  const fn = function(
    this: Self,
    ...fs: ((self: Route.RouteSet.Any) => Route.RouteSet.Any)[]
  ): Route.RouteSet.Any {
    const baseItems = Route.isRouteSet(this)
      ? this[Route.RouteItems]
      : [] as const

    const methodSet = Route.set<{ method: Method }, []>([], { method })
    const f = Function.flow(
      ...fs as [(_: Route.RouteSet.Any) => Route.RouteSet.Any],
    )
    const result = f(methodSet)

    const wrappedResult = Route.set(
      Route.items(result) as Route.Routes,
      { method },
    )

    return makeMethodSet(
      [
        ...baseItems,
        wrappedResult,
      ] as [...RouteMethod.MethodSet[]],
    )
  }
  return fn as RouteMethod.Describer<Method>
}

export namespace RouteMethod {
  export type HttpMethod =
    | "GET"
    | "POST"
    | "PUT"
    | "DELETE"
    | "PATCH"
    | "HEAD"
    | "OPTIONS"

  export type MethodSet = Route.RouteSet.RouteSet<
    { method: HttpMethod },
    Route.Routes
  >

  export interface Builder<
    Items extends [...MethodSet[]] = [],
  > extends Route.RouteSet.RouteSet<{}, Items>, Module {
  }

  export type EmptySet<M extends HttpMethod> = Route.RouteSet.RouteSet<
    { method: M },
    []
  >

  type Items<S> = S extends Builder<infer I> ? I : []

  export interface Describer<Method extends HttpMethod> {
    <S extends Self, A extends Route.RouteSet.Any>(
      this: S,
      ab: (a: EmptySet<Method>) => A,
    ): Builder<[
      ...Items<S>,
      Route.RouteSet.RouteSet<{
        method: Method
      }, Route.RouteSet.Items<A>>,
    ]>

    <
      S extends Self,
      A extends Route.RouteSet.Any,
      B extends Route.RouteSet.Any,
    >(
      this: S,
      ab: (a: EmptySet<Method>) => A,
      bc: (b: A) => B,
    ): Builder<[
      ...Items<S>,
      Route.RouteSet.RouteSet<{ method: Method }, Route.RouteSet.Items<B>>,
    ]>

    <
      S extends Self,
      A extends Route.RouteSet.Any,
      B extends Route.RouteSet.Any,
      C extends Route.RouteSet.Any,
    >(
      this: S,
      ab: (a: EmptySet<Method>) => A,
      bc: (b: A) => B,
      cd: (c: B) => C,
    ): Builder<[
      ...Items<S>,
      Route.RouteSet.RouteSet<{ method: Method }, Route.RouteSet.Items<C>>,
    ]>
  }
}
