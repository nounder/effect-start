import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Hyper from "../hyper/Hyper.ts"
import * as Values from "../Values.ts"
import type * as Route from "./Route.ts"
import * as _builder from "./RouteSet_builder.ts"
import * as _handler from "./RouteSet_handler.ts"
import * as _http from "./RouteSet_http.ts"
import * as _method from "./RouteSet_method.ts"
import * as _schema from "./RouteSet_schema.ts"

/**
 * Consists of function to build {@link RouteSet}.
 * This should include all exported functions in this module ({@link RouteModule})
 * that have `this` as {@link Self}.
 *
 * Method functions, like {@link post}, modify the method of existing routes.
 * Media functions, like {@link json}, create new routes with specific media type.
 */
type Builder = typeof _builder

export const TypeId: unique symbol = Symbol.for("effect-start/RouteSet")

export type RouteSet<
  M extends ReadonlyArray<Route.Route.Default>,
  Schemas extends Route.RouteSchemas = Route.RouteSchemas.Empty,
> =
  & Pipeable.Pipeable
  & Instance<M, Schemas>
  & {
    [TypeId]: typeof TypeId
  }
  & Builder

export type Instance<
  M extends ReadonlyArray<Route.Route.Default> = Route.Route.Tuple,
  Schemas extends Route.RouteSchemas = Route.RouteSchemas.Empty,
> = {
  set: M
  schema: Schemas
}

export type Default = RouteSet<Route.Route.Tuple, Route.RouteSchemas>

export type Proto =
  & {
    [TypeId]: typeof TypeId
  }
  & Builder

export const Proto = Object.assign(
  Object.create(null),
  {
    [TypeId]: TypeId,

    ..._builder,
  },
)

export function isRouteSet(
  input: unknown,
): input is Default {
  return Predicate.hasProperty(input, TypeId)
}

export function make<
  M extends ReadonlyArray<Route.Route.Default> = [],
  Schemas extends Route.RouteSchemas = Route.RouteSchemas.Empty,
>(
  routes: M = [] as unknown as M,
  schema: Schemas = {} as Schemas,
): RouteSet<M, Schemas> {
  return Object.assign(
    Object.create(Proto),
    {
      set: routes,
      schema,
    },
  ) as RouteSet<M, Schemas>
}

/**
 * Merge two RouteSets into one.
 * Combines route arrays.
 *
 * Rules:
 * - Multiple HttpMiddleware routes are allowed (they stack)
 * - Content routes with same method+media are allowed (for route-level middleware)
 */
export function merge<
  RoutesA extends ReadonlyArray<Route.Route.Default>,
  SchemasA extends Route.RouteSchemas,
  RoutesB extends ReadonlyArray<Route.Route.Default>,
  SchemasB extends Route.RouteSchemas,
>(
  self: RouteSet<RoutesA, SchemasA>,
  other: RouteSet<RoutesB, SchemasB>,
): RouteSet<
  readonly [...RoutesA, ...RoutesB],
  _schema.MergeSchemas<SchemasA, SchemasB>
> {
  const combined = [...self.set, ...other.set]
  const mergedSchemas = _schema.mergeSchemas(self.schema, other.schema)
  return make(
    combined as unknown as readonly [...RoutesA, ...RoutesB],
    mergedSchemas,
  )
}
