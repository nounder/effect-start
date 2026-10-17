import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import type * as Multipart from "effect/http/Multipart"
import type * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"
import type * as Types from "effect/Types"
import * as Entity from "../Entity.ts"
import * as Route from "../Route.ts"
import * as PathPattern from "./PathPattern.ts"
import * as RouteHook from "./RouteHook.ts"

export class RequestBodyError extends Data.TaggedError("RequestBodyError")<{
  readonly reason:
    | "JsonError"
    | "UrlParamsError"
    | "MultipartError"
    | "FormDataError"
  readonly cause: unknown
}> {}

type SchemaOrFields = Schema.Constraint | Schema.Struct.Fields

function isFields(input: unknown): input is Schema.Struct.Fields {
  if (typeof input !== "object" || input === null) return false
  for (const value of Object.values(input)) {
    if (!Schema.isSchema(value)) return false
  }
  return true
}

function toSchema(input: SchemaOrFields): Schema.ConstraintCodec<any, any, any, any> {
  if (Schema.isSchema(input)) return input
  if (isFields(input)) return Schema.Struct(input)
  throw new TypeError("Expected a schema or schema fields")
}

function makeSchemaFilter(
  binding: "headers" | "cookies" | "searchParams" | "body",
  decode: Effect.Effect<any, any, any>,
): any {
  return RouteHook.filter((ctx: any) =>
    Effect.map(decode, (parsed) => ({
      context: { [binding]: { ...ctx[binding], ...parsed } },
    }))
  )
}

export function schemaHeaders<F extends Schema.Struct.Fields>(
  fields: F,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { headers: Types.Simplify<Schema.Struct.Type<F>> },
      unknown,
      Schema.SchemaError,
      Schema.Struct.DecodingServices<F> | HttpServerRequest.HttpServerRequest
    >,
  ]
>
export function schemaHeaders<
  A,
  R,
>(
  fields: Schema.ConstraintDecoder<A, R>,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { headers: A },
      unknown,
      Schema.SchemaError,
      R | HttpServerRequest.HttpServerRequest
    >,
  ]
>
export function schemaHeaders(fields: SchemaOrFields) {
  return makeSchemaFilter("headers", HttpServerRequest.schemaHeaders(toSchema(fields)))
}

export function schemaCookies<F extends Schema.Struct.Fields>(
  fields: F,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { cookies: Types.Simplify<Schema.Struct.Type<F>> },
      unknown,
      Schema.SchemaError,
      Schema.Struct.DecodingServices<F> | HttpServerRequest.HttpServerRequest
    >,
  ]
>
export function schemaCookies<
  A,
  R,
>(
  fields: Schema.ConstraintDecoder<A, R>,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { cookies: A },
      unknown,
      Schema.SchemaError,
      R | HttpServerRequest.HttpServerRequest
    >,
  ]
>
export function schemaCookies(fields: SchemaOrFields) {
  return makeSchemaFilter("cookies", HttpServerRequest.schemaCookies(toSchema(fields)))
}

export function schemaSearchParams<F extends Schema.Struct.Fields>(
  fields: F,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { searchParams: Types.Simplify<Schema.Struct.Type<F>> },
      unknown,
      Schema.SchemaError,
      Schema.Struct.DecodingServices<F> | HttpServerRequest.ParsedSearchParams
    >,
  ]
>
export function schemaSearchParams<
  A,
  R,
>(
  fields: Schema.ConstraintDecoder<A, R>,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { searchParams: A },
      unknown,
      Schema.SchemaError,
      R | HttpServerRequest.ParsedSearchParams
    >,
  ]
>
export function schemaSearchParams(fields: SchemaOrFields) {
  return makeSchemaFilter("searchParams", HttpServerRequest.schemaSearchParams(toSchema(fields)))
}

export function schemaPathParams<F extends Schema.Struct.Fields>(
  fields: F,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { pathParams: Types.Simplify<Schema.Struct.Type<F>> },
      unknown,
      Schema.SchemaError,
      Schema.Struct.DecodingServices<F> | HttpServerRequest.HttpServerRequest
    >,
  ]
>
export function schemaPathParams<
  A,
  R,
>(
  fields: Schema.ConstraintDecoder<A, R>,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { pathParams: A },
      unknown,
      Schema.SchemaError,
      R | HttpServerRequest.HttpServerRequest
    >,
  ]
