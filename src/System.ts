/*
 * Adapted from @effect/platform
 */
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"
import * as ChildProcess from "./_ChildProcess.ts"

export type Spawner = ChildProcess.ChildProcessSpawner

export type SystemErrorReason =
  | "AlreadyExists"
  | "BadArgument"
  | "BadResource"
  | "Busy"
  | "InvalidData"
  | "NotFound"
  | "PermissionDenied"
  | "TimedOut"
  | "UnexpectedEof"
  | "Unknown"
  | "WouldBlock"
  | "WriteZero"

export class SystemError extends Data.TaggedError("SystemError")<{
  reason: SystemErrorReason
  module: string
  method: string
  description?: string | undefined
  syscall?: string | undefined
  pathOrDescriptor?: string | number | undefined
  cause?: unknown
}> {
  get message(): string {
    return `${this.reason}: ${this.module}.${this.method}${
      this.pathOrDescriptor !== undefined ? ` (${this.pathOrDescriptor})` : ""
    }${this.description ? `: ${this.description}` : ""}`
  }
}

export const cwd: Effect.Effect<string> = Effect.sync(() => process.cwd())

export const which = (name: string): Effect.Effect<string, SystemError> =>
  Effect.flatMap(
    Effect.try({
      try: () => Bun.which(name),
      catch: (err) =>
        new SystemError({
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
            new SystemError({
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
  SystemError,
  ChildProcess.ChildProcessSpawner | Scope.Scope
> => ChildProcess.spawn(ChildProcess.make(cmd, options))
