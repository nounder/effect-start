import {
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import {
  Cause,
  Console,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Logger,
  LogLevel,
  Option,
  pipe,
  Predicate,
  Runtime,
  Schedule,
  Stream,
} from "effect"
import { dual } from "effect/Function"
import { runForEachChunk, StreamTypeId } from "effect/Stream"

const App = Effect.gen(function*() {
  const req = yield* HttpServerRequest.HttpServerRequest

  if (req.url === "/") {
    return HttpServerResponse.text("ok")
  }

  const heartbeat = Stream.repeat(
    Stream.succeed({
      type: "Ping" as const,
    }),
    Schedule.spaced("5 seconds"),
  )

  const encoder = new TextEncoder()

  const d = yield* Deferred.make()

  const events = pipe(
    heartbeat,
    Stream.map(() => ":\n\n"),
    Stream.map(str => encoder.encode(str)),
    Stream.tap(() => Effect.gen(function*() {})),
  )

  const runtime = Runtime.defaultRuntime
  const readableStream = toReadableStreamRuntimePatched(runtime)(events)

  return HttpServerResponse.raw(
    readableStream,
    {
      headers: {
        "Content-Type": "text/event-stream",
      },
    },
  )
})

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
const toReadableStreamRuntimePatched = dual<
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
              for (const item of chunk) {
                controller.enqueue(item)
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

await pipe(
  HttpServer.serve(App),
  HttpServer.withLogAddress,
  Layer.provide(
    BunHttpServer.layer({
      port: 3000,
    }),
  ),
  Layer.launch,
  Logger.withMinimumLogLevel(LogLevel.Debug),
  Effect.runPromise,
)