>
export function schemaPathParams(fields: SchemaOrFields) {
  const decode = Schema.decodeUnknownEffect(toSchema(fields))
  return RouteHook.filter((ctx: any) =>
    Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const url = new URL(request.url, "http://localhost")
      const pattern = ctx.path ?? "/"
      const params = PathPattern.match(pattern, url.pathname) ?? {}
      const parsed = yield* decode(params)
      return { context: { pathParams: { ...ctx.pathParams, ...parsed } } }
    })
  )
}

export function schemaBodyJson<F extends Schema.Struct.Fields>(
  fields: F,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { body: Types.Simplify<Schema.Struct.Type<F>> },
      unknown,
      RequestBodyError | Schema.SchemaError,
      Schema.Struct.DecodingServices<F> | HttpServerRequest.HttpServerRequest
    >,
  ]
>
export function schemaBodyJson<A, R>(
  fields: Schema.ConstraintDecoder<A, R>,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { body: A },
      unknown,
      RequestBodyError | Schema.SchemaError,
      R | HttpServerRequest.HttpServerRequest
    >,
  ]
>
export function schemaBodyJson(fields: SchemaOrFields) {
  return makeSchemaFilter(
    "body",
    HttpServerRequest.schemaBodyJson(toSchema(fields)).pipe(
      Effect.catchTag("HttpServerError", (cause) => Effect.fail(new RequestBodyError({ reason: "JsonError", cause }))),
    ),
  )
}

export function schemaBodyUrlParams<F extends Schema.Struct.Fields>(
  fields: F,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { body: Types.Simplify<Schema.Struct.Type<F>> },
      unknown,
      RequestBodyError | Schema.SchemaError,
      Schema.Struct.DecodingServices<F> | HttpServerRequest.HttpServerRequest
    >,
  ]
>
export function schemaBodyUrlParams<
  A,
  R,
>(
  fields: Schema.ConstraintDecoder<A, R>,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { body: A },
      unknown,
      RequestBodyError | Schema.SchemaError,
      R | HttpServerRequest.HttpServerRequest
    >,
  ]
>
export function schemaBodyUrlParams(fields: SchemaOrFields) {
  return makeSchemaFilter(
    "body",
    HttpServerRequest.schemaBodyUrlParams(toSchema(fields)).pipe(
      Effect.catchTag(
        "HttpServerError",
        (cause) => Effect.fail(new RequestBodyError({ reason: "UrlParamsError", cause })),
      ),
    ),
  )
}

export function schemaBodyMultipart<F extends Schema.Struct.Fields>(
  fields: F,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { body: Types.Simplify<Schema.Struct.Type<F>> },
      unknown,
      RequestBodyError | Schema.SchemaError,
      | Schema.Struct.DecodingServices<F>
      | HttpServerRequest.HttpServerRequest
      | Scope.Scope
      | FileSystem.FileSystem
      | Path.Path
    >,
  ]
>
export function schemaBodyMultipart<
  A,
  I extends Partial<
    Record<
      string,
      ReadonlyArray<Multipart.PersistedFile | string> | string
    >
  >,
  R,
>(
  fields: Schema.ConstraintCodec<A, I, R, unknown>,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { body: A },
      unknown,
      RequestBodyError | Schema.SchemaError,
      R | HttpServerRequest.HttpServerRequest | Scope.Scope | FileSystem.FileSystem | Path.Path
    >,
  ]
>
export function schemaBodyMultipart(fields: SchemaOrFields) {
  return makeSchemaFilter(
    "body",
    HttpServerRequest.schemaBodyMultipart(toSchema(fields)).pipe(
      Effect.catchTag(
        "MultipartError",
        (cause) => Effect.fail(new RequestBodyError({ reason: "MultipartError", cause })),
      ),
    ),
  )
}

export function schemaBodyForm<F extends Schema.Struct.Fields>(
  fields: F,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { body: Types.Simplify<Schema.Struct.Type<F>> },
      unknown,
      RequestBodyError | Schema.SchemaError,
      | Schema.Struct.DecodingServices<F>
      | HttpServerRequest.HttpServerRequest
      | Scope.Scope
      | FileSystem.FileSystem
      | Path.Path
    >,
  ]
