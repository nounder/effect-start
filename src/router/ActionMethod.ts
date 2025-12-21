import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Action from "./Action.ts"

const TypeId: unique symbol = Symbol.for("effect-start/ActionSet")

type Builder = typeof import("./ActionMethod.ts")

export type Self =
  | Action.ActionSet.Any
  | Builder
  | undefined

export namespace ActionMethod {
  export interface ActionMethod<
    Actions extends ReadonlyArray<
      Action.Action.Action<any, any, any>
    >,
  > extends Action.ActionSet.ActionSet<Actions> {
    get: typeof get
    post: typeof post
  }

  export type Any = ActionMethod<Action.Actions>
}

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
): ActionMethod.ActionMethod<M> {
  return Object.assign(
    Object.create(Proto),
    {
      [Action.ActionItems]: items,
      [Action.ActionDescriptor]: descriptor,
    },
  ) as ActionMethod.ActionMethod<M>
}

function make<
  Method extends "GET" | "POST",
>(method: Method) {
  return function<
    S extends Self,
    R extends Action.ActionSet.Any,
  >(
    this: S,
    f: (
      self: Action.ActionSet.ActionSet<
        readonly [
          Action.Action.Action<
            Action.ActionHandler<void, never, never>,
            { method: Method }
          >,
        ]
      >,
    ) => R,
  ): S extends Action.ActionSet.Any ? ActionMethod.ActionMethod<
      readonly [
        ...Action.ActionSet.Items<S>,
        ...Action.ActionSet.Items<R>,
      ]
    >
    : ActionMethod.ActionMethod<Action.ActionSet.Items<R>>
  {
    const baseItems = Action.isActionSet(this)
      ? this[Action.ActionItems]
      : [] as const

    const methodAction = Action.make<
      Action.ActionHandler<void, never, never>,
      { method: Method }
    >(() => Effect.void)
    const set = Action.set([methodAction] as const)
    const result = f(set)

    return makeActionMethod(
      [
        ...baseItems,
        ...Action.items(result),
      ] as Action.Actions,
      {
        method,
      },
    ) as never
  }
}
