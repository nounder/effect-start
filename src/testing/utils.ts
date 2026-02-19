import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import type * as Scope from "effect/Scope"
import type * as Utils from "effect/Utils"
import * as NNet from "node:net"
import * as System from "../System.ts"

/**
 * Creates a scoped Effects and runs is asynchronously.
 * Useful for testing.
 */
export const effectFn =
  <RL>(layer?: Layer.Layer<RL, any>) =>
  <Eff extends Utils.YieldWrap<Effect.Effect<any, any, RE>>, AEff, RE extends RL | Scope.Scope>(
    f: () => Generator<Eff, AEff, never>,
  ): Promise<void> =>
    Function.pipe(
      Effect.gen(f),
      Effect.scoped,
      Effect.provide(Logger.pretty),
      Effect.provide(layer ?? Layer.empty),
      // @ts-expect-error will have to figure out how to clear deps
      Effect.runPromise,
      (v) => v.then(() => {}, clearStackTraces),
    )

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
export const randomFreePort: Effect.Effect<number, System.SystemError> = Effect.async<
  number,
  System.SystemError
>((resume) => {
  const server = NNet.createServer()
  server.unref()
  server.on("error", (err) =>
    resume(
      Effect.fail(
        new System.SystemError({
          reason: "Unknown",
          module: "System",
          method: "randomFreePort",
          description: err.message,
          cause: err,
        }),
      ),
    ),
  )
  server.listen(0, "127.0.0.1", () => {
    const address = server.address()
    if (!address || typeof address === "string") {
      server.close(() =>
        resume(
          Effect.fail(
            new System.SystemError({
              reason: "Unknown",
              module: "System",
              method: "randomFreePort",
              description: "Failed to allocate a free port",
            }),
          ),
        ),
      )
      return
    }
    const port = address.port
    server.close((err) => {
      if (err) {
        resume(
          Effect.fail(
            new System.SystemError({
              reason: "Unknown",
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

  const message =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String(err.message)
        : String(err)
  const stack: string =
    err instanceof Error
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
