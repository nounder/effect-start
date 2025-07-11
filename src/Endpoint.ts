import * as HttpMethod from "@effect/platform/HttpMethod"
import { Effect } from "effect"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

export const TypeId: unique symbol = Symbol.for("effect-start/Endpoint")

export type TypeId = typeof TypeId

export function isEndpoint(input: unknown): input is Endpoint {
  return Predicate.hasProperty(input, TypeId)
}

export interface Endpoint<A = unknown> {
  readonly [TypeId]: TypeId

  readonly method: HttpMethod.HttpMethod
  readonly success: Option.Option<Schema.Schema.Any>
  readonly error: Option.Option<Schema.Schema.Any>
  readonly path: Option.Option<Schema.Schema.Any>
  readonly headers: Option.Option<Schema.Schema.Any>
}

export type EndpointHandle<A = unknown, E = never, R = never> =
  & Effect.Effect<A, E, R>
  & Endpoint<A>

const Proto = {
  [TypeId]: TypeId,
}

export function make<
  Success extends Schema.Schema.Any,
  Error extends Schema.Schema.Any,
  Path extends Schema.Schema.Any,
  Headers extends Schema.Schema.Any,
>(opts: {
  method?: HttpMethod.HttpMethod
  path?: Path
  success?: Success
  error?: Error
  headers?: Headers
}) {
  const method = opts.method ?? "GET"

  const endpoint: Endpoint<Schema.Schema.Encoded<Success>> = Object.assign(
    Object.create(Proto),
    {
      method,
      success: Option.fromNullable(opts.success),
      error: Option.fromNullable(opts.error),
      path: Option.fromNullable(opts.path),
      headers: Option.fromNullable(opts.headers),
    },
  )

  return function<
    A = Schema.Schema.Encoded<Success>,
    E = never,
    R = never,
  >(
    eff: Effect.Effect<A, E, R>,
  ): EndpointHandle<A, E, R> {
    return Object.assign(
      eff,
      endpoint,
    )
  }
}
