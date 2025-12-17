import type * as HttpMethod from "@effect/platform/HttpMethod"
import * as Route from "./Route.ts"
import * as RouteSet from "./RouteSet.ts"
import * as _schema from "./RouteSet_schema.ts"

export function makeMethodMaker<
  M extends HttpMethod.HttpMethod,
>(method: M) {
  return function<
    S extends Route.Self,
    T extends Route.Route.Tuple,
    InSchemas extends Route.RouteSchemas,
  >(
    this: S,
    routes: RouteSet.RouteSet<T, InSchemas>,
  ): S extends RouteSet.RouteSet<infer B, infer BaseSchemas>
    ? RouteSet.RouteSet<
      [
        ...B,
        ...{
          [K in keyof T]: T[K] extends Route.Route<
            infer _,
            infer Media,
            infer H,
            infer Schemas
          > ? Route.Route<
              M,
              Media,
              H,
              _schema.MergeSchemas<BaseSchemas, Schemas>
            >
            : T[K]
        },
      ],
      BaseSchemas
    >
    : RouteSet.RouteSet<
      {
        [K in keyof T]: T[K] extends Route.Route<
          infer _,
          infer Media,
          infer H,
          infer Schemas
        > ? Route.Route<
            M,
            Media,
            H,
            Schemas
          >
          : T[K]
      },
      InSchemas
    >
  {
    const baseRoutes = RouteSet.isRouteSet(this)
      ? RouteSet.items(this)
      : [] as const
    const baseSchema = RouteSet.isRouteSet(this)
      ? RouteSet.schemas(this)
      : {} as Route.RouteSchemas.Empty

    return RouteSet.make(
      [
        ...baseRoutes,
        ...RouteSet.items(routes).map(route => {
          return Route.make({
            ...route,
            method,
            schemas: _schema.mergeSchemas(baseSchema, route.schemas),
          })
        }),
      ],
      baseSchema,
    ) as never
  }
}
