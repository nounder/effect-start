import { Cause, Effect, Fiber, Predicate, Runtime, Stream } from "effect"
import { dual } from "effect/Function"
import { runForEachChunk, StreamTypeId } from "effect/Stream"

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
export const toReadableStreamRuntimePatched = dual<
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
  (args) =>
    Predicate.hasProperty(args[0], StreamTypeId) || Effect.isEffect(args[0]),
  <A, E, XR, R extends XR>(
    self: Stream.Stream<A, E, R>,
    runtime: Runtime.Runtime<XR>,
    options?: { readonly strategy?: QueuingStrategy<A> | undefined },
  ): ReadableStream<A> => {
    const runFork = Runtime.runFork(runtime)
    let currentResolve: (() => void) | undefined = undefined
    let fiber: Fiber.RuntimeFiber<void, E> | undefined = undefined
    const latch = Effect.unsafeMakeLatch(false)

    return new ReadableStream<A>({
      start(controller) {
        fiber = runFork(
          runForEachChunk(self, (chunk) =>
            latch.whenOpen(Effect.sync(() => {
              latch.unsafeClose()
              try {
                for (const item of chunk) {
                  controller.enqueue(item)
                }
              } catch (e) {
                if (
                  (e as Error).message
                    === `Value of "this" must be of type ReadableStreamDefaultController`
                ) {
                  // Do nothing when this happens in Bun.
                } else {
                  throw e
                }
              }
              currentResolve!()
              currentResolve = undefined
            }))),
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
    }, options?.strategy)
  },
)

export const toReadableStreamRuntimePatched2 = dual<
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
  (args) =>
    Predicate.hasProperty(args[0], StreamTypeId) || Effect.isEffect(args[0]),
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

    return new ReadableStream<A>({
      start(controller) {
        fiber = runFork(
          runForEachChunk(self, (chunk) =>
            latch.whenOpen(Effect.sync(() => {
              latch.unsafeClose()
              for (const item of chunk) {
                controller.enqueue(item)
              }
              currentResolve!()
              currentResolve = undefined
            }))),
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
    }, options?.strategy)
  },
)
