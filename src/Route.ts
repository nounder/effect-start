import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Development from "./Development.ts"
import * as Entity from "./Entity.ts"
import * as RouteBody from "./RouteBody.ts"
import * as RouteTree from "./RouteTree.ts"
import type * as Values from "./_Values.ts"
import * as Html from "./Html.ts"
import type { JSX } from "../src/jsx.d.ts"

export const render = RouteBody.render

export const RouteItems: unique symbol = Symbol()
export const RouteDescriptor: unique symbol = Symbol()
// only for structural type matching
export const RouteBindings: unique symbol = Symbol()

export const TypeId = "~effect-start/RouteSet" as const

export namespace RouteDescriptor {
  export type Any = {
    [key: string]: unknown
  }
}

export type RouteSet<
  D extends RouteDescriptor.Any = {},
  B = {},
  M extends Route.Tuple = [],
> = RouteSet.Data<D, B, M> & {
  [TypeId]: typeof TypeId
} & Pipeable.Pipeable &
  Iterable<M[number]>

export namespace RouteSet {
  export type Data<D extends RouteDescriptor.Any = {}, B = {}, M extends Route.Tuple = []> = {
    [RouteItems]: M
    [RouteDescriptor]: D
    [RouteBindings]: B
  }

  export type Proto = Pipeable.Pipeable &
    Iterable<Route<any, any, any, any, any>> & {
      [TypeId]: typeof TypeId
    }

  export type Any = RouteSet<{}, {}, Route.Tuple>

  export type Infer<R> = R extends RouteSet<infer D, infer B, infer I> ? RouteSet<D, B, I> : R

  export type Items<T extends Data<any, any, any>> = T extends Data<any, any, infer M> ? M : never

  export type Descriptor<T extends Data<any, any, any>> =
    T extends Data<infer D, any, any> ? D : never
}

export interface Route<
  D extends RouteDescriptor.Any = {},
  B = {},
  A = any,
  E = never,
  R = never,
> extends RouteSet<D, {}, [Route<D, B, A, E, R>]> {
  readonly handler: Route.Handler<B & D, A, E, R>
}

export namespace Route {
  export type With<D extends RouteDescriptor.Any> = Route<any, any, any, any, any> & {
    [RouteDescriptor]: D
  }

  export type Tuple<_D extends RouteDescriptor.Any = {}> = [...Route<any, any, any, any, any>[]]

  export type Handler<B, A, E, R> = (
    context: B,
    next: (context?: Partial<B> & Record<string, unknown>) => Entity.Entity<any>,
  ) => Effect.Effect<Entity.Entity<A>, E, R>

  /**
   * Extracts only the bindings (B) from routes, excluding descriptors.
   */
  export type Bindings<T extends RouteSet.Any, M extends Tuple = RouteSet.Items<T>> = M extends [
    infer Head,
    ...infer Tail extends Tuple,
  ]
    ? Head extends Route<any, infer B, any, any, any>
      ? ShallowMerge<B, Bindings<T, Tail>>
      : Bindings<T, Tail>
    : {}

  /**
   * Extracts the full handler context from a RouteSet.
   * Merges descriptors and bindings from all routes, with later values
   * taking precedence via ShallowMerge to avoid `never` from conflicting
   * literal types (e.g. `{ method: "*" } & { method: "GET" }`).
   */
  export type Context<T extends RouteSet.Any> = Omit<
    RouteSet.Descriptor<T>,
    keyof ExtractContext<RouteSet.Items<T>>
  > &
    ExtractContext<RouteSet.Items<T>>

  type ExtractContext<M extends Tuple> = M extends [infer Head, ...infer Tail extends Tuple]
    ? Head extends Route<infer D, infer B, any, any, any>
      ? ShallowMerge<Omit<D, keyof B> & B, ExtractContext<Tail>>
      : ExtractContext<Tail>
    : {}
}

const Proto: RouteSet.Proto = {
  [TypeId]: TypeId,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
  *[Symbol.iterator](this: RouteSet.Any) {
    yield* items(this)
  },
}

export function isRouteSet(input: unknown): input is RouteSet.Any {
  return Predicate.hasProperty(input, TypeId)
}

export function isRoute(input: unknown): input is Route {
  return isRouteSet(input) && Predicate.hasProperty(input, "handler")
}

export function set<D extends RouteDescriptor.Any = {}, B = {}, I extends Route.Tuple = []>(
  items: I = [] as unknown as I,
  descriptor: D = {} as D,
): RouteSet<D, B, I> {
  return Object.assign(Object.create(Proto), {
    [RouteItems]: items,
    [RouteDescriptor]: descriptor,
  }) as RouteSet<D, B, I>
}

export function make<D extends RouteDescriptor.Any, B, A, E = never, R = never>(
  handler: Route.Handler<B & D, A, E, R>,
  descriptor?: D,
): Route<D, B, A, E, R> {
  const items: any = []
  const route: Route<D, B, A, E, R> = Object.assign(Object.create(Proto), {
    [RouteItems]: items,
    [RouteDescriptor]: descriptor,
    handler,
  })

  items.push(route)

  return route
}

export const empty = set()

export function describe<D extends RouteDescriptor.Any>(descriptor: D) {
  return set([], descriptor)
}

export function items<T extends RouteSet.Data<any, any, any>>(self: T): RouteSet.Items<T> {
  return self[RouteItems]
}

