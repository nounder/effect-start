/*
 * Adapted from @effect/platform
 */
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"
import type * as Scope from "effect/Scope"
import * as NNet from "node:net"

import * as ChildProcess from "./ChildProcess.ts"

export const TypeId: unique symbol = Symbol.for("@effect/platform/Error/PlatformError")

export type TypeId = typeof TypeId

export const isPlatformError = (u: unknown): u is PlatformError => Predicate.hasProperty(u, TypeId)

export type SystemErrorReason =
  | "AlreadyExists"
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

export class BadArgument extends Data.TaggedError("BadArgument")<{
  module: string
  method: string
  description?: string | undefined
  cause?: unknown
}> {
  readonly [TypeId]: typeof TypeId = TypeId

  get message(): string {
    return `${this.module}.${this.method}${this.description ? `: ${this.description}` : ""}`
  }
}

export class SystemError extends Data.TaggedError("SystemError")<{
  reason: SystemErrorReason
  module: string
  method: string
  description?: string | undefined
  syscall?: string | undefined
  pathOrDescriptor?: string | number | undefined
  cause?: unknown
}> {
  readonly [TypeId]: typeof TypeId = TypeId

  get message(): string {
    return `${this.reason}: ${this.module}.${this.method}${
      this.pathOrDescriptor !== undefined ? ` (${this.pathOrDescriptor})` : ""
    }${this.description ? `: ${this.description}` : ""}`
  }
}

export type PlatformError = BadArgument | SystemError

export const cwd: Effect.Effect<string> = Effect.sync(() => process.cwd())

export const randomFreePort: Effect.Effect<number, SystemError> = Effect.async<
  number,
  SystemError
>((resume) => {
  const server = NNet.createServer()
  server.unref()
  server.on("error", (err) =>
    resume(
      Effect.fail(
        new SystemError({
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
            new SystemError({
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
            new SystemError({
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
  PlatformError,
  ChildProcess.ChildProcessSpawner | Scope.Scope
> => ChildProcess.spawn(ChildProcess.make(cmd, options))
