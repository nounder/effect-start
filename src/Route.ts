import * as HttpMethod from "@effect/platform/HttpMethod"
import * as HttpServerRespondable from "@effect/platform/HttpServerRespondable"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

export const TypeId: unique symbol = Symbol.for("effect-start/Route")

export type TypeId = typeof TypeId

export type RouteMethod =
  | "*"
  | HttpMethod.HttpMethod

export type RoutePath = `/${string}`

type ContentType =
  | "*"
  | "text/plain"
  | "text/html"
  | "application/json"

type RouteHandler<A, E, R> = Effect.Effect<
  {
    [HttpServerRespondable.symbol]: Effect.Effect<
      HttpServerResponse.HttpServerResponse,
      E,
      R
    >
    raw: A
  },
  E,
  R
>

interface RouteVariant<
  Method extends RouteMethod | "*",
  Type extends ContentType | "*",
  A,
  E extends any,
  R extends any,
> {
  method: Method
  type: Type
  handler: Effect.Effect<
    {
      [HttpServerRespondable.symbol]: Effect.Effect<
        HttpServerResponse.HttpServerResponse,
        E,
        R
      >
      raw: A
    },
    E,
    R
  >
}

type RouteVariantArray = Array<
  RouteVariant<RouteMethod, ContentType, any, any, any>
>

export namespace RouteVariance {
  export type Method<T extends RouteVariantArray> = T[number]["method"]
  export type Success<T extends RouteVariantArray> =
    T[number]["handler"] extends Effect.Effect<infer A, any, any> ? A : never
  export type Error<T extends RouteVariantArray> = T[number]["handler"] extends
    Effect.Effect<any, infer E, any> ? E : never
  export type Requirements<T extends RouteVariantArray> =
    T[number]["handler"] extends Effect.Effect<any, any, infer R> ? R : never
}

interface RouteSchema<
  in out PathParams extends Schema.Schema.Any = Schema.Schema.Any,
  in out UrlParams extends Schema.Schema.Any = Schema.Schema.Any,
  in out Payload extends Schema.Schema.Any = Schema.Schema.Any,
  in out Headers extends Schema.Schema.Any = Schema.Schema.Any,
  in out Success extends Schema.Schema.Any = Schema.Schema.Any,
  in out Error extends Schema.Schema.Any = Schema.Schema.Any,
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
  [TypeId]: TypeId

  path: Path
  variants: Variants
  schema: Schema
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
  return Object.assign(Object.create(Proto), route)
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
  PathParams extends Schema.Schema.Any,
  UrlParams extends Schema.Schema.Any,
  Payload extends Schema.Schema.Any,
  Headers extends Schema.Schema.Any,
  Success extends Schema.Schema.Any,
  Error extends Schema.Schema.Any,
>(
  schema: Partial<
    RouteSchema<
      PathParams,
      UrlParams,
      Payload,
      Headers,
      Success,
      Error
    >
  >,
) =>
<Path extends RoutePath, Variants extends RouteVariantArray>(
  self: Route<
    Path,
    Variants,
    RouteSchema
  >,
) => {
  // type casts below is very verbose but without them
  // TS cannot properly infer the types.
  return make({
    ...self,
    schema: {
      pathParams: (schema.pathParams
        ?? self.schema.pathParams) as PathParams extends never
          ? typeof self.schema.pathParams
          : PathParams,
      urlParams: (schema.urlParams
        ?? self.schema.urlParams) as UrlParams extends never
          ? typeof self.schema.urlParams
          : UrlParams,
      payload: (schema.payload
        ?? self.schema.payload) as Payload extends never
          ? typeof self.schema.payload
          : Payload,
      headers: (schema.headers
        ?? self.schema.headers) as Headers extends never
          ? typeof self.schema.headers
          : Headers,
      success: (schema.success
        ?? self.schema.success) as Success extends never
          ? typeof self.schema.success
          : Success,
      error: (schema.error ?? self.schema.error) as Error extends never
        ? typeof self.schema.error
        : Error,
    },
  })
}

export function isRoute(input: unknown): input is Route {
  return Predicate.hasProperty(input, TypeId)
}

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json }
export function json<
  A extends Json,
  E = any,
  R = any,
>(
  effect: Effect.Effect<A, E, R>,
) {
  return function<
    Path extends RoutePath,
    Variants extends RouteVariantArray,
    Schema extends RouteSchema,
  >(
    self: Route<Path, Variants, Schema>,
  ) {
    const variant = {
      method: "GET",
      type: "application/json",
      handler: Effect.gen(function*() {
        const raw = yield* effect
        const response = HttpServerResponse.unsafeJson(raw)

        return {
          [HttpServerRespondable.symbol]: Effect.succeed(response),
          raw,
        }
      }) as RouteHandler<A, E, R>,
    } satisfies RouteVariant<
      "GET",
      "application/json",
      A,
      E,
      R
    >

    return make(
      {
        ...self,
        variants: [
          ...self.variants,
          variant,
        ],
      } as const,
    )
  }
}

export function text<
  A extends string,
  E = any,
  R = any,
>(
  effect: Effect.Effect<
    A,
    E,
    R
  >,
) {
  return function(self: Route) {
    const variant = {
      method: "GET",
      type: "text/plain",
      handler: Effect.gen(function*() {
        const raw = yield* effect
        const response = HttpServerResponse.text(raw)

        return {
          [HttpServerRespondable.symbol]: Effect.succeed(response),
          raw,
        }
      }),
    } satisfies RouteVariant<
      "GET",
      "text/plain",
      A,
      E,
      R
    >

    return make(
      {
        ...self,
        variants: [
          ...self.variants,
          variant,
        ],
      } as const,
    )
  }
}

export function html<
  A extends string,
  E = any,
  R = any,
>(
  effect: Effect.Effect<
    A,
    E,
    R
  >,
) {
  return function(self: Route) {
    const variant = {
      method: "GET",
      type: "text/plain",
      handler: Effect.gen(function*() {
        const raw = yield* effect
        const response = HttpServerResponse.text(raw)

        return {
          [HttpServerRespondable.symbol]: Effect.succeed(response),
          raw,
        }
      }),
    } satisfies RouteVariant<
      "GET",
      "text/plain",
      A,
      E,
      R
    >

    return make(
      {
        ...self,
        variants: [
          ...self.variants,
          variant,
        ],
      } as const,
    )
  }
}

export function post(
  self: Route<
    RoutePath,
    RouteVariantArray,
    RouteSchema
  >,
) {
  return make({
    ...self,
    variants: self.variants.map(v => {
      return {
        ...v,
        method: "POST",
      }
    }),
  })
}
