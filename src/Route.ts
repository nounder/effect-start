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
  out HA = Success extends void ? any : Schema.Schema.Type<Success>,
  in out Handler extends (
    req: RouteRequest<PathParams, UrlParams, Payload>,
  ) => Effect.Effect<HA, any, R> = () => Effect.Effect<HA, any, R>,
> {
  readonly [TypeId]: TypeId

  readonly name: Name
  readonly path: Path
  readonly method: Method
  readonly handler: Handler

  readonly pathSchema?: Schema.Schema<PathParams, unknown, R>
  readonly urlParamsSchema?: Schema.Schema<UrlParams, unknown, R>
  readonly payloadSchema?: Schema.Schema<Payload, unknown, R>
  readonly headersSchema?: Schema.Schema<Headers, unknown, R>
  readonly successSchema?: Schema.Schema<Success, unknown, R>
  readonly errorSchema?: Schema.Schema<Error, unknown, RE>
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
  HA = Success extends void ? any : Schema.Schema.Type<Success>,
  Handler extends (
    req: RouteRequest<PathParams, UrlParams, Payload>,
  ) => Effect.Effect<HA, any, R> = () => Effect.Effect<HA, any, R>,
>(options: {
  name?: Name
  method?: Method
  path?: Path
  handler: Handler
  pathParams?: Schema.Schema<PathParams, unknown, R>
  urlParams?: Schema.Schema<UrlParams, unknown, R>
  payload?: Schema.Schema<Payload, unknown, R>
  headers?: Schema.Schema<Headers, unknown, R>
  success?: Schema.Schema<Success, unknown, R>
  error?: Schema.Schema<Error, unknown, RE>
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
  HA,
  Handler
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
  HA = Success extends void ? any : Schema.Schema.Type<Success>,
  Handler extends (
    req: RouteRequest<PathParams, UrlParams, Payload>,
  ) => Effect.Effect<HA, any, R> = () => Effect.Effect<HA, any, R>,
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
    HA,
    Handler
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
  HA,
  Handler
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