>
export function schemaBodyForm<
  A,
  I extends Partial<
    Record<
      string,
      ReadonlyArray<Multipart.PersistedFile | string> | string
    >
  >,
  R,
>(
  fields: Schema.ConstraintCodec<A, I, R, unknown>,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      { body: A },
      unknown,
      RequestBodyError | Schema.SchemaError,
      R | HttpServerRequest.HttpServerRequest | Scope.Scope | FileSystem.FileSystem | Path.Path
    >,
  ]
>
export function schemaBodyForm(fields: SchemaOrFields) {
  return makeSchemaFilter(
    "body",
    HttpServerRequest.schemaBodyForm(toSchema(fields)).pipe(
      Effect.catchTags({
        HttpServerError: (cause) => Effect.fail(new RequestBodyError({ reason: "UrlParamsError", cause })),
        MultipartError: (cause) => Effect.fail(new RequestBodyError({ reason: "FormDataError", cause })),
      }),
    ),
  )
}

/**
 * Intercepts typed errors from downstream handlers, encodes them through the
 * schema, and returns a JSON response with the given status code.
 *
 * Without `schemaError`, handler errors fall through to global catch during
 * execution of request. `schemaError` short circuts error handling by
 * return an error response immedietly.
 *
 * TODO: store the errors in runtime to enable generating OpenAPI and other
 * goodies.
 */
export function schemaError<A, I, R>(
  schema: Schema.Schema<A> & Schema.ConstraintEncoder<I, R> & { readonly status: number },
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<D, SB, [...P, Route.Route<{}, {}, unknown, never, R>]>
export function schemaError<A, I, R>(
  schema: Schema.Schema<A> & Schema.ConstraintEncoder<I, R>,
  options: { readonly status: number },
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<D, SB, [...P, Route.Route<{}, {}, unknown, never, R>]>
export function schemaError<A, I, R>(
  schema: Schema.Schema<A> & Schema.ConstraintEncoder<I, R> & { readonly status?: number },
  options?: { readonly status: number },
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<D, SB, [...P, Route.Route<{}, {}, unknown, never, R>]> {
  const status = options?.status ?? (schema as any).status
  if (typeof status !== "number") {
    throw new Error(
      "schemaError: status is required either via options or as a static property on the schema",
    )
  }
  const encode = Schema.encodeEffect(schema)
  const is = Schema.is(schema)
  return function<D, SB, P extends Route.Route.Tuple>(
    self: Route.RouteSet<D, SB, P>,
  ): Route.RouteSet<D, SB, [...P, Route.Route<{}, {}, unknown, never, R>]> {
    const route = Route.make<{}, {}, unknown, never, R>((_context, next) =>
      Entity.resolve(next).pipe(
        Effect.catchIf(
          is,
          (error) => Effect.map(Effect.orDie(encode(error)), (encoded) => Entity.make(encoded, { status })),
        ),
      )
    )

    const items: [...P, Route.Route<{}, {}, unknown, never, R>] = [
      ...Route.items(self),
      route,
    ]

    return Route.set(items, Route.descriptor(self))
  }
}

export function schemaSuccess<F extends Schema.Struct.Fields>(
  fields: F,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route<
      {},
      {},
      Types.Simplify<Schema.Struct.Encoded<F>>,
      Schema.SchemaError,
      Schema.Struct.EncodingServices<F>
    >,
  ]
>
export function schemaSuccess<A, I, R>(
  schema: Schema.Schema<A> & Schema.ConstraintEncoder<I, R>,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [...P, Route.Route<{}, {}, I, Schema.SchemaError, R>]
>
export function schemaSuccess(
  schema: SchemaOrFields,
): any {
  const s = toSchema(schema)
  const encode = Schema.encodeUnknownEffect(s)
  return function(self: Route.RouteSet<any, any, any>) {
    const route = Route.make((_context: any, next: any) =>
      Effect.flatMap(
        Entity.resolve(next),
        (entity) =>
          Effect.map(encode(entity.body), (encoded) =>
            Entity.make(encoded, {
              status: entity.status,
              headers: entity.headers,
              url: entity.url,
            })),
      )
    )

    const items = [
      ...Route.items(self),
      route,
    ]

    return Route.set(items as any, Route.descriptor(self))
  }
}
