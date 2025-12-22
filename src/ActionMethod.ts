import * as Function from "effect/Function"
import * as Action from "./Action.ts"

const TypeId: unique symbol = Symbol.for("effect-start/ActionSet")

type Module = typeof import("./ActionMethod.ts")

export type Self =
  | ActionMethod.Builder
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
  *[Symbol.iterator](this: Action.ActionSet.Any) {
    for (const item of this[Action.ActionItems]) {
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
  M extends [...ActionMethod.MethodSet[]] = [],
>(
  items: M,
): ActionMethod.Builder<M> {
  return Object.assign(
    Object.create(Proto),
    {
      [Action.ActionItems]: items,
      [Action.ActionDescriptor]: {},
    },
  )
}

function makeMethodDescriber<Method extends ActionMethod.HttpMethod>(
  method: Method,
): ActionMethod.Describer<Method> {
  const fn = function(
    this: Self,
    ...fs: ((self: Action.ActionSet.Any) => Action.ActionSet.Any)[]
  ): Action.ActionSet.Any {
    const baseItems = Action.isActionSet(this)
      ? this[Action.ActionItems]
      : [] as const

    const methodSet = Action.set<{ method: Method }, []>([], { method })
    const f = Function.flow(
      ...fs as [(_: Action.ActionSet.Any) => Action.ActionSet.Any],
    )
    const result = f(methodSet)

    const wrappedResult = Action.set(
      Action.items(result) as Action.Actions,
      { method },
    )

    return makeMethodSet(
      [
        ...baseItems,
        wrappedResult,
      ] as [...ActionMethod.MethodSet[]],
    )
  }
  return fn as ActionMethod.Describer<Method>
}

export namespace ActionMethod {
  export type HttpMethod =
    | "GET"
    | "POST"
    | "PUT"
    | "DELETE"
    | "PATCH"
    | "HEAD"
    | "OPTIONS"

  export type MethodSet = Action.ActionSet.ActionSet<
    { method: HttpMethod },
    Action.Actions
  >

  export interface Builder<
    Items extends [...MethodSet[]] = [],
  > extends Action.ActionSet.ActionSet<{}, Items>, Module {
  }

  export type EmptySet<M extends HttpMethod> = Action.ActionSet.ActionSet<
    { method: M },
    []
  >

  type Items<S> = S extends Builder<infer I> ? I : []

  export interface Describer<Method extends HttpMethod> {
    <S extends Self, A extends Action.ActionSet.Any>(
      this: S,
      ab: (a: EmptySet<Method>) => A,
    ): Builder<[
      ...Items<S>,
      Action.ActionSet.ActionSet<{
        method: Method
      }, Action.ActionSet.Items<A>>,
    ]>

    <
      S extends Self,
      A extends Action.ActionSet.Any,
      B extends Action.ActionSet.Any,
    >(
      this: S,
      ab: (a: EmptySet<Method>) => A,
      bc: (b: A) => B,
    ): Builder<[
      ...Items<S>,
      Action.ActionSet.ActionSet<{ method: Method }, Action.ActionSet.Items<B>>,
    ]>

    <
      S extends Self,
      A extends Action.ActionSet.Any,
      B extends Action.ActionSet.Any,
      C extends Action.ActionSet.Any,
    >(
      this: S,
      ab: (a: EmptySet<Method>) => A,
      bc: (b: A) => B,
      cd: (c: B) => C,
    ): Builder<[
      ...Items<S>,
      Action.ActionSet.ActionSet<{ method: Method }, Action.ActionSet.Items<C>>,
    ]>
  }
}
