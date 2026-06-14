/**
 * Route defines HTTP endpoints with content negotiation, type-safe middlewares,
 * and validated payloads (via schema* functions)
 *
 * @example
 * ```ts
 * import { Schema } from "effect"
 * import { Start, Route } from "effect-start"
 *
 * // map routes to paths
 * const routes = Route.map({
 *   // wildcard paths accept a route layer (similar to middlewares)
 *   // that applies to all routes underneath it.
 *   "*": Route.use(
 *     // only wraps HTML handlers
 *     Route.html(function* (ctx, next) {
 *       return (
 *         <html>
 *           <head>
 *             <title>Todos</title>
 *           </head>
 *           <body>
 *             <div>{yield* next.html}</div>
 *           </body>
 *         </html>
 *       )
 *     }),
 *   ),
 *   "/": Route.get(
 *     Route.redirect("/todos")
 *   ),
 *   "/todos": Route
 *     .get(
 *       Route.html(function* () {
 *         const todos = yield* sql`select * from todos`
 *
 *         return <ul>{todos.map(todo => <li>{todo.text}</li>)}</ul>
 *       }),
 *     )
 *     .post(
 *       // require a json payload
 *       Route.schemaBodyJson({
 *         text: Schema.String
 *       }),
 *       Route.json(function* (ctx) {
 *         // request payloads are parsed and validated
 *         yield* sql`insert into todos ${ctx.body}`
 *       })
 *     ),
 * })
 *
 * // later, provide routes manually or use FileRouter for file-based router.
 * Start.pack(Route.layer(routes))
 * ```
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import type { JSX } from "../src/jsx.ts"
import * as Development from "./Development.ts"
import * as Entity from "./Entity.ts"
import * as Html from "./Html.ts"
import type * as Values from "./internal/Values.ts"
import * as RouteBody from "./internal/RouteBody.ts"
import * as RouteMap from "./internal/RouteMap.ts"

/** @internal */
export const RouteItems: unique symbol = Symbol()
/** @internal */
export const RouteDescriptor: unique symbol = Symbol()
// only for structural type matching
declare const RouteBindings: unique symbol

export const TypeId = "~effect-start/RouteSet" as const

/** @internal */
export type RouteSet<D = {}, B = {}, M extends Route.Tuple = []> =
  & RouteSet.Data<D, B, M>
  & {
    [TypeId]: typeof TypeId
  }
  & Pipeable.Pipeable
  & Iterable<M[number]>

/** @internal */
export namespace RouteSet {
  export type Data<D = {}, B = {}, M extends Route.Tuple = []> = {
    [RouteItems]: M
    [RouteDescriptor]: D
    [RouteBindings]: B
  }

  export type Proto =
    & Pipeable.Pipeable
    & Iterable<Route<any, any, any, any, any>>
    & {
      [TypeId]: typeof TypeId
    }

  export type Any = RouteSet<{}, {}, Route.Tuple>

  export type Items<T extends Data<any, any, any>> = T extends Data<any, any, infer M> ? M : never

  export type Descriptor<T extends Data<any, any, any>> = T extends Data<infer D, any, any> ? D : never
}

export interface Route<D = {}, B = {}, A = any, E = never, R = never> extends
  RouteSet<
    D,
    B,
    [Route<D, B, A, E, R>]
  >
{
  readonly handler: Route.Handler<any, any, any, any>
}

export namespace Route {
  export type With<D> = Route<any, any, any, any, any> & {
    [RouteDescriptor]: D
  }

  export type Tuple = [...Array<Route<any, any, any, any, any>>]

  export type Handler<B, A, E, R> = (
    context: B,
    next: Entity.Entity<A, never>,
  ) => Effect.Effect<Entity.Entity<A>, E, R>

  /**
   * Extracts only the bindings (B) from routes, excluding descriptors.
   */
  export type Bindings<
    T extends RouteSet.Any,
    M extends Tuple = RouteSet.Items<T>,
  > = M extends [
    infer Head,
    ...infer Tail extends Tuple,
  ] ? Head extends Route<any, infer B, any, any, any> ? ShallowMerge<B, Bindings<T, Tail>>
    : Bindings<T, Tail>
    : {}

