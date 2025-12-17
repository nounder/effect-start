import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import type * as Route from "./Route.ts"
import * as _builder from "./RouteSet_builder.ts"

const RouteSetItems: unique symbol = Symbol()
const RouteSetSchemas: unique symbol = Symbol()

/**
 * Consists of function to build {@link RouteSet}.
 * This should include all exported functions in this module ({@link RouteModule})
 * that have `this` as {@link Route.Self}.
 *
 * Method functions, like {@link post}, modify the method of existing routes.
 * Media functions, like {@link json}, create new routes with specific media type.
 */
type Builder = typeof _builder

export const TypeId: unique symbol = Symbol.for("effect-start/RouteSet")

export type RouteSet<
  M extends Route.Route.Array,
  Schemas extends Route.RouteSchemas = Route.RouteSchemas.Empty,
> =
  & Pipeable.Pipeable
  & RouteSet.Data<M, Schemas>
  & {
    [TypeId]: typeof TypeId
  }
  & Builder

export namespace RouteSet {
  export type Data<
    M extends Route.Route.Array = [],
    Schemas extends Route.RouteSchemas = Route.RouteSchemas.Empty,
  > = {
    [RouteSetItems]: M
    [RouteSetSchemas]: Schemas
  }

  export type Default = RouteSet<
    Route.Route.Tuple,
    Route.RouteSchemas
  >

  export type Proto =
    & Pipeable.Pipeable
    & {
      [TypeId]: typeof TypeId
    }
    & Builder

  export type Items<T extends Data<any, any>> = T extends Data<infer M, any> ? M
    : never
  export type Schemas<T extends Data<any, any>> = T extends Data<any, infer S>
    ? S
    : never
}

export const Proto: RouteSet.Proto = Object.assign(
  Object.create(null),
  {
    [TypeId]: TypeId,

    ..._builder,
  } satisfies RouteSet.Proto,
)

export function isRouteSet(
  input: unknown,
): input is RouteSet.Default {
  return Predicate.hasProperty(input, TypeId)
}

export function make<
  M extends Route.Route.Array = [],
  Schemas extends Route.RouteSchemas = Route.RouteSchemas.Empty,
>(
  routes: M = [] as unknown as M,
  schemas: Schemas = {} as Schemas,
): RouteSet<M, Schemas> {
  return Object.assign(
    Object.create(Proto),
    {
      [RouteSetItems]: routes,
      [RouteSetSchemas]: schemas,
    },
  ) as RouteSet<M, Schemas>
}

export function items<T extends RouteSet.Data<any, any>>(
  self: T,
): RouteSet.Items<T> {
  return self[RouteSetItems]
}

export function schemas<T extends RouteSet.Data<any, any>>(
  self: T,
): RouteSet.Schemas<T> {
  return self[RouteSetSchemas]
}
