import * as Function from "effect/Function"
import * as Pipeable from "effect/Pipeable"
import * as Action from "./Action.ts"

const TypeId: unique symbol = Symbol.for("effect-start/ActionSet")

type Builder = typeof import("./ActionMethod.ts")

export type Self =
  | Action.ActionSet.Any
  | Builder
  | undefined

export const get = makeMethodDescriber("GET")
export const post = makeMethodDescriber("POST")

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

interface ActionMethodBuilder<
  Actions extends [...Action.Action[]],
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

function makeMethodDescriber<Method extends "GET" | "POST">(
  method: Method,
): ActionMethodDescriber<Method> {
  const fn = function(
    this: Self,
    ...fs: ((self: Action.ActionSet.Any) => Action.ActionSet.Any)[]
  ): Action.ActionSet.Any {
    const baseItems = Action.isActionSet(this)
      ? this[Action.ActionItems]
      : [] as const

    const methodSet = makeActionMethod([] as const, { method })
    const f = Function.flow(
      ...fs as [(_: Action.ActionSet.Any) => Action.ActionSet.Any],
    )
    const result = f(methodSet)

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
  return fn as ActionMethodDescriber<Method>
}

type ActionMethodDescriberResult<
  Items extends Action.Actions,
  Method extends string,
> =
  & Action.ActionSet.ActionSet<Items, { method: Method }>
  & {
    get: typeof get
    post: typeof post
  }

type MethodActionSet<M extends string> = Action.ActionSet.ActionSet<
  [],
  { method: M }
>

interface ActionMethodDescriber<Method extends string> {
  <S extends Self, A extends Action.ActionSet.Any>(
    this: S,
    ab: (a: MethodActionSet<Method>) => A,
  ): ActionMethodDescriberResult<Action.ActionSet.Items<MethodResult<S, A>>, Method>

  <
    S extends Self,
    A extends Action.ActionSet.Any,
    B extends Action.ActionSet.Any,
  >(
    this: S,
    ab: (a: MethodActionSet<Method>) => A,
    bc: (b: A) => B,
  ): ActionMethodDescriberResult<Action.ActionSet.Items<MethodResult<S, B>>, Method>

  <
    S extends Self,
    A extends Action.ActionSet.Any,
    B extends Action.ActionSet.Any,
    C extends Action.ActionSet.Any,
  >(
    this: S,
    ab: (a: MethodActionSet<Method>) => A,
    bc: (b: A) => B,
    cd: (c: B) => C,
  ): ActionMethodDescriberResult<Action.ActionSet.Items<MethodResult<S, C>>, Method>
}
