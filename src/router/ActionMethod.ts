import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Pipeable from "effect/Pipeable"
import * as Action from "./Action.ts"

const TypeId: unique symbol = Symbol.for("effect-start/ActionSet")

type Builder = typeof import("./ActionMethod.ts")

export type Self =
  | Action.ActionSet.Any
  | Builder
  | undefined

export const get = make("GET")
export const post = make("POST")

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
  *[Symbol.iterator](this: Action.ActionSet.Any) {
    for (const item of this[Action.ActionItems]) {
      yield* item
    }
  },
  get,
  post,
}

function makeActionMethod<M extends Action.Actions>(
  items: M,
  descriptor: Action.ActionDescriptor.Method,
): Action.ActionSet.ActionSet<M> {
  return Object.assign(
    Object.create(Proto),
    {
      [Action.ActionItems]: items,
      [Action.ActionDescriptor]: descriptor,
    },
  ) as Action.ActionSet.ActionSet<M>
}

type MethodActionSet<Method extends string> = Action.ActionSet.ActionSet<
  readonly [
    Action.Action.Action<
      Action.ActionHandler<void, never, never>,
      { method: Method }
    >,
  ]
>

interface ActionMethodBuilder<
  Actions extends ReadonlyArray<Action.Action>,
> extends Action.ActionSet.ActionSet<Actions> {
  get: typeof get
  post: typeof post
}

type MethodResult<
  S extends Self,
  R extends Action.ActionSet.Any,
> = S extends Action.ActionSet.Any ? ActionMethodBuilder<
    [...Action.ActionSet.Items<S>, ...Action.ActionSet.Items<R>]
  >
  : ActionMethodBuilder<Action.ActionSet.Items<R>>

function make<Method extends "GET" | "POST">(method: Method): MethodFn<Method> {
  const fn = function(
    this: Self,
    ...fs: ReadonlyArray<(self: Action.ActionSet.Any) => Action.ActionSet.Any>
  ): Action.ActionSet.Any {
    const baseItems = Action.isActionSet(this)
      ? this[Action.ActionItems]
      : [] as const

    const methodAction = Action.make<
      Action.ActionHandler<void, never, never>,
      { method: Method }
    >(() => Effect.void)
    const set = Action.set([methodAction] as const)
    const f = Function.flow(
      ...fs as [(_: Action.ActionSet.Any) => Action.ActionSet.Any],
    )
    const result = f(set)

    return makeActionMethod(
      [
        ...baseItems,
        ...Action.items(result),
      ] as Action.Actions,
      {
        method,
      },
    )
  }
  return fn as MethodFn<Method>
}

interface MethodFn<
  Method extends string,
  V extends Action.ActionSet.Any = Action.ActionSet.Any,
> {
  <S extends Self, A extends V>(
    this: S,
    ab: (a: MethodActionSet<Method>) => A,
  ): MethodResult<S, A>

  <S extends Self, A extends V, B extends V>(
    this: S,
    ab: (a: MethodActionSet<Method>) => A,
    bc: (b: A) => B,
  ): MethodResult<S, B>

  <S extends Self, A extends V, B extends V, C extends V>(
    this: S,
    ab: (a: MethodActionSet<Method>) => A,
    bc: (b: A) => B,
    cd: (c: B) => C,
  ): MethodResult<S, C>

  <S extends Self, A extends V, B extends V, C extends V, D extends V>(
    this: S,
    ab: (a: MethodActionSet<Method>) => A,
    bc: (b: A) => B,
    cd: (c: B) => C,
    de: (d: C) => D,
  ): MethodResult<S, D>

  <
    S extends Self,
    A extends V,
    B extends V,
    C extends V,
    D extends V,
    E extends V,
  >(
    this: S,
    ab: (a: MethodActionSet<Method>) => A,
    bc: (b: A) => B,
    cd: (c: B) => C,
    de: (d: C) => D,
    ef: (e: D) => E,
  ): MethodResult<S, E>

  <
    S extends Self,
    A extends V,
    B extends V,
    C extends V,
    D extends V,
    E extends V,
    F extends V,
  >(
    this: S,
    ab: (a: MethodActionSet<Method>) => A,
    bc: (b: A) => B,
    cd: (c: B) => C,
    de: (d: C) => D,
    ef: (e: D) => E,
    fg: (f: E) => F,
  ): MethodResult<S, F>

  <
    S extends Self,
    A extends V,
    B extends V,
    C extends V,
    D extends V,
    E extends V,
    F extends V,
    G extends V,
  >(
    this: S,
    ab: (a: MethodActionSet<Method>) => A,
    bc: (b: A) => B,
    cd: (c: B) => C,
    de: (d: C) => D,
    ef: (e: D) => E,
    fg: (f: E) => F,
    gh: (g: F) => G,
  ): MethodResult<S, G>

  <
    S extends Self,
    A extends V,
    B extends V,
    C extends V,
    D extends V,
    E extends V,
    F extends V,
    G extends V,
    H extends V,
  >(
    this: S,
    ab: (a: MethodActionSet<Method>) => A,
    bc: (b: A) => B,
    cd: (c: B) => C,
    de: (d: C) => D,
    ef: (e: D) => E,
    fg: (f: E) => F,
    gh: (g: F) => G,
    hi: (h: G) => H,
  ): MethodResult<S, H>

  <
    S extends Self,
    A extends V,
    B extends V,
    C extends V,
    D extends V,
    E extends V,
    F extends V,
    G extends V,
    H extends V,
    I extends V,
  >(
    this: S,
    ab: (a: MethodActionSet<Method>) => A,
    bc: (b: A) => B,
    cd: (c: B) => C,
    de: (d: C) => D,
    ef: (e: D) => E,
    fg: (f: E) => F,
    gh: (g: F) => G,
    hi: (h: G) => H,
    ij: (i: H) => I,
  ): MethodResult<S, I>
}
