import * as Effect from "effect/Effect"
import type * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"
import * as Http from "./Http.ts"
import * as PathPattern from "./PathPattern.ts"
import type * as Route from "./Route.ts"
import * as RouteHook from "./RouteHook.ts"

export interface RequestBodyError {
  readonly _tag: "RequestBodyError"
  readonly reason:
    | "JsonError"
    | "UrlParamsError"
    | "MultipartError"
    | "FormDataError"
  readonly cause: unknown
}

export const RequestBodyError = (
  reason: RequestBodyError["reason"],
  cause: unknown,
): RequestBodyError => ({ _tag: "RequestBodyError", reason, cause })

export const File = Schema.TaggedStruct("File", {
  key: Schema.String,
  name: Schema.String,
  contentType: Schema.String,
  content: Schema.Uint8ArrayFromSelf,
})

export function schemaHeaders<
  A,
  I extends Readonly<Record<string, string | undefined>>,
  R,
>(
  fields: Schema.Schema<A, I, R>,
): <
  D extends Route.RouteDescriptor.Any,
  SB extends {},
  P extends Route.Route.Tuple,
>(
  self: Route.RouteSet.RouteSet<D, SB, P>,
) => Route.RouteSet.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route.Route<
      {},
      { headers: A },
      unknown,
      ParseResult.ParseError,
      R
    >,
  ]
> {
  const decode = Schema.decodeUnknown(fields)
  return RouteHook.filter((ctx: { request: Request; headers?: {} }) =>
    Effect.map(
      decode(Http.mapHeaders(ctx.request.headers)),
      (parsed) => ({
        context: {
          headers: {
            ...ctx.headers,
            ...parsed,
          },
        },
      }),
    )
  )
}

export function schemaCookies<
  A,
  I extends Readonly<Record<string, string | undefined>>,
  R,
>(
  fields: Schema.Schema<A, I, R>,
): <
  D extends Route.RouteDescriptor.Any,
  SB extends {},
  P extends Route.Route.Tuple,
>(
  self: Route.RouteSet.RouteSet<D, SB, P>,
) => Route.RouteSet.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route.Route<
      {},
      { cookies: A },
      unknown,
      ParseResult.ParseError,
      R
    >,
  ]
> {
  const decode = Schema.decodeUnknown(fields)
  return RouteHook.filter((ctx: { request: Request; cookies?: {} }) =>
    Effect.map(
      decode(Http.parseCookies(ctx.request.headers.get("cookie"))),
      (parsed) => ({
        context: {
          cookies: {
            ...ctx.cookies,
            ...parsed,
          },
        },
      }),
    )
  )
}

export function schemaSearchParams<
  A,
  I extends Readonly<
    Record<string, string | ReadonlyArray<string> | undefined>
  >,
  R,
>(
  fields: Schema.Schema<A, I, R>,
): <
  D extends Route.RouteDescriptor.Any,
  SB extends {},
  P extends Route.Route.Tuple,
>(
  self: Route.RouteSet.RouteSet<D, SB, P>,
) => Route.RouteSet.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route.Route<
      {},
      { searchParams: A },
      unknown,
      ParseResult.ParseError,
      R
    >,
  ]
> {
  const decode = Schema.decodeUnknown(fields)
  return RouteHook.filter((ctx: { request: Request; searchParams?: {} }) => {
    const url = new URL(ctx.request.url)
    return Effect.map(
      decode(Http.mapUrlSearchParams(url.searchParams)),
      (parsed) => ({
        context: {
          searchParams: {
            ...ctx.searchParams,
            ...parsed,
          },
        },
      }),
    )
  })
}

export function schemaPathParams<
  A,
  I extends Readonly<Record<string, string | undefined>>,
  R,
>(
  fields: Schema.Schema<A, I, R>,
): <
  D extends Route.RouteDescriptor.Any,
  SB extends {},
  P extends Route.Route.Tuple,
>(
  self: Route.RouteSet.RouteSet<D, SB, P>,
) => Route.RouteSet.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route.Route<
      {},
      { pathParams: A },
      unknown,
      ParseResult.ParseError,
      R
    >,
  ]
> {
  const decode = Schema.decodeUnknown(fields)
  return RouteHook.filter(
    (ctx: { request: Request; path?: string; pathParams?: {} }) => {
      const url = new URL(ctx.request.url)
      const pattern = ctx.path ?? "/"
      const params = PathPattern.match(pattern, url.pathname) ?? {}
      return Effect.map(
        decode(params),
        (parsed) => ({
          context: {
            pathParams: {
              ...ctx.pathParams,
              ...parsed,
            },
          },
        }),
      )
    },
  )
}

export function schemaBodyJson<
  A,
  I,
  R,
