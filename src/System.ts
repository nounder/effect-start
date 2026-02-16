import * as Cause from "effect/Cause"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import type * as Fiber from "effect/Fiber"
import * as GlobalValue from "effect/GlobalValue"
import * as HashMap from "effect/HashMap"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import type * as Scope from "effect/Scope"
import * as NNet from "node:net"

import * as ChildProcess from "./ChildProcess.ts"
import * as PlatformError from "./PlatformError.ts"
import * as PlatformRuntime from "./PlatformRuntime.ts"

export const cwd: Effect.Effect<string> = Effect.sync(() => process.cwd())

export const randomFreePort: Effect.Effect<number, PlatformError.SystemError> = Effect.async<
  number,
  PlatformError.SystemError
>((resume) => {
  const server = NNet.createServer()
  server.unref()
  server.on("error", (err) =>
    resume(
      Effect.fail(
        new PlatformError.SystemError({
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
            new PlatformError.SystemError({
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
            new PlatformError.SystemError({
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

export const which = (name: string): Effect.Effect<string, PlatformError.SystemError> =>
  Effect.flatMap(
    Effect.try({
      try: () => Bun.which(name),
      catch: (err) =>
        new PlatformError.SystemError({
          reason: "Unknown",
          module: "System",
          method: "which",
          description: err instanceof Error ? err.message : `Failed to look up "${name}"`,
          cause: err,
        }),
    }),
    (path) =>
      path === null
        ? Effect.fail(
            new PlatformError.SystemError({
              reason: "NotFound",
              module: "System",
              method: "which",
              description: `Executable not found: "${name}"`,
            }),
          )
        : Effect.succeed(path),
  )

export const spawn = (
  cmd: readonly [string, ...Array<string>],
  options?: ChildProcess.Command.Options,
): Effect.Effect<
  ChildProcess.ChildProcessHandle,
  PlatformError.PlatformError,
  ChildProcess.ChildProcessSpawner | Scope.Scope
> => ChildProcess.spawn(ChildProcess.make(cmd, options))

export const layerSpawn = (
  cmd: readonly [string, ...Array<string>],
  options?: Pick<ChildProcess.Command.Options, "cwd" | "env">,
): Layer.Layer<never, PlatformError.PlatformError, ChildProcess.ChildProcessSpawner> => {
  const persistentChildProcesses = GlobalValue.globalValue(
    Symbol.for("effect-start/System/persistentChildProcesses"),
    () => MutableRef.make(HashMap.empty<readonly [string, ...Array<string>], Fiber.RuntimeFiber<void>>()),
  )

  return Layer.effectDiscard(
    Effect.gen(function* () {
      const key = Data.tuple(...cmd)
      const existing = HashMap.get(MutableRef.get(persistentChildProcesses), key)

      if (existing._tag === "Some") return

      const spawner = yield* ChildProcess.ChildProcessSpawner
      const fiber = Effect.runFork(
        Effect.scoped(
          Effect.gen(function* () {
            const handle = yield* spawn(cmd, options)
            const code = yield* handle.exitCode
            if (code !== 0) {
              yield* new PlatformError.SystemError({
                reason: "Unknown",
                module: "System",
                method: "layerSpawn",
                description: `Process "${cmd[0]}" exited with code ${code}`,
              })
            }
          }).pipe(Effect.provideService(ChildProcess.ChildProcessSpawner, spawner)),
        ),
      )
      MutableRef.update(persistentChildProcesses, HashMap.set(key, fiber))
      fiber.addObserver((exit) => {
        MutableRef.update(persistentChildProcesses, HashMap.remove(key))
        if (Exit.isSuccess(exit)) return
        if (Cause.isInterruptedOnly(exit.cause)) return
        const current = MutableRef.get(PlatformRuntime.mainFiber)
        if (current) {
          current.unsafeInterruptAsFork(current.id())
        }
      })
    }),
  )
}
