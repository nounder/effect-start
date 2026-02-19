/**
 * Adapted from upcomnig Effect 4 aka effect-smol.
 *
 * Kept a minimal interface without tempaltes and file descirptor
 * to keep it compatible if it lands in the core (ie. not in seperate platform package.)
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import type * as Scope from "effect/Scope"
import type * as Sink from "effect/Sink"
import type * as Stream from "effect/Stream"
import * as Utils from "effect/Utils"

import type * as PlatformError from "./PlatformError.ts"

const TypeId = "~effect-start/ChildProcess/Command" as const

type Stdio = "pipe" | "inherit" | "ignore"

export interface Command extends Pipeable.Pipeable {
  readonly [TypeId]: typeof TypeId
  readonly cmd: readonly [string, ...Array<string>]
  readonly cwd?: string
  readonly env?: Record<string, string>
  readonly stdin?: Stdio
  readonly stdout?: Stdio
  readonly stderr?: Stdio
  readonly detached?: boolean
  [Symbol.iterator](): Effect.EffectGenerator<
    Effect.Effect<
      ChildProcessHandle,
      PlatformError.PlatformError,
      ChildProcessSpawner | Scope.Scope
    >
  >
}

export namespace Command {
  export interface Options {
    readonly cwd?: string
    readonly env?: Record<string, string>
    readonly stdin?: Stdio
    readonly stdout?: Stdio
    readonly stderr?: Stdio
    readonly detached?: boolean
  }
}

const CommandProto = {
  [TypeId]: TypeId,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
  [Symbol.iterator](this: Command) {
    return new Utils.SingleShotGen(new Utils.YieldWrap(spawn(this))) as any
  },
}

export const isCommand = (u: unknown): u is Command => Predicate.hasProperty(u, TypeId)

export const make = (
  cmd: readonly [string, ...Array<string>],
  options?: Command.Options,
): Command =>
  Object.assign(Object.create(CommandProto), {
    cmd,
    ...options,
  })

export type Signal =
  | "SIGABRT"
  | "SIGALRM"
  | "SIGBUS"
  | "SIGCHLD"
  | "SIGCONT"
  | "SIGFPE"
  | "SIGHUP"
  | "SIGILL"
  | "SIGINT"
  | "SIGIO"
  | "SIGIOT"
  | "SIGKILL"
  | "SIGPIPE"
  | "SIGPOLL"
  | "SIGPROF"
  | "SIGPWR"
  | "SIGQUIT"
  | "SIGSEGV"
  | "SIGSTKFLT"
  | "SIGSTOP"
  | "SIGSYS"
  | "SIGTERM"
  | "SIGTRAP"
  | "SIGTSTP"
  | "SIGTTIN"
  | "SIGTTOU"
  | "SIGUNUSED"
  | "SIGURG"
  | "SIGUSR1"
  | "SIGUSR2"
  | "SIGVTALRM"
  | "SIGWINCH"
  | "SIGXCPU"
  | "SIGXFSZ"
  | "SIGBREAK"
  | "SIGLOST"
  | "SIGINFO"

export interface KillOptions {
  readonly killSignal?: Signal | undefined
}

export interface ChildProcessHandle {
  readonly pid: number
  readonly exitCode: Effect.Effect<number, PlatformError.PlatformError>
  readonly isRunning: Effect.Effect<boolean, PlatformError.PlatformError>
  readonly kill: (options?: KillOptions) => Effect.Effect<void, PlatformError.PlatformError>
  readonly stdin: Sink.Sink<void, Uint8Array, never, PlatformError.PlatformError>
  readonly stdout: Stream.Stream<Uint8Array, PlatformError.PlatformError>
  readonly stderr: Stream.Stream<Uint8Array, PlatformError.PlatformError>
}

export class ChildProcessSpawner extends Context.Tag("effect-start/ChildProcessSpawner")<
  ChildProcessSpawner,
  {
    readonly spawn: (
      command: Command,
    ) => Effect.Effect<ChildProcessHandle, PlatformError.PlatformError, Scope.Scope>
  }
>() {}

export const spawn = (
  command: Command,
): Effect.Effect<
  ChildProcessHandle,
  PlatformError.PlatformError,
  ChildProcessSpawner | Scope.Scope
> => Effect.flatMap(ChildProcessSpawner, (spawner) => spawner.spawn(command))