>(
  fields: Schema.Schema<A, I, R>,
): <
  D extends Route.RouteDescriptor.Any,
  SB extends {},
  P extends Route.Route.Tuple,
>(
  self: Route.RouteSet.RouteSet<D, SB, P>,
) => Route.RouteSet.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route.Route<
      {},
      { body: A },
      unknown,
      RequestBodyError | ParseResult.ParseError,
      R
    >,
  ]
> {
  const decode = Schema.decodeUnknown(fields)
  return RouteHook.filter((ctx: { request: Request; body?: {} }) =>
    Effect.gen(function*() {
      const json = yield* Effect.tryPromise({
        try: () => ctx.request.json(),
        catch: (error) => RequestBodyError("JsonError", error),
      })
      const parsed = yield* decode(json)
      return {
        context: {
          body: {
            ...ctx.body,
            ...parsed,
          },
        },
      }
    })
  )
}

export function schemaBodyUrlParams<
  A,
  I extends Readonly<
    Record<string, string | ReadonlyArray<string> | undefined>
  >,
  R,
>(
  fields: Schema.Schema<A, I, R>,
): <
  D extends Route.RouteDescriptor.Any,
  SB extends {},
  P extends Route.Route.Tuple,
>(
  self: Route.RouteSet.RouteSet<D, SB, P>,
) => Route.RouteSet.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route.Route<
      {},
      { body: A },
      unknown,
      RequestBodyError | ParseResult.ParseError,
      R
    >,
  ]
> {
  const decode = Schema.decodeUnknown(fields)
  return RouteHook.filter((ctx: { request: Request; body?: {} }) =>
    Effect.gen(function*() {
      const text = yield* Effect.tryPromise({
        try: () => ctx.request.text(),
        catch: (error) => RequestBodyError("UrlParamsError", error),
      })
      const params = new URLSearchParams(text)
      const parsed = yield* decode(Http.mapUrlSearchParams(params))
      return {
        context: {
          body: {
            ...ctx.body,
            ...parsed,
          },
        },
      }
    })
  )
}

export function schemaBodyMultipart<
  A,
  I extends Partial<
    Record<
      string,
      ReadonlyArray<Http.FilePart> | ReadonlyArray<string> | string
    >
  >,
  R,
>(
  fields: Schema.Schema<A, I, R>,
): <
  D extends Route.RouteDescriptor.Any,
  SB extends {},
  P extends Route.Route.Tuple,
>(
  self: Route.RouteSet.RouteSet<D, SB, P>,
) => Route.RouteSet.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route.Route<
      {},
      { body: A },
      unknown,
      RequestBodyError | ParseResult.ParseError,
      R | Scope.Scope
    >,
  ]
> {
  const decode = Schema.decodeUnknown(fields)
  return RouteHook.filter((ctx: { request: Request; body?: {} }) =>
    Effect.gen(function*() {
      const record = yield* Effect.tryPromise({
        try: () => Http.parseFormData(ctx.request),
        catch: (error) => RequestBodyError("MultipartError", error),
      })
      const parsed = yield* decode(record)
      return {
        context: {
          body: {
            ...ctx.body,
            ...parsed,
          },
        },
      }
    })
  )
}

export function schemaBodyForm<
  A,
  I extends Partial<
    Record<
      string,
      ReadonlyArray<Http.FilePart> | ReadonlyArray<string> | string
    >
  >,
  R,
>(
  fields: Schema.Schema<A, I, R>,
): <
  D extends Route.RouteDescriptor.Any,
  SB extends {},
  P extends Route.Route.Tuple,
>(
  self: Route.RouteSet.RouteSet<D, SB, P>,
) => Route.RouteSet.RouteSet<
  D,
  SB,
  [
    ...P,
    Route.Route.Route<
      {},
      { body: A },
      unknown,
      RequestBodyError | ParseResult.ParseError,
      R | Scope.Scope
    >,
  ]
> {
  const decode = Schema.decodeUnknown(fields)
  return RouteHook.filter((ctx: { request: Request; body?: {} }) =>
    Effect.gen(function*() {
      const contentType = ctx.request.headers.get("content-type") ?? ""

      if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = yield* Effect.tryPromise({
          try: () => ctx.request.text(),
          catch: (error) => RequestBodyError("UrlParamsError", error),
        })
        const params = new URLSearchParams(text)
        const record = Http.mapUrlSearchParams(params)
        const parsed = yield* decode(record as I)
        return {
          context: {
            body: {
              ...ctx.body,
              ...parsed,
            },
          },
        }
      }

      const record = yield* Effect.tryPromise({
        try: () => Http.parseFormData(ctx.request),
        catch: (error) => RequestBodyError("FormDataError", error),
      })
      const parsed = yield* decode(record as I)
      return {
        context: {
          body: {
            ...ctx.body,
            ...parsed,
          },
        },
      }
    })
  )
}
