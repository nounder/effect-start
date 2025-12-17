import type * as HttpMethod from "@effect/platform/HttpMethod"
import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"
import type * as Schema from "effect/Schema"
import * as RouteSet from "./RouteSet.ts"
import * as _schema from "./RouteSet_schema.ts"

export type Self =
  /**
   * Called as {@link RouteSet.RouteSet} method:
   *
   * @example
   * ```ts
   * let route: Route
   *
   * route.text("Hello")
   *
   * ```
   */
  | RouteSet.RouteSet.Default
  /**
   * Called as {@link RouteSet.RouteSet} with only schema, no handlers
   *
   * @example
   * ```ts
   * let route: Route
   *
   * route.schemaUrlParams({ id:
   *   Schema.Number()
   * })
   * ```
   */
  | RouteSet.RouteSet<
    [],
    RouteSchemas
  >
  /**
   * Called from namespaced import.
   *
   * @example
   * ```ts
   * import * as Route from "./Route.ts"
   *
   * Route.text("Hello")
   * ```
   */
  | Builder
  /**
   * Called directly from exported function. Don't do it.
   *
   * @example
   * ```ts
   * import { text } from "./Route.ts"
   *
   * text("Hello")
   * ```
   */
  | undefined

/**
 * Export all RouteSet builder functions.
 */
export * from "./RouteSet_builder.ts"

export type RouteMethod =
  | "*"
  | HttpMethod.HttpMethod

/**
 * Route kind determines the handler type and response format.
 * - "text": Plain text responses
 * - "html": HTML responses (can be string or JSX)
 * - "json": JSON responses
 * - "http": HTTP middleware that wraps other handlers
 */
export type RouteKind =
  | "text"
  | "html"
  | "json"
  | "http"

/**
 * A handler function that produces a raw value.
 * The value will be rendered to an HttpServerResponse by RouteRender
 * based on the route's media type.
 */
export type RouteHandler<
  A = unknown,
  E = any,
  R = any,
> = (
  context: RouteContext,
  next: RouteNext,
) => Effect.Effect<A, E, R>

export type RouteNext<
  A = unknown,
  E = unknown,
  R = unknown,
> = () => Effect.Effect<A, E, R>

type RouteContextDecoded = {
  readonly pathParams?: Record<string, any>
  readonly urlParams?: Record<string, any>
  readonly payload?: any
  readonly headers?: Record<string, any>
}

/**
 * Context passed to route handler functions.
 * Stable across handlers - does not change between middleware/handlers.
 *
 * @template {Input} Decoded schema values (pathParams, urlParams, etc.)
 */
export type RouteContext<
  Input extends RouteContextDecoded = {},
> =
  & {
    get url(): URL
    slots: Record<string, string>
  }
  & Input

export type RouteSchemas = {
  readonly PathParams?: Schema.Struct<any>
  readonly UrlParams?: Schema.Struct<any>
  readonly Payload?: Schema.Schema.Any
  readonly Success?: Schema.Schema.Any
  readonly Error?: Schema.Schema.Any
  readonly Headers?: Schema.Struct<any>
}

export namespace RouteSchemas {
  export type Empty = {
    readonly PathParams?: never
    readonly UrlParams?: never
    readonly Payload?: never
    readonly Success?: never
    readonly Error?: never
    readonly Headers?: never
  }
}

export interface Route<
  out Method extends RouteMethod = "*",
  out Kind extends RouteKind = "text",
  out Handler extends RouteHandler = RouteHandler,
  out Schemas extends RouteSchemas = RouteSchemas.Empty,
> extends
  RouteSet.RouteSet<[
    Route<Method, Kind, Handler, Schemas>,
  ]>
{
  readonly method: Method
  readonly kind: Kind
  readonly handler: Handler
  readonly schemas: Schemas
}

export namespace Route {
  export type Data<
    Method extends RouteMethod = RouteMethod,
    Kind extends RouteKind = RouteKind,
    Handler extends RouteHandler = RouteHandler,
    Schemas extends RouteSchemas = RouteSchemas.Empty,
  > = {
    readonly method: Method
    readonly kind: Kind
    readonly handler: Handler
    readonly schemas: Schemas
  }

  export type Default = Route<
    RouteMethod,
    RouteKind,
    RouteHandler,
    RouteSchemas
  >

  export type Tuple = readonly [Default, ...Default[]]

  export type Array = ReadonlyArray<Default>

  export type Error<T> = T extends RouteSet.RouteSet<infer Routes, any>
    ? Routes[number] extends Route<any, any, infer H, any>
      ? H extends RouteHandler<any, infer E, any> ? E : never
    : never
    : never

  export type Requirements<T> = T extends RouteSet.RouteSet<infer Routes, any>
    ? Routes[number] extends Route<any, any, infer H, any>
      ? H extends RouteHandler<any, any, infer R> ? R : never
    : never
    : never
}

type Builder = typeof import("./RouteSet_builder.ts")

export function make<
  Method extends RouteMethod = "*",
  Kind extends RouteKind = "text",
  Handler extends RouteHandler = never,
  Schemas extends RouteSchemas = RouteSchemas.Empty,
>(
  input: Route.Data<
    Method,
    Kind,
    Handler,
    Schemas
  >,
): Route<
  Method,
  Kind,
  Handler,
  Schemas
> {
  return Object.assign(
    Object.create(null),
    input,
  )
}

/**
 * Check if two routes match based on method and kind.
 * Returns true if both method and kind match, accounting for wildcards.
 * HTTP routes (kind="http") overlap with all other kinds.
 */
export function overlaps(
  a: Route.Default,
  b: Route.Default,
): boolean {
  const methodMatches = a.method === "*"
    || b.method === "*"
    || a.method === b.method

  const kindMatches = a.kind === "http"
    || b.kind === "http"
    || a.kind === b.kind

  return methodMatches && kindMatches
}

/**
 * Merge two RouteSets into one.
 * Combines route arrays.
 *
 * Rules:
 * - Multiple HTTP routes are allowed (they stack as middleware)
 * - Content routes with same method+kind are allowed (for route-level middleware)
 */
export function merge<
  RoutesA extends Route.Tuple,
  SchemasA extends RouteSchemas,
  RoutesB extends Route.Tuple,
  SchemasB extends RouteSchemas,
>(
  self: RouteSet.RouteSet<RoutesA, SchemasA>,
  other: RouteSet.RouteSet<RoutesB, SchemasB>,
): RouteSet.RouteSet<
  readonly [...RoutesA, ...RoutesB],
  _schema.MergeSchemas<SchemasA, SchemasB>
> {
  const combined = [
    ...RouteSet.items(self),
    ...RouteSet.items(other),
  ] as const
  const mergedSchemas = _schema.mergeSchemas(
    RouteSet.schemas(self),
    RouteSet.schemas(other),
  )

  return RouteSet.make(
    combined,
    mergedSchemas,
  )
}
