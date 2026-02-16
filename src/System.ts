import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"
import * as NNet from "node:net"

import * as ChildProcess from "./ChildProcess.ts"
import * as PlatformError from "./PlatformError.ts"

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
  command: string,
  args?: ReadonlyArray<string>,
  options?: ChildProcess.Command.Options,
): Effect.Effect<
  ChildProcess.ChildProcessHandle,
  PlatformError.PlatformError,
  ChildProcess.ChildProcessSpawner | Scope.Scope
> => ChildProcess.spawn(ChildProcess.make(command, args, options))
