import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

type HttpMethod =
  | "GET"
  | "POST"

type Path = `/${string}`

type HttpAction = {
  type: "HttpAction"
  path: Path | undefined
  method: HttpMethod
}

type MediaAction = {
  type: "MediaAction"
  media:
    | "text/plain"
    | "application/json"
}

type ActionPattern = {
  protocol:
    | "http"
    | "*"
  method:
    | "GET"
    | "POST"
    | "PUT"
  path: `/${string}`
}

export const ActionSetItems: unique symbol = Symbol()

export const TypeId: unique symbol = Symbol.for("effect-start/ActionSet")

export type Item = Action.Default | ActionSet.Any
export type ItemArray = ReadonlyArray<Item>

export namespace ActionSet {
  export type ActionSet<M extends ItemArray = []> =
    & Data<M>
    & {
      [TypeId]: typeof TypeId
    }
    & Pipeable.Pipeable
    & Iterable<Action.Default>

  export type Data<M extends ItemArray = []> = {
    [ActionSetItems]: M
  }

  export type Default = ActionSet<readonly [Item, ...Item[]]>

  export type Any = ActionSet<ItemArray>

  export type Items<T extends Data<any>> = T extends Data<infer M> ? M
    : never

  export type Bindings<T extends Data<any>> = T extends Data<infer M>
    ? _ExtractBindings<M>
    : never

  type _ExtractBindings<M extends ItemArray> = M extends readonly [
    infer Head,
    ...infer Tail extends ItemArray,
  ] ? (
      Head extends Action.Action<any, infer B> ? B | _ExtractBindings<Tail>
        : Head extends ActionSet<infer Nested>
          ? _ExtractBindings<Nested> | _ExtractBindings<Tail>
        : _ExtractBindings<Tail>
    )
    : never
}

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
  *[Symbol.iterator](this: ActionSet.Any) {
    for (const item of this[ActionSetItems]) {
      yield* item
    }
  },
}

export function isActionSet(
  input: unknown,
): input is ActionSet.Any {
  return Predicate.hasProperty(input, TypeId)
}

export function make<M extends ItemArray = []>(
  items: M = [] as unknown as M,
): ActionSet.ActionSet<M> {
  return Object.assign(
    Object.create(Proto),
    {
      [ActionSetItems]: items,
    },
  ) as ActionSet.ActionSet<M>
}

export const empty: ActionSet.ActionSet<[]> = make()

export function items<T extends ActionSet.Data<any>>(
  self: T,
): ActionSet.Items<T> {
  return self[ActionSetItems]
}

export function makeAction<
  H extends ActionHandler,
  B extends Record<string, any>,
>(
  handler: H,
): Action.Action<H, B> {
  const action: Action.Action<H, B> = Object.assign(
    Object.create(Proto),
    {
      [ActionSetItems]: [],
      handler,
      *[Symbol.iterator]() {
        yield action
      },
    },
  )
  return action
}

export type ActionHandler<
  A = unknown,
  E = any,
  R = any,
> = (bindings: any) => Effect.Effect<A, E, R>

export type ActionBindings = Record<string, any>

export namespace Action {
  export interface Action<
    out Handler extends ActionHandler,
    out Bindings extends ActionBindings | null = null,
  > extends ActionSet.ActionSet<[Action<Handler, Bindings>]> {
    readonly handler: Handler
    readonly bindings: Bindings
  }

  export type Default = Action<ActionHandler, Record<string, any>>

  export type Tuple = readonly [Item, ...Item[]]

  export type Array = ItemArray

  export type Error<T> = T extends ActionSet.ActionSet<infer Items>
    ? _ExtractError<Items>
    : never

  type _ExtractError<M extends ItemArray> = M extends readonly [
    infer Head,
    ...infer Tail extends ItemArray,
  ] ? (
      Head extends Action<infer H, any> ?
          | (H extends ActionHandler<any, infer E, any> ? E : never)
          | _ExtractError<Tail>
        : Head extends ActionSet.ActionSet<infer Nested>
          ? _ExtractError<Nested> | _ExtractError<Tail>
        : _ExtractError<Tail>
    )
    : never

  export type Requirements<T> = T extends ActionSet.ActionSet<infer Items>
    ? _ExtractRequirements<Items>
    : never

