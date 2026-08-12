import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import type * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"
import type * as Types from "effect/Types"
import * as Entity from "../Entity.ts"
import type * as Multipart from "../Multipart.ts"
import * as Route from "../Route.ts"
import * as Http from "./Http.ts"
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

type SchemaOrFields = Schema.Schema.All | Schema.Struct.Fields

function toSchema(input: SchemaOrFields): Schema.Schema<any, any, any> {
  return (Schema.isSchema(input) ? input : Schema.Struct(input as any)) as any
}

function makeSchemaFilter(
  handler: (
    ctx: any,
    decode: (input: unknown) => Effect.Effect<any, any, any>,
  ) => Effect.Effect<any, any, any>,
) {
  return (fields: SchemaOrFields): any => {
    const decode = Schema.decodeUnknown(toSchema(fields))
    return RouteHook.filter((ctx: any) => handler(ctx, decode))
  }
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
      ParseResult.ParseError,
      Schema.Struct.Context<F> | Route.Request
    >,
  ]
>
export function schemaHeaders<
  A,
  I extends Readonly<Record<string, string | undefined>>,
  R,
>(
  fields: Schema.Schema<A, I, R>,
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
      ParseResult.ParseError,
      R | Route.Request
    >,
  ]
>
export function schemaHeaders(fields: SchemaOrFields) {
  return makeSchemaFilter((ctx, decode) =>
    Effect.gen(function*() {
      const request = yield* Route.Request
      const parsed = yield* decode(Http.mapHeaders(request.headers))
      return { context: { headers: { ...ctx.headers, ...parsed } } }
    })
  )(fields)
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
      ParseResult.ParseError,
      Schema.Struct.Context<F> | Route.Request
    >,
  ]
>
export function schemaCookies<
  A,
  I extends Readonly<Record<string, string | undefined>>,
  R,
>(
  fields: Schema.Schema<A, I, R>,
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
      ParseResult.ParseError,
      R | Route.Request
    >,
  ]
>
export function schemaCookies(fields: SchemaOrFields) {
  return makeSchemaFilter((ctx, decode) =>
    Effect.gen(function*() {
      const request = yield* Route.Request
      const parsed = yield* decode(
        Http.parseCookies(request.headers.get("cookie")),
      )
      return { context: { cookies: { ...ctx.cookies, ...parsed } } }
    })
  )(fields)
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
      ParseResult.ParseError,
      Schema.Struct.Context<F> | Route.Request
    >,
  ]
>
export function schemaSearchParams<
  A,
  I extends Readonly<
    Record<string, string | ReadonlyArray<string> | undefined>
  >,
  R,
>(
  fields: Schema.Schema<A, I, R>,
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
      ParseResult.ParseError,
      R | Route.Request
    >,
  ]
>
export function schemaSearchParams(fields: SchemaOrFields) {
  return makeSchemaFilter((ctx, decode) =>
    Effect.gen(function*() {
      const request = yield* Route.Request
      const url = new URL(request.url)
      const parsed = yield* decode(Http.mapUrlSearchParams(url.searchParams))
      return { context: { searchParams: { ...ctx.searchParams, ...parsed } } }
    })
  )(fields)
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
      ParseResult.ParseError,
      Schema.Struct.Context<F> | Route.Request
    >,
  ]
>
export function schemaPathParams<
  A,
  I extends Readonly<Record<string, string | undefined>>,
  R,
>(
  fields: Schema.Schema<A, I, R>,
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
      ParseResult.ParseError,
      R | Route.Request
    >,
  ]
>
export function schemaPathParams(fields: SchemaOrFields) {
  return makeSchemaFilter((ctx, decode) =>
    Effect.gen(function*() {
      const request = yield* Route.Request
      const url = new URL(request.url)
      const pattern = ctx.path ?? "/"
      const params = PathPattern.match(pattern, url.pathname) ?? {}
      const parsed = yield* decode(params)
      return { context: { pathParams: { ...ctx.pathParams, ...parsed } } }
    })
  )(fields)
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
      RequestBodyError | ParseResult.ParseError,
      Schema.Struct.Context<F> | Route.Request
    >,
  ]
