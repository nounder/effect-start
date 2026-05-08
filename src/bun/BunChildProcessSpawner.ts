import type * as BunTypes from "bun"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Sink from "effect/Sink"
import * as Stream from "effect/Stream"
import * as ChildProcess from "../ChildProcess.ts"
import * as System from "../System.ts"

export const layer: Layer.Layer<ChildProcess.ChildProcessSpawner> = Layer
  .succeed(
    ChildProcess.ChildProcessSpawner,
    {
      spawn: (command) =>
        Effect.gen(function*() {
          const proc = yield* Effect.try({
            try: () =>
              Bun.spawn([command.command, ...command.args], {
                cwd: command.options.cwd,
                env: command.options.env,
                stdin: command.options.stdin ?? "ignore",
                stdout: command.options.stdout ?? "pipe",
                stderr: command.options.stderr ?? "pipe",
                detached: command.options.detached,
              }),
            catch: (err) =>
              new System.SystemError({
                reason: "Unknown",
                module: "ChildProcess",
                method: "spawn",
                description: err instanceof Error
                  ? err.message
                  : "Failed to spawn process",
                cause: err,
              }),
          })

          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              if (!proc.killed) {
                proc.kill()
              }
            })
          )

          const handle: ChildProcess.ChildProcessHandle = {
            pid: proc.pid,

            exitCode: Effect.tryPromise({
              try: () => proc.exited,
              catch: (err) =>
                new System.SystemError({
                  reason: "Unknown",
                  module: "ChildProcess",
                  method: "exitCode",
                  description: "Process exited unexpectedly",
                  cause: err,
                }),
            }),

            isRunning: Effect.try({
              try: () => !proc.killed && proc.exitCode === null,
              catch: (err) =>
                new System.SystemError({
                  reason: "BadResource",
                  module: "ChildProcess",
                  method: "isRunning",
                  description: err instanceof Error
                    ? err.message
                    : "Failed to check process status",
                  cause: err,
                }),
            }),

            kill: (options) =>
              Effect.try({
                try: () => {
                  proc.kill(options?.killSignal)
                },
                catch: (err) =>
                  new System.SystemError({
                    reason: "BadResource",
                    module: "ChildProcess",
                    method: "kill",
                    description: err instanceof Error
                      ? err.message
                      : "Failed to kill process",
                    cause: err,
                  }),
              }),

            stdin: Sink
              .forEach((chunk: Uint8Array) =>
                Effect.try({
                  try: () => {
                    const sink = proc.stdin as unknown as BunTypes.FileSink
                    sink.write(chunk)
                  },
                  catch: (err) =>
                    new System.SystemError({
                      reason: "Unknown",
                      module: "ChildProcess",
                      method: "fromWritable(stdin)",
                      description: "Failed to write to stdin",
                      cause: err,
                    }),
                })
              )
              .pipe(
                Sink.ensuring(
                  Effect.promise(async () => {
                    const sink = proc.stdin as unknown as BunTypes.FileSink
                    await sink.end()
                  }),
                ),
              ),

            stdout: Stream.fromReadableStream(
              () => proc.stdout as ReadableStream<Uint8Array>,
              (err) =>
                new System.SystemError({
                  reason: "Unknown",
                  module: "ChildProcess",
                  method: "fromReadable(stdout)",
                  description: "Failed to read stdout stream",
                  cause: err,
                }),
            ),

            stderr: Stream.fromReadableStream(
              () => proc.stderr as ReadableStream<Uint8Array>,
              (err) =>
                new System.SystemError({
                  reason: "Unknown",
                  module: "ChildProcess",
                  method: "fromReadable(stderr)",
                  description: "Failed to read stderr stream",
                  cause: err,
                }),
            ),
          }

          return handle
        }),
    },
  )
