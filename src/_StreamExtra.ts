import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Function from "effect/Function"
import * as Predicate from "effect/Predicate"
import * as Runtime from "effect/Runtime"
import * as Stream from "effect/Stream"

export const isStream = (u: unknown): u is Stream.Stream<unknown, unknown, unknown> =>
  Predicate.hasProperty(u, Stream.StreamTypeId)

export type IsStream<T> = T extends Stream.Stream<infer _A, infer _E, infer _R> ? true : false

export type Chunk<T> = T extends Stream.Stream<infer A, infer _E, infer _R> ? A : never

export type StreamError<T> = T extends Stream.Stream<infer _A, infer E, infer _R> ? E : never

export type Context<T> = T extends Stream.Stream<infer _A, infer _E, infer R> ? R : never

/**
 * Patched version of original Stream.toReadableStreamRuntime (v3.14.4) to
 * fix an issue in Bun when native stream controller stops working when request
 * is terminated by the client:
 *
 *  TypeError: Value of "this" must be of type ReadableStreamDefaultController
 *
 * See related issues:
 * https://github.com/Effect-TS/effect/issues/4538
 * https://github.com/oven-sh/bun/issues/17837
 */
export const toReadableStreamRuntimePatched = Function.dual<
  <A, XR>(
    runtime: Runtime.Runtime<XR>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined },
  ) => <E, R extends XR>(self: Stream.Stream<A, E, R>) => ReadableStream<A>,
  <A, E, XR, R extends XR>(
    self: Stream.Stream<A, E, R>,
    runtime: Runtime.Runtime<XR>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined },
  ) => ReadableStream<A>
>(
  (args) => Predicate.hasProperty(args[0], Stream.StreamTypeId) || Effect.isEffect(args[0]),
  <A, E, XR, R extends XR>(
    self: Stream.Stream<A, E, R>,
    runtime: Runtime.Runtime<XR>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined },
  ): ReadableStream<A> => {
    const runFork = Runtime.runFork(runtime)
    let currentResolve: (() => void) | undefined = undefined
    let fiber: Fiber.RuntimeFiber<void, E> | undefined = undefined
    const latch = Effect.unsafeMakeLatch(false)

    return new ReadableStream<A>(
      {
        start(controller) {
          fiber = runFork(
            Stream.runForEachChunk(self, (chunk) =>
              latch.whenOpen(
                Effect.sync(() => {
                  latch.unsafeClose()
                  try {
                    for (const item of chunk) {
                      controller.enqueue(item)
                    }
                  } catch (e) {
                    if (
                      (e as Error).message ===
                      `Value of "this" must be of type ReadableStreamDefaultController`
                    ) {
                      // Do nothing when this happens in Bun.
                    } else {
                      throw e
                    }
                  }
                  currentResolve!()
                  currentResolve = undefined
                }),
              ),
            ),
          )
          // --- CHANGES HERE ---
          // In original code, we had fiber.addObserver here that called
          // error() or close() on controller. This patched version removes it.
        },
        pull() {
          return new Promise<void>((resolve) => {
            currentResolve = resolve
            Effect.runSync(latch.open)
          })
        },
        cancel() {
          if (!fiber) return
          return Effect.runPromise(Effect.asVoid(Fiber.interrupt(fiber)))
        },
      },
      options?.strategy,
    )
  },
)

export const toReadableStreamRuntimePatched2 = Function.dual<
  <A, XR>(
    runtime: Runtime.Runtime<XR>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined },
  ) => <E, R extends XR>(self: Stream.Stream<A, E, R>) => ReadableStream<A>,
  <A, E, XR, R extends XR>(
    self: Stream.Stream<A, E, R>,
    runtime: Runtime.Runtime<XR>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined },
  ) => ReadableStream<A>
>(
  (args) => Predicate.hasProperty(args[0], Stream.StreamTypeId) || Effect.isEffect(args[0]),
  <A, E, XR, R extends XR>(
    self: Stream.Stream<A, E, R>,
    runtime: Runtime.Runtime<XR>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined },
  ): ReadableStream<A> => {
    const runSync = Runtime.runSync(runtime)
    const runFork = Runtime.runFork(runtime)
    let currentResolve: (() => void) | undefined = undefined
    let fiber: Fiber.RuntimeFiber<void, E> | undefined = undefined
    const latch = Effect.unsafeMakeLatch(false)

    return new ReadableStream<A>(
      {
        start(controller) {
          fiber = runFork(
            Stream.runForEachChunk(self, (chunk) =>
              latch.whenOpen(
                Effect.sync(() => {
                  latch.unsafeClose()
                  for (const item of chunk) {
                    controller.enqueue(item)
                  }
                  currentResolve!()
                  currentResolve = undefined
                }),
              ),
            ),
          )
          fiber.addObserver((exit) => {
            if (exit._tag === "Failure") {
              controller.error(Cause.squash(exit.cause))
            } else {
              controller.close()
            }
          })
        },
        pull() {
          return new Promise<void>((resolve) => {
            currentResolve = resolve
            Effect.runSync(latch.open)
          })
        },
        cancel() {
          if (!fiber) return
          return Effect.runPromise(Effect.asVoid(Fiber.interrupt(fiber)))
        },
      },
      options?.strategy,
    )
  },
)
