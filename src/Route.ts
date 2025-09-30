import * as HttpMethod from "@effect/platform/HttpMethod"
import * as HttpServerRespondable from "@effect/platform/HttpServerRespondable"
import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

export const TypeId: unique symbol = Symbol.for("effect-start/Route")

export type TypeId = typeof TypeId

export type RouteMethod =
  | HttpMethod.HttpMethod
  | "*"

export type RoutePath = `/${string}`

type ContentType =
  | "text/html"
  | "text/plain"
  | "application/json"

interface RouteVariant<
  Method extends RouteMethod,
  Type extends "*" | ContentType,
  A extends HttpServerRespondable.Respondable,
  E extends any,
  R extends any,
> {
  method: Method
  type: Type
  handler: Effect.Effect<A, E, R>
}

type RouteVariantArray = ReadonlyArray<
  RouteVariant<
    "*",
    "*",
    any,
    any,
    any
  >
>

export namespace RouteVariance {
  export type Method<
    T extends RouteVariantArray,
  > = T[number]["method"]
  export type Success<
    T extends RouteVariantArray,
  > = T[number]["handler"] extends Effect.Effect<infer A, any, any> ? A : never
  export type Error<
    T extends RouteVariantArray,
  > = T[number]["handler"] extends Effect.Effect<any, infer E, any> ? E : never
  export type Requirements<
    T extends RouteVariantArray,
  > = T[number]["handler"] extends Effect.Effect<any, any, infer R> ? R : never
}

interface RouteSchema<
  in out PathParams = Schema.Schema.Any,
  in out UrlParams = Schema.Schema.Any,
  in out Payload = Schema.Schema.Any,
  in out Headers = Schema.Schema.Any,
  in out Success = Schema.Schema.Any,
  in out Error = Schema.Schema.Any,
> {
  pathParams: PathParams
  urlParams: UrlParams
  payload: Payload
  headers: Headers
  success: Success
  error: Error
}

export interface Route<
  out Path = RoutePath,
  in out Variants = RouteVariantArray,
  in out Schema extends RouteSchema = RouteSchema,
  out R = any,
> {
  readonly [TypeId]: TypeId

  readonly path: Path
  readonly variants: Variants
  readonly schema: Schema
}

export namespace Route {
  export type Impl = Omit<Route, TypeId | "pipe">
}

const Proto = {
  [TypeId]: TypeId,

  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
}

function make<T extends Route.Impl>(
  route: T,
): Route<T["path"], T["variants"], T["schema"]> {
  return Object.assign(
    Object.create(Proto),
    route,
  )
}

const RouteSchemaDefaults: RouteSchema = {
  pathParams: Schema.Any,
  urlParams: Schema.Any,
  payload: Schema.Any,
  headers: Schema.Any,
  success: Schema.Any,
  error: Schema.Any,
}

export const empty = make(
  {
    path: "/",
    variants: [],
    schema: RouteSchemaDefaults,
  } as const,
)

export const schema = <
  Schema extends RouteSchema,
  PathParams extends Schema.Schema.Any,
  UrlParams extends Schema.Schema.Any,
  Payload extends Schema.Schema.Any,
  Headers extends Schema.Schema.Any,
  Success extends Schema.Schema.Any,
  Error extends Schema.Schema.Any,
>(
  schema: {
    pathParams?: PathParams
    urlParams?: UrlParams
    payload?: Payload
    headers?: Headers
    success?: Success
    error?: Error
  },
) =>
<
  Path extends RoutePath,
  Variants extends RouteVariantArray,
>(
  self: Route<Path, Variants, Schema>,
) => {
  return make({
    ...self,
    schema: {
      pathParams: (schema.pathParams ?? self.schema.pathParams) as (
        PathParams extends never ? typeof self.schema.pathParams
          : PathParams
      ),
      urlParams: (schema.urlParams ?? self.schema.urlParams) as (
        UrlParams extends never ? typeof self.schema.urlParams
          : UrlParams
      ),
      payload: (schema.payload ?? self.schema.payload) as (
        Payload extends never ? typeof self.schema.payload
          : Payload
      ),
      headers: (schema.headers ?? self.schema.headers) as (
        Headers extends never ? typeof self.schema.headers
          : Headers
      ),
      success: (schema.success ?? self.schema.success) as (
        Success extends never ? typeof self.schema.success
          : Success
      ),
      error: (schema.error ?? self.schema.error) as (
        Error extends never ? typeof self.schema.error
          : Error
      ),
    },
  })
}

export function isRoute(
  input: unknown,
): input is Route {
  return Predicate.hasProperty(input, TypeId)
}

export function isBounded(
  input: unknown,
): input is Route {
  return isRoute(input)
    && input.path !== "/"
}

export const handle = (
  effect: Effect.Effect<HttpServerRespondable.Respondable, any, any>,
) =>
(self: Route) => {
}

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json }

export const data = (
  effect: Effect.Effect<Json, any, any>,
) =>
(self: Route) => {
  return make({
    ...self,
    variants: [
      ...self.variants,
      {
        method: "GET",
        type: "application/json",
        handler: effect,
      },
    ],
  })
}

export const text = (
  effect: Effect.Effect<string, any, any>,
) =>
(self: Route) => {
  return make({
    ...self,
    variants: [
      ...self.variants,
      {
        method: "GET",
        type: "application/json",
        handler: effect,
      },
    ],
  })
}
