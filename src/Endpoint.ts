import * as HttpMethod from "@effect/platform/HttpMethod"
import { Effect } from "effect"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

export const TypeId: unique symbol = Symbol.for("effect-start/Endpoint")

export type TypeId = typeof TypeId

export function isEndpoint(input: unknown): input is Endpoint<any> {
  return Predicate.hasProperty(input, TypeId)
}

export interface Endpoint<
  Method extends HttpMethod.HttpMethod,
  Success = Schema.Schema.Any,
  Error = Schema.Schema.Any,
  Path = Option.Option<`/${string}`>,
  Handle = Effect.Effect<
    Schema.Schema.Encoded<Success>,
    any,
    any
  >,
> {
  readonly [TypeId]: TypeId

  readonly method: HttpMethod.HttpMethod
  readonly success: Option.Option<Success>
  readonly error: Option.Option<Error>
  readonly path: Option.Option<Path>
  readonly headers: Option.Option<Headers>
  readonly handle: Handle
}

export declare namespace Endpoint {
  export type Method<T extends Endpoint<any, any, any, any>> = [T] extends
    [Endpoint<infer _Method, infer _Success, infer _Error, infer _Path>]
    ? _Method
    : never
}

const Proto = {
  [TypeId]: TypeId,
}

export function make<
  Success extends Schema.Schema.Any,
  Error extends Schema.Schema.Any,
  Path extends Option.Option<`/${string}`>,
  Handle extends Effect.Effect<Schema.Schema.Encoded<Success>, never, never>,
  Method extends HttpMethod.HttpMethod = "GET",
>(opts: {
  method?: Method
  path?: Path
  success?: Success
  error?: Error
  headers?: Headers
  handle: Handle
}): Endpoint<Method, Success, Error, Path, Handle> {
  const method = (opts.method ?? "GET") as Method

  const endpoint: Endpoint<Method, Success, Error, Path, Handle> = Object
    .assign(
      Object.create(Proto),
      {
        method,
        success: Option.fromNullable(opts.success),
        error: Option.fromNullable(opts.error),
        path: Option.fromNullable(opts.path),
        headers: Option.fromNullable(opts.headers),
        handle: opts.handle,
      },
    )

  return endpoint
}