>
export function schemaBodyJson<A, I, R>(
  fields: Schema.Schema<A, I, R>,
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
      RequestBodyError | ParseResult.ParseError,
      R | Route.Request
    >,
  ]
>
export function schemaBodyJson(fields: SchemaOrFields) {
  return makeSchemaFilter((ctx, decode) =>
    Effect.gen(function*() {
      const request = yield* Route.Request
      const json = yield* Effect.tryPromise({
        try: () => request.json(),
        catch: (cause) => new RequestBodyError({ reason: "JsonError", cause }),
      })
      const parsed = yield* decode(json)
      return { context: { body: { ...ctx.body, ...parsed } } }
    })
  )(fields)
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
      RequestBodyError | ParseResult.ParseError,
      Schema.Struct.Context<F> | Route.Request
    >,
  ]
>
export function schemaBodyUrlParams<
  A,
  I extends Readonly<
    Record<string, string | ReadonlyArray<string> | undefined>
  >,
  R,
>(
  fields: Schema.Schema<A, I, R>,
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
      RequestBodyError | ParseResult.ParseError,
      R | Route.Request
    >,
  ]
>
export function schemaBodyUrlParams(fields: SchemaOrFields) {
  return makeSchemaFilter((ctx, decode) =>
    Effect.gen(function*() {
      const request = yield* Route.Request
      const text = yield* Effect.tryPromise({
        try: () => request.text(),
        catch: (cause) => new RequestBodyError({ reason: "UrlParamsError", cause }),
      })
      const params = new URLSearchParams(text)
      const parsed = yield* decode(Http.mapUrlSearchParams(params))
      return { context: { body: { ...ctx.body, ...parsed } } }
    })
  )(fields)
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
      RequestBodyError | ParseResult.ParseError,
      Schema.Struct.Context<F> | Route.Request | Scope.Scope
    >,
  ]
>
export function schemaBodyMultipart<
  A,
  I extends Partial<
    Record<
      string,
      ReadonlyArray<Multipart.File | string> | string
    >
  >,
  R,
>(
  fields: Schema.Schema<A, I, R>,
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
      RequestBodyError | ParseResult.ParseError,
      R | Route.Request | Scope.Scope
    >,
  ]
>
export function schemaBodyMultipart(fields: SchemaOrFields) {
  return makeSchemaFilter((ctx, decode) =>
    Effect.gen(function*() {
      const request = yield* Route.Request
      const record = yield* Effect.tryPromise({
        try: () => Http.parseFormData(request),
        catch: (cause) => new RequestBodyError({ reason: "MultipartError", cause }),
      })
      const parsed = yield* decode(record)
      return { context: { body: { ...ctx.body, ...parsed } } }
    })
  )(fields)
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
      RequestBodyError | ParseResult.ParseError,
      Schema.Struct.Context<F> | Route.Request | Scope.Scope
    >,
  ]
>
export function schemaBodyForm<
  A,
  I extends Partial<
    Record<
      string,
      ReadonlyArray<Multipart.File | string> | string
    >
  >,
  R,
>(
  fields: Schema.Schema<A, I, R>,
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
      RequestBodyError | ParseResult.ParseError,
      R | Route.Request | Scope.Scope
    >,
  ]
>
export function schemaBodyForm(fields: SchemaOrFields) {
  return makeSchemaFilter((ctx, decode) =>
    Effect.gen(function*() {
      const request = yield* Route.Request
      const contentType = request.headers.get("content-type") ?? ""

      if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = yield* Effect.tryPromise({
          try: () => request.text(),
          catch: (cause) => new RequestBodyError({ reason: "UrlParamsError", cause }),
        })
        const params = new URLSearchParams(text)
        const record = Http.mapUrlSearchParams(params)
        const parsed = yield* decode(record as any)
        return { context: { body: { ...ctx.body, ...parsed } } }
      }

      const record = yield* Effect.tryPromise({
        try: () => Http.parseFormData(request),
        catch: (cause) => new RequestBodyError({ reason: "FormDataError", cause }),
      })
      const parsed = yield* decode(record as any)
      return { context: { body: { ...ctx.body, ...parsed } } }
    })
  )(fields)
}

/**
 * Metadata attached to the descriptor of a route created by `schemaError`,
 * so tooling (e.g. an OpenAPI generator) can walk `Route.items()` and read
 * off every declared error response without executing the route.
 */
