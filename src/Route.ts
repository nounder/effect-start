import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

export namespace RouteDescriptor {
  export type Any =
    | Empty
    | Media
    | Proto
    | Path

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

  export type Data = Partial<
    & Media
    & Proto
    & Path
  >
}

export const RouteItems: unique symbol = Symbol()
export const RouteDescriptor: unique symbol = Symbol()

export const TypeId: unique symbol = Symbol.for("effect-start/RouteSet")

export type Route = Route.Default
export type RouteItem = Route.Default | RouteSet.Any
export type Routes = [...RouteItem[]]

export namespace RouteSet {
  export type RouteSet<
    D extends RouteDescriptor.Empty = {},
    M extends Routes = [],
  > =
    & Data<D, M>
    & {
      [TypeId]: typeof TypeId
    }
    & Pipeable.Pipeable
    & Iterable<Route.Default>

  export type Data<
    D extends RouteDescriptor.Empty = {},
    M extends Routes = [],
  > = {
    [RouteItems]: M
    [RouteDescriptor]: D
  }

  export type Default = RouteSet<{}, [Route, ...Route[]]>

  export type Any = RouteSet<{}, Routes>

  export type Items<T extends Data<any, any>> = T extends Data<any, infer M> ? M
    : never

  export type Descriptor<T extends Data<any, any>> = T extends Data<infer D> ? D
    : never

  export type Descriptors<T extends Data<any, any>> = T extends
    Data<any, infer M> ? _ExtractDescriptors<M>
    : never

  type _ExtractDescriptors<M extends Routes> = M extends [
    infer Head,
    ...infer Tail extends Routes,
  ] ? (
      Head extends { handler: any; [RouteDescriptor]: infer D }
        ? D & _ExtractDescriptors<Tail>
        : Head extends {
          [RouteDescriptor]: infer D
          [RouteItems]: infer Nested extends Routes
        } ? D & _ExtractDescriptors<Nested> & _ExtractDescriptors<Tail>
        : _ExtractDescriptors<Tail>
    )
    : {}

  export type Bindings<T extends Data<any, any>> = T extends Data<any, infer M>
    ? _ExtractBindings<M>
    : never

  type _ExtractBindings<M extends Routes> = M extends [
    infer Head,
    ...infer Tail extends Routes,
  ] ? (
      Head extends Route.Route<any, infer B> ? B | _ExtractBindings<Tail>
        : Head extends RouteSet<any, infer Nested>
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
  *[Symbol.iterator](this: RouteSet.Any) {
    for (const item of this[RouteItems]) {
      if (isRoute(item)) {
        yield item
      } else {
        yield* item as RouteSet.Any
      }
    }
  },
}

export function isRouteSet(
  input: unknown,
): input is RouteSet.Any {
  return Predicate.hasProperty(input, TypeId)
}

export function isRoute(
  input: unknown,
): input is Route.Default {
  return isRouteSet(input) && Predicate.hasProperty(input, "handler")
}

export function set<
  D extends RouteDescriptor.Any = {},
  M extends Routes = [],
>(
  items: M = [] as unknown as M,
  descriptor: D = {} as D,
): RouteSet.RouteSet<D, M> {
  return Object.assign(
    Object.create(Proto),
    {
      [RouteItems]: items,
      [RouteDescriptor]: descriptor,
    },
  ) as RouteSet.RouteSet<D, M>
}

export function make<
  D extends RouteDescriptor.Any = {},
  B extends Record<string, any> = {},
  A = any,
  E = never,
  R = never,
>(
  handler: RouteHandler<B & D, A, E, R>,
  descriptor?: D,
): Route.Route<D, B, A, E, R> {
  const items: any = []
  const route: Route.Route<D, B, A, E, R> = Object.assign(
    Object.create(Proto),
    {
      [RouteItems]: items,
      [RouteDescriptor]: descriptor,
      handler,
    },
  )

  items.push(route)

  return route
}

export const empty: RouteSet.RouteSet<{}, []> = set()

export function items<T extends RouteSet.Data<any, any>>(
  self: T,
): RouteSet.Items<T> {
  return self[RouteItems]
}

export type RouteBindings = Record<string, any>

export type RouteHandler<B, A, E, R> =
  | ((
    context: B,
    next: (context: B) => Effect.Effect<A>,
  ) => Effect.Effect<A, E, R>)
  | ((
    context: B,
  ) => Effect.Effect<A, E, R>)

export namespace Route {
  export interface Route<
    D extends RouteDescriptor.Empty = {},
    B extends RouteBindings = {},
    A = any,
    E = never,
    R = never,
  > extends
    RouteSet.RouteSet<D, [
      Route<D, B, A>,
    ]>
  {
    readonly handler: RouteHandler<B & D, A, E, R>
  }

