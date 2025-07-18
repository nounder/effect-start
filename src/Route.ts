import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint"
import * as HttpMethod from "@effect/platform/HttpMethod"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

export const TypeId: unique symbol = Symbol.for("effect-start/Route")

export type TypeId = typeof TypeId

export type RouteMethod =
  | HttpMethod.HttpMethod
  | "*"

export type RoutePath =
  | HttpApiEndpoint.PathSegment
  | "*"

interface Route<
  out Handler extends Effect.Effect<Success, any, R>,
  out Name extends string = "",
  out Method extends RouteMethod = "*",
  in out Path extends RoutePath = "*",
  in out PathParams = never,
  in out UrlParams = never,
  in out Payload = never,
  in out Headers = never,
  in out Success = void,
  in out Error = never,
  out R = never,
  out RE = never,
> {
  readonly [TypeId]: TypeId
  readonly name: Name
  readonly path: RoutePath
  readonly method: Method
  readonly pathSchema: Option.Option<Schema.Schema<PathParams, unknown, R>>
  readonly urlParamsSchema: Option.Option<Schema.Schema<UrlParams, unknown, R>>
  readonly payloadSchema: Option.Option<Schema.Schema<Payload, unknown, R>>
  readonly headersSchema: Option.Option<Schema.Schema<Headers, unknown, R>>
  readonly successSchema: Schema.Schema<Success, unknown, R>
  readonly errorSchema: Schema.Schema<Error, unknown, RE>

  readonly handler: Handler
}

export declare namespace Route {
  export type Any = Route<Effect.Effect<unknown>>
}

const RouteProto = {
  [TypeId]: TypeId,
}

const DefaultSuccess = Schema.Any
const DefaultError = Schema.Never

/**
 * Creates a full Route which is an Operation bounded to a method and a path.
 */
export function make<
  Handler extends Effect.Effect<Success, any, R>,
  Name extends string = "",
  Method extends RouteMethod = "*",
  Path extends RoutePath = "*",
  PathParams = never,
  UrlParams = never,
  Payload = never,
  Headers = never,
  Success = void,
  Error = never,
  R = never,
  RE = never,
>(options: {
  handler: Handler
  name?: Name
  method?: Method
  path?: Path
  pathParams?: Schema.Schema<PathParams, unknown, R>
  urlParams?: Schema.Schema<UrlParams, unknown, R>
  payload?: Schema.Schema<Payload, unknown, R>
  headers?: Schema.Schema<Headers, unknown, R>
  success?: Schema.Schema<Success, unknown, R>
  error?: Schema.Schema<Error, unknown, RE>
}) {
  type NewRoute = Route<
    Handler,
    Name,
    Method,
    Path,
    PathParams,
    UrlParams,
    Payload,
    Headers,
    Success,
    Error,
    R,
    RE
  >

  const {
    name = "",
    method = "*",
    path = "*",
  } = options

  const impl = {
    handler: options.handler,
    name,
    method,
    path,
    pathSchema: Option.fromNullable(options.pathParams),
    urlParamsSchema: Option.fromNullable(options.urlParams),
    payloadSchema: Option.fromNullable(options.payload),
    headersSchema: Option.fromNullable(options.headers),
    successSchema: options.success ?? DefaultSuccess,
    errorSchema: options.error ?? DefaultError,
  } as NewRoute

  const route: NewRoute = Object
    .assign(
      Object.create(RouteProto),
      impl,
    )

  return route
}

export function isRoute(
  input: unknown,
): input is Route.Any {
  return Predicate.hasProperty(input, TypeId)
}

export function isBounded(
  input: unknown,
): input is Route.Any {
  return isRoute(input)
    && input.method !== "*"
    && input.path !== "*"
}

export function bind<
  Handler extends Effect.Effect<Success, any, R>,
  Method extends HttpMethod.HttpMethod,
  Path extends HttpApiEndpoint.PathSegment,
  Name extends string = "",
  PathParams = never,
  UrlParams = never,
  Payload = never,
  Headers = never,
  Success = void,
  Error = never,
  R = never,
  RE = never,
>(
  route: Route<
    Handler,
    Name,
    "*",
    "*",
    PathParams,
    UrlParams,
    Payload,
    Headers,
    Success,
    Error,
    R,
    RE
  >,
  options: {
    name?: Name
    path: Path
    method: Method
    // annotations?: Context.Context<any>
  },
): Route<
  Handler,
  Name,
  Method,
  Path,
  PathParams,
  UrlParams,
  Payload,
  Headers,
  Success,
  Error,
  R,
  RE
> {
  const {
    name,
    path,
    method,
  } = options

  return make({
    ...route,
    name,
    path,
    method,
  })
}

export function toHttpApiEndpoint<
  Handler extends Effect.Effect<Success, any, R>,
  Method extends HttpMethod.HttpMethod,
  Path extends HttpApiEndpoint.PathSegment,
  Name extends string = "",
  PathParams = never,
  UrlParams = never,
  Payload = never,
  Headers = never,
  Success = void,
  Error = never,
  R = never,
  RE = never,
>(
  route: Route<
    Handler,
    Name,
    Method,
    Path,
    PathParams,
    UrlParams,
    Payload,
    Headers,
    Success,
    Error,
    R,
    RE
  >,
) {
  const name = route.name ?? `${route.method.toLowerCase()}_${route.path}`
  const path = route.path as HttpApiEndpoint.PathSegment
  const httpApiEndpoint = pipe(
    HttpApiEndpoint.make(route.method)(name, path),
    ep =>
      route.errorSchema as any !== DefaultError
        ? ep.addError(route.errorSchema)
        : ep,
    ep =>
      route.successSchema as any !== DefaultSuccess
        ? ep.addSuccess(route.successSchema)
        : ep,
    // TODO: support annotations
    // ep =>
    //   options.annotations
    //     ? ep.annotateContext(options.annotations)
    //     : ep,
  )

  return httpApiEndpoint
}
