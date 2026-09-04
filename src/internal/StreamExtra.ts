import type * as EffectContext from "effect/Context"
import * as Function from "effect/Function"
import * as Stream from "effect/Stream"

export const isStream = Stream.isStream

export type IsStream<T> = T extends Stream.Stream<any, any, any> ? true : false
export type Chunk<T> = T extends Stream.Stream<infer A, any, any> ? A : never
export type StreamError<T> = T extends Stream.Stream<any, infer E, any> ? E : never
export type Context<T> = T extends Stream.Stream<any, any, infer R> ? R : never

export const toReadableStreamRuntimePatched = Function.dual<
  <A, XR>(
    context: EffectContext.Context<XR>,
    options?: { readonly strategy?: QueuingStrategy<A> },
  ) => <E, R extends XR>(self: Stream.Stream<A, E, R>) => ReadableStream<A>,
  <A, E, XR, R extends XR>(
    self: Stream.Stream<A, E, R>,
    context: EffectContext.Context<XR>,
    options?: { readonly strategy?: QueuingStrategy<A> },
  ) => ReadableStream<A>
>(
  (args) => Stream.isStream(args[0]),
  <A, E, XR, R extends XR>(
    self: Stream.Stream<A, E, R>,
    context: EffectContext.Context<XR>,
    options?: { readonly strategy?: QueuingStrategy<A> },
  ) => Stream.toReadableStreamWith(self, context, options),
)

export const toReadableStreamRuntimePatched2 = toReadableStreamRuntimePatched
