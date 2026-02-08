import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"

import * as ChildProcess from "./ChildProcess.ts"
import * as PlatformError from "./PlatformError.ts"

export const cwd: Effect.Effect<string> = Effect.sync(() => process.cwd())

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