  /**
   * Extracts the full handler context from a RouteSet.
   * Merges descriptors and bindings from all routes, with later values
   * taking precedence via ShallowMerge to avoid `never` from conflicting
   * literal types (e.g. `{ method: "*" } & { method: "GET" }`).
   */
  export type Context<T extends RouteSet.Any> =
    & Omit<
      RouteSet.Descriptor<T>,
      keyof ExtractContext<RouteSet.Items<T>>
    >
    & ExtractContext<RouteSet.Items<T>>

  type ExtractContext<M extends Tuple> = M extends [infer Head, ...infer Tail extends Tuple]
    ? Head extends Route<infer D, infer B, any, any, any> ? ShallowMerge<Omit<D, keyof B> & B, ExtractContext<Tail>>
    : ExtractContext<Tail>
    : {}
}

export const text = RouteBody.build<string, "text">({
  format: "text",
})

export const html = RouteBody.build<string | JSX.Element, string, "html">({
  format: "html",
  handle: (
    body,
  ) => (typeof body === "string" ? body : Html.text(body as JSX.Element)),
})

export const json = RouteBody.build<Values.Json, "json">({
  format: "json",
})

export const bytes = RouteBody.build<Uint8Array, "bytes">({
  format: "bytes",
})

/**
 * Renders an arbitrary response.
 * Prefer text/html/json/bytes since they handle content negotiation
 * and more friendly interace for each content type.
 */
export const handle = RouteBody.handle

export function redirect<D, B, I extends Route.Tuple>(
  url: string | URL,
  options?: { status?: 301 | 302 | 303 | 307 | 308 },
): (
  self: RouteSet<D, B, I>,
) => RouteSet<D, B, [...I, Route<{}, {}, "", never, never>]> {
  const route = make<{}, {}, "">(
    () =>
      Effect.succeed(
        Entity.make("", {
          status: options?.status ?? 302,
          headers: {
            location: url instanceof URL ? url.href : url,
          },
        }),
      ),
    { format: "*" },
  )

  return (self) =>
    set<D, B, [...I, Route<{}, {}, "", never, never>]>(
      [...items(self), route],
      descriptor(self),
    )
}

export {
  filter,
} from "./internal/RouteHook.ts"
export {
  link,
} from "./internal/RouteLink.ts"
export {
  make as map,
} from "./internal/RouteMap.ts"
export {
  del,
  get,
  head,
  options,
  patch,
  post,
  put,
  use,
} from "./internal/RouteMount.ts"
export {
  RequestBodyError,
  schemaBodyForm,
  schemaBodyJson,
  schemaBodyMultipart,
  schemaBodyUrlParams,
  schemaCookies,
  schemaError,
  schemaHeaders,
  schemaPathParams,
  schemaSearchParams,
  schemaSuccess,
} from "./internal/RouteSchema.ts"
export {
  ws,
} from "./internal/RouteSocket.ts"
export {
  sse,
} from "./internal/RouteSse.ts"

export class Routes extends Context.Tag("effect-start/Routes")<Routes, RouteMap.RouteMap>() {}

export function layer<const Input extends RouteMap.RouteMapInput>(
  routes: Input,
): Layer.Layer<Routes, never, RouteMap.Context<Input>> {
  return Layer.sync(Routes, () => RouteMap.make(routes)) as Layer.Layer<
    Routes,
    never,
    RouteMap.Context<Input>
  >
}

export function layerMerge<const Input extends RouteMap.RouteMapInput>(
  routes: Input,
): Layer.Layer<Routes, never, RouteMap.Context<Input>> {
  return Layer.effect(
    Routes,
    Effect.gen(function*() {
      const existing = yield* Effect.serviceOption(Routes).pipe(
        Effect.andThen(Option.getOrUndefined),
      )
      const map = RouteMap.make(routes)
      if (!existing) return map
      return RouteMap.merge(existing, map)
    }),
  ) as Layer.Layer<Routes, never, RouteMap.Context<Input>>
}

/**
 * Creates a route that short-curcits in development.
 *
 * Note that when we convert the routes to web handles in {@link import("./RouteHttp.ts")},
 * we exclude them altogeteher in non-dev environments.
 */
