import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Hyper from "./Hyper.ts"
import type * as Route from "./Route.ts"
import * as _builder from "./RouteSet_builder.ts"
import * as _handler from "./RouteSet_handler.ts"
import * as _http from "./RouteSet_http.ts"
import * as _method from "./RouteSet_method.ts"
import * as _schema from "./RouteSet_schema.ts"
import * as Values from "./Values.ts"

/**
 * Consists of function to build {@link RouteSet}.
 * This should include all exported functions in this module ({@link RouteModule})
 * that have `this` as {@link Self}.
 *
 * Method functions, like {@link post}, modify the method of existing routes.
 * Media functions, like {@link json}, create new routes with specific media type.
 */
type Builder = typeof _builder

export const schemaPathParams = _schema.makeSingleSchemaModifier("PathParams")
export const schemaUrlParams = _schema.makeMultiSchemaModifier("UrlParams")
export const schemaHeaders = _schema.makeMultiSchemaModifier("Headers")
export const schemaPayload = _schema.makeUnionSchemaModifier("Payload")
export const schemaSuccess = _schema.makeUnionSchemaModifier("Success")
export const schemaError = _schema.makeUnionSchemaModifier("Error")

export const post = _method.makeMethodMaker("POST")
export const get = _method.makeMethodMaker("GET")
export const put = _method.makeMethodMaker("PUT")
export const patch = _method.makeMethodMaker("PATCH")
export const options = _method.makeMethodMaker("OPTIONS")
export const head = _method.makeMethodMaker("HEAD")
export const del = _method.makeMethodMaker("DELETE")

export const text = _handler.makeHandlerMaker<"GET", "text/plain", string>(
  "GET",
  "text/plain",
)
export const html = _handler.makeHandlerMaker<
  "GET",
  "text/html",
  string | Hyper.GenericJsxObject
>(
  "GET",
  "text/html",
)
export const json = _handler.makeHandlerMaker<
  "GET",
  "application/json",
  Values.Json
>(
  "GET",
  "application/json",
)

export const http = _http.http

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

    post,
    get,
    put,
    patch,
    del,
    delete: del,
    options,
    head,

    text,
    html,
    json,
    http,

    schemaPathParams,
    schemaUrlParams,
    schemaPayload,
    schemaSuccess,
    schemaError,
    schemaHeaders,
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
