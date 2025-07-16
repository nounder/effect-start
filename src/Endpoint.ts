import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint"
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpMethod from "@effect/platform/HttpMethod"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

export const TypeId: unique symbol = Symbol.for("effect-start/Endpoint")

export type TypeId = typeof TypeId

type OpSchema = Schema.Schema<any, unknown, never>

/**
 * EndpointOperation describes behavior of an endpoint.
 */
interface Operation<
  Handler extends Effect.Effect<
    Schema.Schema.Encoded<Success>,
    any,
    any
  >,
  Success extends OpSchema,
  Error extends OpSchema,
> {
  readonly success: Option.Option<Success>
  readonly error: Option.Option<Error>
  readonly handler: Handler
}

declare namespace Operation {
  export type Any = Operation<any, any, any>

  export type Success<T extends Any> = Option.Option.Value<T["success"]>

  export type Error<T extends Any> = Option.Option.Value<T["error"]>

  export type Handler<T extends Any> = T["handler"]
}

/**
 * Represents an Operation bounded to a method and a path,
 * (Path Item in OpenAPI terminology).
 */
export interface Endpoint<
  Method extends HttpMethod.HttpMethod,
  Path extends `/${string}`,
  Handler extends Effect.Effect<
    Schema.Schema.Encoded<Success>,
    any,
    any
  >,
  Success extends OpSchema,
  Error extends OpSchema,
> extends Operation<Handler, Success, Error> {
  readonly [TypeId]: TypeId
  readonly method: HttpMethod.HttpMethod
  readonly path: Option.Option<Path>
}

export declare namespace Endpoint {
  export type Any = Endpoint<
    HttpMethod.HttpMethod,
    `/${string}`,
    Effect.Effect<Schema.Schema.Encoded<Schema.Schema.Any>, any, any>,
    OpSchema,
    OpSchema
  >

  export type Method<T extends Any> = [T] extends [
    Endpoint<
      infer _Method,
      infer _Path,
      infer _Handler,
      infer _Success,
      infer _Error
    >,
  ] ? _Method
    : never

  export type Success<T extends Any> = [T] extends [
    Endpoint<
      infer _Method,
      infer _Path,
      infer _Handler,
      infer _Success,
      infer _Error
    >,
  ] ? _Success
    : never

  export type Error<T extends Any> = [T] extends [
    Endpoint<
      infer _Method,
      infer _Path,
      infer _Handler,
      infer _Success,
      infer _Error
    >,
  ] ? _Error
    : never

  export type Path<T extends Any> = [T] extends [
    Endpoint<
      infer _Method,
      infer _Path,
      infer _Handler,
      infer _Success,
      infer _Error
    >,
  ] ? _Path
    : never
}

export interface UnboundedEndpoint<
  in out UrlParams = never,
  in out Payload = never,
  in out Headers = never,
  in out Success = void,
  in out Error = never,
  out R = never,
  out RE = never,
> extends
  HttpApiEndpoint.HttpApiEndpoint<
    "/",
    "GET",
    "/",
    UrlParams,
    Payload,
    Headers,
    Success,
    Error,
    R,
    RE
  >
{
  handle: Effect.Effect<any>
}

const EndpointProto = {
  [TypeId]: TypeId,
}

export function isEndpoint(
  input: unknown,
): input is Endpoint.Any {
  return Predicate.hasProperty(input, TypeId)
}

/**
 * Defines a endpoint behavior (Operation) without binding
 * it to a method or a path (making it an Endpoint)
 * Used in file-based routing.
 */
export function define<
  Handler extends Effect.Effect<
    Schema.Schema.Encoded<Success>,
    any,
    any
  >,
  Success extends OpSchema,
  Error extends OpSchema,
>(opts: {
  handler: Handler
  success?: Success
  error?: Error
}): Operation<Handler, Success, Error> {
  const operation: Operation<Handler, Success, Error> = Object
    .assign(
      Object.create(null),
      {
        handler: opts.handler,
        success: Option.fromNullable(opts.success),
        error: Option.fromNullable(opts.error),
      },
    )

  return operation
}

/**
 * Creates an Endpoint which is an Operation ({@see define})
 * bounded to a method and a path.
 */
export function make<
  Method extends HttpMethod.HttpMethod,
  Path extends `/${string}`,
  Handler extends Effect.Effect<
    Schema.Schema.Encoded<Success>,
    any,
    any
  >,
  Success extends OpSchema,
  Error extends OpSchema,
>(opts: {
  method: Method
  path: Path
  handler: Handler
  success?: Success
  error?: Error
}): Endpoint<Method, Path, Handler, Success, Error> {
  const method = (opts.method ?? "GET") as Method

  const endpoint: Endpoint<Method, Path, Handler, Success, Error> = Object
    .assign(
      Object.create(EndpointProto),
      {
        method,
        success: Option.fromNullable(opts.success),
        error: Option.fromNullable(opts.error),
        path: Option.fromNullable(opts.path),
        handler: opts.handler,
      },
    )

  return endpoint
}

export function toHttpApiEndpoint<
  Name extends string,
  Path extends `/${string}`,
  Method extends HttpMethod.HttpMethod,
>(
  endpoint: Endpoint.Any,
  options: {
    method: Method
    name: Name
    path: Path
    annotations?: Context.Context<any>
  },
) {
  const httpApiEndpoint = pipe(
    HttpApiEndpoint.make(options.method)(
      options.name,
      options.path,
    ),
    ep =>
      Option.isSome(endpoint.success)
        ? ep.addSuccess(endpoint.success.value)
        : ep,
    ep =>
      Option.isSome(endpoint.error)
        ? ep.addError(endpoint.error.value)
        : ep,
    ep =>
      options.annotations
        ? ep.annotateContext(options.annotations)
        : ep,
  )

  return httpApiEndpoint
}

// TODO
export function toHttpApp(endpoint): HttpApp.Default {
}
