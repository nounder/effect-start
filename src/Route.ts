import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint"
import * as HttpMethod from "@effect/platform/HttpMethod"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

export const TypeId: unique symbol = Symbol.for("effect-start/Route")

export type TypeId = typeof TypeId

export type RouteMethod =
  | HttpMethod.HttpMethod
  | "*"

export type RoutePath = HttpApiEndpoint.PathSegment

// TODO: unionize it so params are not present
// when generics are void
interface RouteRequest<
  PathParams = void,
  UrlParams = void,
  Payload = void,
> {
  readonly path: PathParams
  readonly urlParams: UrlParams
  readonly payload: Payload
  readonly request: HttpServerRequest.HttpServerRequest
}

export interface Route<
  out Name extends string = "",
  out Method extends RouteMethod = "*",
  out Path extends RoutePath = "/",
  in out PathParams = void,
  in out UrlParams = void,
  in out Payload = void,
  in out Headers = void,
  in out Success = void,
  in out Error = void,
  out R = never,
  out RE = never,
  out HA = any,
> {
  readonly [TypeId]: TypeId

  readonly name: Name
  readonly path: Path
  readonly method: Method
  readonly handler: (
    req: RouteRequest<PathParams, UrlParams, Payload>,
  ) => Effect.Effect<
    Success extends void ? HA : Success,
    any,
    R
  >

  readonly pathSchema?: Schema.Schema<PathParams, unknown, R>
  readonly urlParamsSchema?: Schema.Schema<UrlParams, unknown, R>
  readonly payloadSchema?: Schema.Schema<Payload, unknown, R>
  readonly headersSchema?: Schema.Schema<Headers, unknown, R>
  readonly successSchema?: Schema.Schema<Success, unknown, R>
  readonly errorSchema?: Schema.Schema<Error, unknown, RE>
}

export namespace Route {
  export type Any = Route<
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
  >

  export type Success<T extends Any> = [T] extends [
    Route<
      infer _Name,
      infer _Method,
      infer _Path,
      infer _PathParams,
      infer _UrlParams,
      infer _Payload,
      infer _Headers,
      infer _Success,
      infer _Error,
      infer _R,
      infer _RE,
      infer _HA
    >,
  ] ? (_Success extends void ? _HA : _Success)
    : never
}

/**
 * Creates a full Route which is an Operation bounded to a method and a path.
 */
export function make<
  Name extends string = "",
  Method extends RouteMethod = "*",
  Path extends RoutePath = "/",
  PathParams = void,
  UrlParams = void,
  Payload = void,
  Headers = void,
  Success = void,
  Error = void,
  R = never,
  RE = never,
  HA = any,
>(options: {
  name?: Name
  method?: Method
  path?: Path
  handler: (
    req: RouteRequest<PathParams, UrlParams, Payload>,
  ) => Effect.Effect<Success extends void ? HA : Success, any, R>
  pathParams?: Schema.Schema<PathParams, any, R>
  urlParams?: Schema.Schema<UrlParams, any, R>
  payload?: Schema.Schema<Payload, any, R>
  headers?: Schema.Schema<Headers, any, R>
  success?: Schema.Schema<Success, any, R>
  error?: Schema.Schema<Error, any, RE>
}): Route<
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
  RE,
  HA
> {
  const {
    name = "" as Name,
    method = "*" as Method,
    path = "*" as Path,
  } = options

  return {
    [TypeId]: TypeId,
    name,
    method,
    path,
    pathSchema: options.pathParams,
    urlParamsSchema: options.urlParams,
    payloadSchema: options.payload,
    headersSchema: options.headers,
    successSchema: options.success,
    errorSchema: options.error,
    handler: options.handler,
  }
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
    && input.method !== "*"
    && input.path !== "/"
}

export function bind<
  Name extends string = "",
  Method extends RouteMethod = "*",
  Path extends RoutePath = "/",
  PathParams = void,
  UrlParams = void,
  Payload = void,
  Headers = void,
  Success = void,
  Error = void,
  R = never,
  RE = never,
  HA = any,
>(
  route: Route<
    Name,
    "*",
    "/",
    PathParams,
    UrlParams,
    Payload,
    Headers,
    Success,
    Error,
    R,
    RE,
    HA
  >,
  options: {
    name?: Name
    path: Path
    method: Method
    // annotations?: Context.Context<any>
  },
): Route<
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
  RE,
  HA
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
