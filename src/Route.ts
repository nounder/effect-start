import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint"
import * as HttpMethod from "@effect/platform/HttpMethod"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

export const TypeId: unique symbol = Symbol.for("effect-start/Route")

export type TypeId = typeof TypeId

/**
 * Schema representing success and error responses.
 */
type ResultSchema = Schema.Schema<any, any, never>

/**
 * Operation describes behavior of a route.
 */
interface Operation<
  Handler extends Effect.Effect<
    Schema.Schema.Encoded<Success>,
    any,
    any
  >,
  Success extends ResultSchema,
  Error extends ResultSchema,
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
export interface Route<
  Method extends HttpMethod.HttpMethod,
  Path extends `/${string}`,
  Handler extends Effect.Effect<
    Schema.Schema.Encoded<Success>,
    any,
    any
  >,
  Success extends ResultSchema,
  Error extends ResultSchema,
> extends Operation<Handler, Success, Error> {
  readonly [TypeId]: TypeId
  readonly method: Method
  readonly path: Path
}

export declare namespace Route {
  export type Any = Route<
    HttpMethod.HttpMethod,
    `/${string}`,
    Effect.Effect<Schema.Schema.Encoded<Schema.Schema.Any>, any, any>,
    ResultSchema,
    ResultSchema
  >

  export type Method<T extends Any> = [T] extends [
    Route<
      infer _Method,
      infer _Path,
      infer _Handler,
      infer _Success,
      infer _Error
    >,
  ] ? _Method
    : never

  export type Success<T extends Any> = [T] extends [
    Route<
      infer _Method,
      infer _Path,
      infer _Handler,
      infer _Success,
      infer _Error
    >,
  ] ? _Success
    : never

  export type Error<T extends Any> = [T] extends [
    Route<
      infer _Method,
      infer _Path,
      infer _Handler,
      infer _Success,
      infer _Error
    >,
  ] ? _Error
    : never

  export type Path<T extends Any> = [T] extends [
    Route<
      infer _Method,
      infer _Path,
      infer _Handler,
      infer _Success,
      infer _Error
    >,
  ] ? _Path
    : never
}

const RouteProto = {
  [TypeId]: TypeId,
}

/**
 * Creates a full Route which is an Operation bounded to a method and a path.
 */
export function make<
  Method extends HttpMethod.HttpMethod,
  Path extends `/${string}`,
  Handler extends Effect.Effect<
    Schema.Schema.Encoded<Success>,
    any,
    any
  >,
  Success extends ResultSchema,
  Error extends ResultSchema,
>(options: {
  method: Method
  path: Path
  handler: Handler
  success?: Success
  error?: Error
}): Route<
  Method,
  Path,
  Handler,
  Success,
  Error
> {
  const method = (options.method ?? "GET") as Method

  const route: Route<Method, Path, Handler, Success, Error> = Object
    .assign(
      Object.create(RouteProto),
      {
        method,
        success: Option.fromNullable(options.success),
        error: Option.fromNullable(options.error),
        path: Option.fromNullable(options.path),
        handler: options.handler,
      },
    )

  return route
}

export function isRoute(
  input: unknown,
): input is Route.Any {
  return Predicate.hasProperty(input, TypeId)
}

/**
 * Defines an Operation which is core Route behavior without binding
 * it to a method or a path (making it an Route)
 * Used in file-based routing.
 */
export function define<
  Handler extends Effect.Effect<
    Schema.Schema.Encoded<Success>,
    any,
    any
  >,
  Success extends ResultSchema,
  Error extends ResultSchema,
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
 * Binds {@link Route} to a method and a path creating {@link Route}.
 */
export function bind<
  Method extends HttpMethod.HttpMethod,
  Path extends `/${string}`,
  Handler extends Effect.Effect<
    Schema.Schema.Encoded<Success>,
    any,
    any
  >,
  Success extends ResultSchema,
  Error extends ResultSchema,
>(
  operation: Operation<Handler, Success, Error>,
  options: {
    path: Path
    method: Method
    // annotations?: Context.Context<any>
  },
) {
  return make({
    method: options.method,
    path: options.path,
    handler: operation.handler,
    success: Option.getOrUndefined(operation.success),
    error: Option.getOrUndefined(operation.error),
  })
}

export function toHttpApiEndpoint<
  Method extends HttpMethod.HttpMethod,
  Path extends `/${string}`,
  Handler extends Effect.Effect<
    Schema.Schema.Encoded<Success>,
    any,
    any
  >,
  Success extends ResultSchema,
  Error extends ResultSchema,
>(
  route: Route<
    Method,
    Path,
    Handler,
    Success,
    Error
  >,
) {
  const httpApiEndpoint = pipe(
    HttpApiEndpoint.make(route.method)(
      `${route.method.toLowerCase()}_${route.path}`,
      route.path,
    ),
    ep =>
      Option.isSome(route.success)
        ? ep.addSuccess(route.success.value)
        : ep,
    ep =>
      Option.isSome(route.error)
        ? ep.addError(route.error.value)
        : ep,
    // TODO: support annotations
    // ep =>
    //   options.annotations
    //     ? ep.annotateContext(options.annotations)
    //     : ep,
  )

  return httpApiEndpoint
}
