import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as PlatformError from "effect/PlatformError"
import type * as Scope from "effect/Scope"
import * as NNet from "node:net"

/**
 * Creates a scoped Effects and runs is asynchronously.
 * Useful for testing.
 */
export function effectFn(): <AEff>(
  f: () => Generator<Effect.Effect<any, any, Scope.Scope>, AEff, never>,
) => Promise<void>
export function effectFn<RL>(layer: Layer.Layer<RL, any>): <AEff>(
  f: () => Generator<Effect.Effect<any, any, RL | Scope.Scope>, AEff, never>,
) => Promise<void>
export function effectFn(layer?: Layer.Layer<any, any>) {
  if (layer === undefined) {
    return <AEff>(f: () => Generator<Effect.Effect<any, any, Scope.Scope>, AEff, never>): Promise<void> => {
      const runtime = ManagedRuntime.make(Logger.layer([Logger.consolePretty()]))
      return runtime
        .runPromise(Effect.scoped(Effect.gen(f)))
        .then(() => {}, clearStackTraces)
        .finally(() => runtime.dispose())
    }
  }
  return <AEff>(f: () => Generator<Effect.Effect<any, any, any>, AEff, never>): Promise<void> => {
    const runtime = ManagedRuntime.make(Layer.merge(layer, Logger.layer([Logger.consolePretty()])))
    return runtime
      .runPromise(Effect.scoped(Effect.gen(f)))
      .then(() => {}, clearStackTraces)
      .finally(() => runtime.dispose())
  }
}

/*
 * When effect fails, instead of throwing FiberFailure,
 * throw a plain Error with the strack trace and hides
 * effect internals.
 * Otherwise, at least on Bun, the strack trace is repeated,
 * with some junks in between taking half of the screen.
 *
 * Direct children that starts with a dot are excluded because
 * some tools, like effect-start, use it to generate temporary
 * files that are then loaded into a runtime.
 */
export const randomFreePort: Effect.Effect<number, PlatformError.PlatformError> = Effect
  .callback<
    number,
    PlatformError.PlatformError
  >((resume) => {
    const server = NNet.createServer()
    server.unref()
    server.on("error", (err) =>
      resume(
        Effect.fail(
          PlatformError.systemError({
            _tag: "Unknown",
            module: "System",
            method: "randomFreePort",
            description: err.message,
            cause: err,
          }),
        ),
      ))
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        server.close(() =>
          resume(
            Effect.fail(
              PlatformError.systemError({
                _tag: "Unknown",
                module: "System",
                method: "randomFreePort",
                description: "Failed to allocate a free port",
              }),
            ),
          )
        )
        return
      }
      const port = address.port
      server.close((err) => {
        if (err) {
          resume(
            Effect.fail(
              PlatformError.systemError({
                _tag: "Unknown",
                module: "System",
                method: "randomFreePort",
                description: err.message,
                cause: err,
              }),
            ),
          )
          return
        }
        resume(Effect.succeed(port))
      })
    })
  })

const clearStackTraces = (err: unknown) => {
  const ExternalStackTraceLineRegexp = /\(.*\/node_modules\/[^.]/

  const message = err instanceof Error
    ? err.message
    : typeof err === "object" && err !== null && "message" in err
    ? String(err.message)
    : String(err)
  const stack: string = err instanceof Error
    ? (err.stack ?? "")
    : typeof err === "object" && err !== null && "stack" in err
    ? String(err.stack)
    : ""

  const newErr = new Error(message)
  newErr.stack = Function.pipe(
    stack.split("\n"),
    Array.takeWhile((s) => !ExternalStackTraceLineRegexp.test(s)),
    Array.join("\n"),
  )

  throw newErr
}