export function descriptor<T extends RouteSet.Data<any, any, any>>(
  self: T,
): T[typeof RouteDescriptor]
export function descriptor<E extends RouteDescriptor.Any>(self: RouteSet.Data<any, any, any>): E
export function descriptor<T extends RouteSet.Data<any, any, any>>(
  self: Iterable<T>,
): Array<T[typeof RouteDescriptor]>
export function descriptor(
  self: RouteSet.Data<any, any, any> | Iterable<RouteSet.Data<any, any, any>>,
): RouteDescriptor.Any | RouteDescriptor.Any[] {
  if (RouteDescriptor in self) {
    return self[RouteDescriptor]
  }
  return [...self].map((r) => r[RouteDescriptor])
}

export type ExtractBindings<M extends Route.Tuple> = M extends [
  infer Head,
  ...infer Tail extends Route.Tuple,
]
  ? Head extends Route<any, infer B, any, any, any>
    ? ShallowMerge<B, ExtractBindings<Tail>>
    : ExtractBindings<Tail>
  : {}

// Shallow merge two object types.
// For overlapping keys, intersect the values.
type ShallowMerge<A, B> = Omit<A, keyof B> & {
  [K in keyof B]: K extends keyof A ? A[K] & B[K] : B[K]
}

export type ExtractContext<
  Items extends Route.Tuple,
  Descriptor extends RouteDescriptor.Any,
> = ExtractBindings<Items> & Descriptor

export * from "./RouteHook.ts"
export * from "./RouteSchema.ts"

export { del, get, head, options, patch, post, put, use } from "./RouteMount.ts"

export class Request extends Context.Tag("effect-start/Route/Request")<
  Request,
  globalThis.Request
>() {}

export const text = RouteBody.build<string, "text">({
  format: "text",
})

export const html = RouteBody.build<string | JSX.Children, string, "html">({
  format: "html",
  handle: (body) => (typeof body === "string" ? body : Html.renderToString(body as JSX.Children)),
})

export const json = RouteBody.build<Values.Json, "json">({
  format: "json",
})

export const bytes = RouteBody.build<Uint8Array, "bytes">({
  format: "bytes",
})

export { sse } from "./RouteSse.ts"

export function redirect<D extends RouteDescriptor.Any, B extends {}, I extends Route.Tuple>(
  url: string | URL,
  options?: { status?: 301 | 302 | 303 | 307 | 308 },
): (
  self: RouteSet<D, B, I>,
) => RouteSet<D, B, [...I, Route<{}, {}, "", never, never>]> {
  const route = make<{}, {}, "">(() =>
    Effect.succeed(
      Entity.make("", {
        status: options?.status ?? 302,
        headers: {
          location: url instanceof URL ? url.href : url,
        },
      }),
    ),
  )

  return (self) =>
    set<D, B, [...I, Route<{}, {}, "", never, never>]>(
      [...items(self), route],
      descriptor(self),
    )
}

export class Routes extends Context.Tag("effect-start/Routes")<Routes, RouteTree.RouteTree>() {}

export function layer(routes: RouteTree.RouteMap | RouteTree.RouteTree) {
  return Layer.sync(Routes, () => (RouteTree.isRouteTree(routes) ? routes : RouteTree.make(routes)))
}

export function layerMerge(routes: RouteTree.InputRouteMap | RouteTree.RouteTree) {
  return Layer.effect(
    Routes,
    Effect.gen(function* () {
      const existing = yield* Effect.serviceOption(Routes).pipe(
        Effect.andThen(Option.getOrUndefined),
      )
      const tree = RouteTree.isRouteTree(routes) ? routes : RouteTree.make(routes)
      if (!existing) return tree
      return RouteTree.merge(existing, tree)
    }),
  )
}

/**
 * Creates a route that short-curcits in development.
 *
 * Note that when we convert the routes to web handles in {@link import("./RouteHttp.ts")},
 * we exclude them altogeteher in development.
 */
export function devOnly<D extends RouteDescriptor.Any, B, I extends Route.Tuple>(
  self: RouteSet<D, B, I>,
): RouteSet<D, B, [...I, Route<{ dev: true }, { dev: true }, unknown, any, any>]> {
  const route: Route<{ dev: true }, { dev: true }, unknown, any, any> = make<
    { dev: true },
    { dev: true },
    unknown,
    any,
    any
  >(
    (context, next) =>
      Effect.flatMap(Development.option, (developmentOption) =>
        Option.isSome(developmentOption)
          ? Effect.succeed(next({ ...context, dev: true }))
          : Effect.succeed(Entity.make("", { status: 404 })),
      ),
    { dev: true },
  )

  const nextItems: [...I, Route<{ dev: true }, { dev: true }, unknown, any, any>] = [
    ...items(self),
    route,
  ]

  return set<D, B, [...I, Route<{ dev: true }, { dev: true }, unknown, any, any>]>(
    nextItems,
    descriptor(self),
  )
}

export { make as tree } from "./RouteTree.ts"

export function lazy<T extends RouteSet.Any>(
  load: () => Promise<{ default: T }>,
): Effect.Effect<T, never, never> {
  let cached: T | undefined
  return Effect.suspend(() => {
    if (cached !== undefined) {
      return Effect.succeed(cached)
    }
    return Effect.promise(load).pipe(
      Effect.map((mod) => {
        cached = mod.default
        return cached
      }),
    )
  })
}

export { link } from "./RouteLink.ts"
