import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"

import type * as ChildProcess from "../../ChildProcess.ts"
import type * as PlatformError from "../../PlatformError.ts"
import * as System from "../../System.ts"
import * as BunChildProcessSpawner from "../../bun/BunChildProcessSpawner.ts"

const PORT = 5433
const PASSWORD = "test"
const CONTAINER = "effect-start-pg"

const exec = (
  ...args: Array<string>
): Effect.Effect<number, PlatformError.PlatformError, ChildProcess.ChildProcessSpawner> =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* System.spawn("docker", args, {
        stdout: "ignore",
        stderr: "inherit",
      })
      return yield* handle.exitCode
    }),
  )

const execStdout = (
  ...args: Array<string>
): Effect.Effect<string, PlatformError.PlatformError, ChildProcess.ChildProcessSpawner> =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* System.spawn("docker", args, {
        stdout: "pipe",
        stderr: "inherit",
      })
      const [stdout] = yield* Effect.all(
        [handle.stdout.pipe(Stream.decodeText("utf-8"), Stream.mkString), handle.exitCode],
        { concurrency: 2 },
      )
      return stdout
    }),
  )

const containerRunning = execStdout("ps", "-q", "-f", `name=${CONTAINER}`).pipe(
  Effect.map((stdout) => stdout.trim().length > 0),
)

const removeContainer = exec("rm", "-f", CONTAINER).pipe(Effect.ignore)

const waitReady = Effect.gen(function* () {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const code = yield* exec("exec", CONTAINER, "pg_isready", "-U", "postgres")
    if (code === 0) return
    yield* Effect.sleep("500 millis")
  }
  return yield* Effect.fail(new Error("Timed out waiting for PostgreSQL"))
})

const program = Effect.gen(function* () {
  if (yield* containerRunning) {
    yield* Effect.log("PostgreSQL container already running")
    return
  }

  yield* removeContainer

  yield* Effect.log("Starting PostgreSQL container...")
  const code = yield* exec(
    "run",
    "-d",
    "--name",
    CONTAINER,
    "-p",
    `${PORT}:5432`,
    "-e",
    `POSTGRES_PASSWORD=${PASSWORD}`,
    "-e",
    "POSTGRES_DB=test",
    "postgres:17-alpine",
  )
  if (code !== 0) {
    return yield* Effect.fail(new Error(`docker run exited with code ${code}`))
  }

  yield* waitReady
  yield* Effect.log("PostgreSQL ready")
})

const run = (effect: Effect.Effect<void, unknown, ChildProcess.ChildProcessSpawner>) =>
  Effect.runPromise(Effect.provide(effect, BunChildProcessSpawner.layer))

export const start = () => run(program)

export const stop = () => run(removeContainer)