export interface SchemaErrorDescriptor {
  readonly schema: Schema.Schema<any, any, any>
  readonly status: number
}

/**
 * Intercepts typed errors from downstream handlers, encodes them through the
 * schema, and returns a JSON response with the given status code.
 *
 * Without `schemaError`, handler errors fall through to global catch during
 * execution of request. `schemaError` short circuts error handling by
 * return an error response immedietly.
 *
 * The schema and status are also recorded on the route's descriptor under
 * `schemaError`, so tooling can generate OpenAPI (or similar) documentation
 * by reading `Route.descriptor()` for each item, without running the route.
 */
export function schemaError<A, I, R>(
  schema: Schema.Schema<A, I, R> & { readonly status: number },
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [...P, Route.Route<{ schemaError: SchemaErrorDescriptor }, {}, unknown, never, R>]
>
export function schemaError<A, I, R>(
  schema: Schema.Schema<A, I, R>,
  options: { readonly status: number },
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [...P, Route.Route<{ schemaError: SchemaErrorDescriptor }, {}, unknown, never, R>]
>
export function schemaError<A, I, R>(
  schema: Schema.Schema<A, I, R> & { readonly status?: number },
  options?: { readonly status: number },
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [...P, Route.Route<{ schemaError: SchemaErrorDescriptor }, {}, unknown, never, R>]
> {
  const status = options?.status ?? (schema as any).status
  if (typeof status !== "number") {
    throw new Error(
      "schemaError: status is required either via options or as a static property on the schema",
    )
  }
  const encode = Schema.encode(schema)
  const is = Schema.is(schema)
  return function<D, SB, P extends Route.Route.Tuple>(
    self: Route.RouteSet<D, SB, P>,
  ): Route.RouteSet<
    D,
    SB,
    [...P, Route.Route<{ schemaError: SchemaErrorDescriptor }, {}, unknown, never, R>]
  > {
    const route = Route.make<{ schemaError: SchemaErrorDescriptor }, {}, unknown, never, R>(
      (_context, next) =>
        Entity.resolve(next).pipe(
          Effect.catchIf(
            is,
            (error) => Effect.map(Effect.orDie(encode(error)), (encoded) => Entity.make(encoded, { status })),
          ),
        ),
      { schemaError: { schema, status } },
    )

    const items: [...P, Route.Route<{ schemaError: SchemaErrorDescriptor }, {}, unknown, never, R>] = [
      ...Route.items(self),
      route,
    ]

    return Route.set(items, Route.descriptor(self))
  }
}

/**
 * Metadata attached to the descriptor of a route created by `schemaSuccess`,
 * so tooling (e.g. an OpenAPI generator) can walk `Route.items()` and read
 * off the declared success response without executing the route.
 */
export interface SchemaSuccessDescriptor {
  readonly schema: Schema.Schema<any, any, any>
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
      { schemaSuccess: SchemaSuccessDescriptor },
      {},
      Types.Simplify<Schema.Struct.Encoded<F>>,
      ParseResult.ParseError,
      Schema.Struct.Context<F>
    >,
  ]
>
export function schemaSuccess<A, I, R>(
  schema: Schema.Schema<A, I, R>,
): <D, SB, P extends Route.Route.Tuple>(
  self: Route.RouteSet<D, SB, P>,
) => Route.RouteSet<
  D,
  SB,
  [...P, Route.Route<{ schemaSuccess: SchemaSuccessDescriptor }, {}, I, ParseResult.ParseError, R>]
>
export function schemaSuccess(
  schema: SchemaOrFields,
): any {
  const s = toSchema(schema)
  const encode = Schema.encodeUnknown(s)
  return function(self: Route.RouteSet<any, any, any>) {
    const route = Route.make(
      (_context: any, next: any) =>
        Effect.flatMap(
          Entity.resolve(next),
          (entity) =>
            Effect.map(encode(entity.body), (encoded) =>
              Entity.make(encoded, {
                status: entity.status,
                headers: entity.headers,
                url: entity.url,
              })),
        ),
      { schemaSuccess: { schema: s } },
    )

    const items = [
      ...Route.items(self),
      route,
    ]

    return Route.set(items as any, Route.descriptor(self))
  }
}
