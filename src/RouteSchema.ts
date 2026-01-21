import * as FileSystem from "@effect/platform/FileSystem"
import type * as HttpServerError from "@effect/platform/HttpServerError"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Multipart from "@effect/platform/Multipart"
import * as Path from "@effect/platform/Path"
import * as Effect from "effect/Effect"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"
import * as Route from "./Route.ts"
import * as RouteHook from "./RouteHook.ts"

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
      any,
      ParseResult.ParseError,
      R | HttpServerRequest.HttpServerRequest
    >,
  ]
> {
  return RouteHook.filter((ctx: { headers?: {} }) =>
    Effect.map(
      HttpServerRequest.schemaHeaders(fields),
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
      any,
      ParseResult.ParseError,
      R | HttpServerRequest.HttpServerRequest
    >,
  ]
> {
  return RouteHook.filter((ctx: { cookies?: {} }) =>
    Effect.map(
      HttpServerRequest.schemaCookies(fields),
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
  I extends Readonly<Record<string, string | ReadonlyArray<string> | undefined>>,
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
      any,
      ParseResult.ParseError,
      R | HttpServerRequest.ParsedSearchParams
    >,
  ]
> {
  return RouteHook.filter((ctx: { searchParams?: {} }) =>
    Effect.map(
      HttpServerRequest.schemaSearchParams(fields),
      (parsed) => ({
        context: {
          searchParams: {
            ...ctx.searchParams,
            ...parsed,
          },
        },
      }),
    )
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
      any,
      HttpServerError.RequestError | ParseResult.ParseError,
      R | HttpServerRequest.HttpServerRequest
    >,
  ]
> {
  return RouteHook.filter((ctx: { body?: {} }) =>
    Effect.map(
      HttpServerRequest.schemaBodyJson(fields),
      (parsed) => ({
        context: {
          body: {
            ...ctx.body,
            ...parsed,
          },
        },
      }),
    )
  )
}

export function schemaBodyUrlParams<
  A,
  I extends Readonly<Record<string, string | ReadonlyArray<string> | undefined>>,
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
      any,
      HttpServerError.RequestError | ParseResult.ParseError,
      R | HttpServerRequest.HttpServerRequest
    >,
  ]
> {
  return RouteHook.filter((ctx: { body?: {} }) =>
    Effect.map(
      HttpServerRequest.schemaBodyUrlParams(fields),
      (parsed) => ({
        context: {
          body: {
            ...ctx.body,
            ...parsed,
          },
        },
      }),
    )
  )
}

export function schemaBodyMultipart<
  A,
  I extends Partial<Multipart.Persisted>,
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
      any,
      Multipart.MultipartError | ParseResult.ParseError,
      | R
      | HttpServerRequest.HttpServerRequest
      | Scope.Scope
      | FileSystem.FileSystem
      | Path.Path
    >,
  ]
> {
  return RouteHook.filter((ctx: { body?: {} }) =>
    Effect.map(
      HttpServerRequest.schemaBodyMultipart(fields),
      (parsed) => ({
        context: {
          body: {
            ...ctx.body,
            ...parsed,
          },
        },
      }),
    )
  )
}

export function schemaBodyForm<
  A,
  I extends Partial<Multipart.Persisted>,
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
      any,
      | Multipart.MultipartError
      | HttpServerError.RequestError
      | ParseResult.ParseError,
      | R
      | HttpServerRequest.HttpServerRequest
      | Scope.Scope
      | FileSystem.FileSystem
      | Path.Path
    >,
  ]
> {
  return RouteHook.filter((ctx: { body?: {} }) =>
    Effect.map(
      HttpServerRequest.schemaBodyForm(fields),
      (parsed) => ({
        context: {
          body: {
            ...ctx.body,
            ...parsed,
          },
        },
      }),
    )
  )
}

export function schemaBodyFormJson<
  A,
  I,
  R,
>(
  fields: Schema.Schema<A, I, R>,
  field: string,
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
      any,
      HttpServerError.RequestError | ParseResult.ParseError,
      | R
      | HttpServerRequest.HttpServerRequest
      | FileSystem.FileSystem
      | Path.Path
      | Scope.Scope
    >,
  ]
> {
  return RouteHook.filter((ctx: { body?: {} }) =>
    Effect.map(
      HttpServerRequest.schemaBodyFormJson(fields)(field),
      (parsed) => ({
        context: {
          body: {
            ...ctx.body,
            ...parsed,
          },
        },
      }),
    )
  )
}