export function devOnly<D, B, I extends Route.Tuple>(
  self: RouteSet<D, B, I>,
): RouteSet<
  D,
  B,
  [...I, Route<{ dev: true }, { dev: true }, unknown, any, any>]
> {
  const route: Route<{ dev: true }, { dev: true }, unknown, any, any> = make<
    { dev: true },
    { dev: true },
    unknown,
    any,
    any
  >(
    (_context, next) =>
      Effect.flatMap(
        Development.option,
        (developmentOption) =>
          Option.isSome(developmentOption)
            ? Effect.succeed(next)
            : Effect.succeed(Entity.make("", { status: 404 })),
      ),
    { dev: true },
  )

  const nextItems: [
    ...I,
    Route<{ dev: true }, { dev: true }, unknown, any, any>,
  ] = [
    ...items(self),
    route,
  ]

  return set<
    D,
    B,
    [...I, Route<{ dev: true }, { dev: true }, unknown, any, any>]
  >(
    nextItems,
    descriptor(self),
  )
}

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

const Proto: RouteSet.Proto = {
  [TypeId]: TypeId,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
  *[Symbol.iterator](this: RouteSet.Any) {
    yield* items(this)
  },
}

/** @internal */
export function isRouteSet(input: unknown): input is RouteSet.Any {
  return Predicate.hasProperty(input, TypeId)
}

export function isRoute(input: unknown): input is Route {
  return isRouteSet(input) && Predicate.hasProperty(input, "handler")
}

/** @internal */
export function set<D = {}, B = {}, I extends Route.Tuple = []>(
  items: I = [] as unknown as I,
  descriptor: D = {} as D,
): RouteSet<D, B, I> {
  return Object.assign(Object.create(Proto), {
    [RouteItems]: items,
    [RouteDescriptor]: descriptor,
  }) as RouteSet<D, B, I>
}

export function make<D, B, A, E = never, R = never>(
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

export function describe<D extends {} = {}>(descriptor: D) {
  return set([], descriptor)
}

/** @internal */
export function items<T extends RouteSet.Data<any, any, any>>(
  self: T,
): RouteSet.Items<T> {
  return self[RouteItems]
}

/** @internal */
export function descriptor<T extends RouteSet.Data<any, any, any>>(
  self: T,
): T[typeof RouteDescriptor]
export function descriptor<E>(self: RouteSet.Data<any, any, any>): E
export function descriptor<T extends RouteSet.Data<any, any, any>>(
  self: Iterable<T>,
): Array<T[typeof RouteDescriptor]>
export function descriptor(
  self: RouteSet.Data<any, any, any> | Iterable<RouteSet.Data<any, any, any>>,
): object | Array<object> {
  if (RouteDescriptor in self) {
    return self[RouteDescriptor]
  }
  return [...self].map((r) => r[RouteDescriptor])
}

export type ExtractBindings<M extends Route.Tuple> = M extends [
  infer Head,
  ...infer Tail extends Route.Tuple,
] ? Head extends Route<any, infer B, any, any, any> ? ShallowMerge<B, ExtractBindings<Tail>>
  : ExtractBindings<Tail>
  : {}

// Shallow merge two object types.
// For overlapping keys, intersect the values.
type ShallowMerge<A, B> =
  & Omit<A, keyof B>
  & {
    [K in keyof B]: K extends keyof A ? A[K] & B[K] : B[K]
  }

export type ExtractContext<Items extends Route.Tuple, Descriptor> =
  & ExtractBindings<Items>
  & Descriptor

/**
 * Phantom marker for services that are provided automatically.
 * Routes may declare them as requirements, but they are stripped
 * from the R since they are provided by default when handling.
 * @internal
 */
export declare const IntrinsicService: unique symbol

export class Request extends Context.Tag("effect-start/Route/Request")<
  Request,
  globalThis.Request
>() {
  declare readonly [IntrinsicService]: never
}

/**
 * Context shared across handlers per request.
 *
 * @internal
 */
export class RouteContext extends Context.Reference<RouteContext>()("effect-start/RouteContext", {
  defaultValue: () => ({
    context: Object.freeze({}) as Record<string, unknown>,
  }),
}) {}