  type _ExtractRequirements<M extends ItemArray> = M extends readonly [
    infer Head,
    ...infer Tail extends ItemArray,
  ] ? (
      Head extends Action<infer H, any> ?
          | (H extends ActionHandler<any, any, infer R> ? R : never)
          | _ExtractRequirements<Tail>
        : Head extends ActionSet.ActionSet<infer Nested>
          ? _ExtractRequirements<Nested> | _ExtractRequirements<Tail>
        : _ExtractRequirements<Tail>
    )
    : never

  export type Bindings<T> = T extends ActionSet.ActionSet<infer Items>
    ? _ExtractBindings<Items>
    : never

  type _ExtractBindings<M extends ItemArray> = M extends readonly [
    infer Head,
    ...infer Tail extends ItemArray,
  ] ? (
      Head extends Action<any, infer B> ? B | _ExtractBindings<Tail>
        : Head extends ActionSet.ActionSet<infer Nested>
          ? _ExtractBindings<Nested> | _ExtractBindings<Tail>
        : _ExtractBindings<Tail>
    )
    : never
}

export type Merge<
  A extends ActionSet.Any,
  B extends ActionSet.Any,
> = ActionSet.ActionSet<readonly [A, B]>

export const merge: {
  <B extends ActionSet.Any>(
    other: B,
  ): <A extends ActionSet.Any>(
    self: A,
  ) => ActionSet.ActionSet<readonly [A, B]>

  <A extends ActionSet.Any, B extends ActionSet.Any>(
    self: A,
    other: B,
  ): ActionSet.ActionSet<readonly [A, B]>
} = dual(2, <A extends ActionSet.Any, B extends ActionSet.Any>(
  self: A,
  other: B,
): ActionSet.ActionSet<readonly [A, B]> => {
  return make([self, other] as const)
})

export function mergeAll<
  Sets extends readonly [ActionSet.Any, ...ActionSet.Any[]],
>(
  ...sets: Sets
): ActionSet.ActionSet<Sets> {
  return make(sets)
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] } & {}

export const schemaHeaders: {
  <T extends Schema.Struct<any>>(
    schema: T,
  ): <M extends ItemArray>(
    self: ActionSet.ActionSet<M>,
  ) => ActionSet.ActionSet<
    [
      ...M,
      Action.Action<
        ActionHandler<void, never, never>,
        { headers: Mutable<Schema.Schema.Type<T>> }
      >,
    ]
  >

  <M extends ItemArray, T extends Schema.Struct<any>>(
    self: ActionSet.ActionSet<M>,
    schema: T,
  ): ActionSet.ActionSet<
    [
      ...M,
      Action.Action<
        ActionHandler<void, never, never>,
        { headers: Mutable<Schema.Schema.Type<T>> }
      >,
    ]
  >
} = dual(
  2,
  <M extends ItemArray, T extends Schema.Struct<any>>(
    self: ActionSet.ActionSet<M>,
    _schema: T,
  ): ActionSet.ActionSet<
    [
      ...M,
      Action.Action<
        ActionHandler<void, never, never>,
        { headers: Mutable<Schema.Schema.Type<T>> }
      >,
    ]
  > => {
    const action = makeAction<
      ActionHandler<void, never, never>,
      { headers: Mutable<Schema.Schema.Type<T>> }
    >(() => Effect.void)

    return make([...items(self), action] as const)
  },
)

type ExtractBindings<M extends ItemArray> = M extends readonly [
  infer Head,
  ...infer Tail extends ItemArray,
] ? (
    Head extends Action.Action<any, infer B> ? B & ExtractBindings<Tail>
      : Head extends ActionSet.ActionSet<infer Nested>
        ? ExtractBindings<Nested> & ExtractBindings<Tail>
      : ExtractBindings<Tail>
  )
  : {}

export {
  get,
  post,
} from "./ActionMethod.ts"
export type {
  ActionMethod,
} from "./ActionMethod.ts"

export function text<
  M extends ItemArray,
  A,
  E,
  R,
>(
  handler: (bindings: ExtractBindings<M>) => Effect.Effect<A, E, R>,
): (
  self: ActionSet.ActionSet<M>,
) => ActionSet.ActionSet<
  [
    ...M,
    Action.Action<
      ActionHandler<A, E, R>,
      ExtractBindings<M>
    >,
  ]
> {
  return function makeText(self: ActionSet.ActionSet<M>) {
    const action = makeAction<ActionHandler<A, E, R>, ExtractBindings<M>>(
      handler as ActionHandler<A, E, R>,
    )

    return make(
      [
        ...items(self),
        action,
      ] as const,
    )
  }
}
