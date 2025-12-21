import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

type HttpMethod =
  | "GET"
  | "POST"

export namespace ActionDescriptor {
  export type Any =
    | Empty
    | Media
    | Proto
    | Path
    | Method

  export type Empty = {}

  export type Media = {
    media:
      | "text/plain"
      | "application/json"
  }

  export type Proto = {
    proto: "http"
  }

  export type Path = {
    path: `/${string}`
  }

  export type Method = {
    method: HttpMethod
  }

  export type Data = Partial<
    & Media
    & Proto
    & Path
    & Method
  >
}

export const ActionItems: unique symbol = Symbol()
export const ActionDescriptor: unique symbol = Symbol()

export const TypeId: unique symbol = Symbol.for("effect-start/ActionSet")

export type Action = Action.Default
export type Actions = ReadonlyArray<Action>

export namespace ActionSet {
  export type ActionSet<
    M extends Actions = [],
    D extends ActionDescriptor.Empty = {},
  > =
    & Data<M, D>
    & {
      [TypeId]: typeof TypeId
    }
    & Pipeable.Pipeable
    & Iterable<Action.Default>

  export type Data<
    M extends Actions = [],
    D extends ActionDescriptor.Empty = {},
  > = {
    [ActionItems]: M
    [ActionDescriptor]: D
  }

  export type Default = ActionSet<readonly [Action, ...Action[]]>

  export type Any = ActionSet<Actions>

  export type Items<T extends Data<any>> = T extends Data<infer M> ? M
    : never

  export type Bindings<T extends Data<any>> = T extends Data<infer M>
    ? _ExtractBindings<M>
    : never

  type _ExtractBindings<M extends Actions> = M extends readonly [
    infer Head,
    ...infer Tail extends Actions,
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
    for (const item of this[ActionItems]) {
      if (isAction(item)) {
        yield item
      } else {
        yield* item as ActionSet.Any
      }
    }
  },
}

export function isActionSet(
  input: unknown,
): input is ActionSet.Any {
  return Predicate.hasProperty(input, TypeId)
}

export function isAction(
  input: unknown,
): input is Action.Default {
  return isActionSet(input) && Predicate.hasProperty(input, "handler")
}

export function set<
  M extends Actions = [],
  D extends ActionDescriptor.Any = ActionDescriptor.Empty,
>(
  items: M = [] as unknown as M,
): ActionSet.ActionSet<M> {
  return Object.assign(
    Object.create(Proto),
    {
      [ActionItems]: items,
      [ActionDescriptor]: {} as ActionDescriptor.Empty,
    },
  ) as ActionSet.ActionSet<M>
}

export function make<
  H extends ActionHandler,
  B extends Record<string, any>,
  D extends ActionDescriptor.Any = {},
>(
  handler: H,
  descriptor?: D,
): Action.Action<H, B> {
  const items: any = []
  const action: Action.Action<H, B> = Object.assign(
    Object.create(Proto),
    {
      [ActionItems]: items,
      [ActionDescriptor]: descriptor,
      handler,
    },
  )

  items.push(action)

  return action
}

export const empty: ActionSet.ActionSet<[]> = set()

export function items<T extends ActionSet.Data<any>>(
  self: T,
): ActionSet.Items<T> {
  return self[ActionItems]
}

export type ActionHandler<
  A = unknown,
  E = any,
  R = any,
  // if ActionHandler contains bindings, we don't have to store it in Action??
  B = any,
> = (
  context: B,
  // next shuold return value of compatbile type?
  next?: (context: B) => ReturnType<ActionHandler>,
) => Effect.Effect<A, E, R>

export type ActionBindings = Record<string, any>

export namespace Action {
  export interface Action<
    out Handler extends ActionHandler,
    out Bindings extends ActionBindings = {},
    out Descriptor extends ActionDescriptor.Empty = {},
  > extends
    ActionSet.ActionSet<[
      Action<Handler, Descriptor>,
    ]>
  {
    readonly handler: Handler
    readonly _bindings: Bindings
  }

  export type Default = Action<
    ActionHandler,
    Record<string, any>
  >

  export type Array = Actions

  export type Error<T> = T extends ActionSet.ActionSet<infer Items>
    ? _ExtractError<Items>
    : never

  type _ExtractError<M extends Actions> = M extends readonly [
    infer Head,
    ...infer Tail extends Actions,
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

  type _ExtractRequirements<M extends Actions> = M extends readonly [
    infer Head,
    ...infer Tail extends Actions,
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

  type _ExtractBindings<M extends Actions> = M extends readonly [
    infer Head,
    ...infer Tail extends Actions,
  ] ? (
      Head extends Action<any, infer B> ? B | _ExtractBindings<Tail>
        : Head extends ActionSet.ActionSet<infer Nested>
          ? _ExtractBindings<Nested> | _ExtractBindings<Tail>
        : _ExtractBindings<Tail>
    )
    : never
}

type ExtractBindings<M extends Actions> = M extends readonly [
  infer Head,
  ...infer Tail extends Actions,
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
  A extends string,
  E,
  R,
  Priors extends Actions,
>(
  handler: (
    context: ExtractBindings<Priors>,
  ) => Effect.Effect<A, E, R>,
) {
  return function(
    self: ActionSet.ActionSet<Priors> = set(),
  ) {
    const action = make<
      ActionHandler<A, E, R>,
      ExtractBindings<Priors>
    >(
      handler,
      { media: "text/plain" },
    )

    return set(
      [
        ...items(self),
        action,
      ] as const,
    )
  }
}

export function filter<
  B extends Record<string, any>,
  E,
  R,
  C = unknown,
>(
  filterHandler: (
    context: C,
  ) => Effect.Effect<{ context: B }, E, R>,
) {
  return function<Priors extends Actions>(
    self: ActionSet.ActionSet<Priors> = set() as ActionSet.ActionSet<Priors>,
  ) {
    const action = make<
      ActionHandler<{ context: B }, E, R>,
      ExtractBindings<Priors> & B
    >(
      (context) =>
        Effect.gen(function*() {
          const filterResult = yield* filterHandler(context)

          return filterResult
        }),
    )

    return set(
      [
        ...items(self),
        action,
      ] as const,
    )
  }
}

export function schemaHeaders<
  A,
  I extends Readonly<Record<string, string | undefined>>,
  R,
>(
  fields: Schema.Schema<A, I, R>,
) {
  return filter(() =>
    Effect.map(
      HttpServerRequest.schemaHeaders(fields),
      (headers) => ({
        context: {
          headers,
        },
      }),
    )
  )
}