  export type Default = Route<{}, Record<string, any>, any>

  export type Array = Routes

  export type Error<T> = T extends RouteSet.RouteSet<any, infer Items>
    ? _ExtractError<Items>
    : never

  type _ExtractError<M extends Routes> = M extends [
    infer Head,
    ...infer Tail extends Routes,
  ] ? (
      Head extends Route<any, any, any, infer E> ? E | _ExtractError<Tail>
        : Head extends RouteSet.RouteSet<any, infer Nested>
          ? _ExtractError<Nested> | _ExtractError<Tail>
        : _ExtractError<Tail>
    )
    : never

  export type Requirements<T> = T extends RouteSet.RouteSet<any, infer Items>
    ? _ExtractRequirements<Items>
    : never

  type _ExtractRequirements<M extends Routes> = M extends [
    infer Head,
    ...infer Tail extends Routes,
  ] ? (
      Head extends Route<any, any, any, any, infer R>
        ? R | _ExtractRequirements<Tail>
        : Head extends RouteSet.RouteSet<any, infer Nested>
          ? _ExtractRequirements<Nested> | _ExtractRequirements<Tail>
        : _ExtractRequirements<Tail>
    )
    : never

  export type Bindings<T> = T extends RouteSet.RouteSet<infer D, infer Items>
    ? D & _ExtractBindings<Items>
    : never

  type _ExtractBindings<M extends Routes> = M extends [
    infer Head,
    ...infer Tail extends Routes,
  ] ? (
      Head extends Route<infer D, infer B> ? D & B & _ExtractBindings<Tail>
        : Head extends RouteSet.RouteSet<infer D, infer Nested>
          ? D & _ExtractBindings<Nested> & _ExtractBindings<Tail>
        : _ExtractBindings<Tail>
    )
    : {}

  export type Descriptor<T> = T extends Route<infer D> ? D : never
}

type ExtractBindings<M extends Routes> = M extends [
  infer Head,
  ...infer Tail extends Routes,
] ? (
    Head extends Route.Route<any, infer B> ? B & ExtractBindings<Tail>
      : Head extends RouteSet.RouteSet<any, infer Nested>
        ? ExtractBindings<Nested> & ExtractBindings<Tail>
      : ExtractBindings<Tail>
  )
  : {}

type ExtractContext<
  Items extends Routes,
  Descriptor extends RouteDescriptor.Empty,
> = ExtractBindings<Items> & Descriptor

export * from "./RouteMethod.ts"

export function text<
  A extends string,
  E,
  R,
  D extends RouteDescriptor.Empty,
  Priors extends Routes,
>(
  handler: (
    context: ExtractContext<Priors, D> & { media: "text/plain" },
  ) => Effect.Effect<A, E, R>,
) {
  return function(
    self: RouteSet.RouteSet<D, Priors>,
  ) {
    const route = make<
      { media: "text/plain" },
      ExtractBindings<Priors>,
      A,
      E,
      R
    >(
      handler as RouteHandler<
        ExtractBindings<Priors> & { media: "text/plain" },
        A,
        E,
        R
      >,
      { media: "text/plain" },
    )

    return set(
      [
        ...items(self),
        route,
      ] as const,
    )
  }
}

export function html<
  A extends string,
  E,
  R,
  D extends RouteDescriptor.Empty,
  Priors extends Routes,
>(
  handler: (
    context: ExtractContext<Priors, D>,
  ) => Effect.Effect<A, E, R>,
) {
  return function(
    self: RouteSet.RouteSet<D, Priors>,
  ) {
    const route = make<
      { media: "text/html" },
      ExtractContext<Priors, D>,
      A,
      E,
      R
    >(
      handler,
      { media: "text/html" },
    )

    return set(
      [
        ...items(self),
        route,
      ] as const,
    )
  }
}

export function filter<
  B extends Record<string, any>,
  E = never,
  R = never,
>(
  filterHandler: (
    context: any,
  ) => Effect.Effect<{ context: B }, E, R>,
) {
  return function<D extends RouteDescriptor.Empty, Priors extends Routes>(
    self: RouteSet.RouteSet<D, Priors>,
  ) {
    const route = make<
      {},
      ExtractBindings<Priors> & B,
      any,
      E,
      R
    >(
      (context, next) =>
        Effect.gen(function*() {
          const filterResult = yield* filterHandler(context)

          yield* next(
            filterResult
              ? {
                ...context,
                ...filterResult.context,
              }
              : context,
          )
        }),
    )

    return set(
      [
        ...items(self),
        route,
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
