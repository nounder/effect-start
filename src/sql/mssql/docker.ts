import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"

import type * as ChildProcess from "../../ChildProcess.ts"
import type * as PlatformError from "../../PlatformError.ts"
import type * as Mssql from "mssql"
import * as System from "../../System.ts"
import * as BunChildProcessSpawner from "../../bun/BunChildProcessSpawner.ts"

const PORT = 1433
const PASSWORD = "TestPass123"
const CONTAINER = "effect-start-mssql"

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

type MssqlModule = {
  ConnectionPool: new (config: Mssql.config) => Mssql.ConnectionPool
}

const loadMssql = () => import("mssql") as Promise<MssqlModule>

const canConnect = Effect.tryPromise({
  try: async () => {
    const { ConnectionPool } = await loadMssql()
    const pool = new ConnectionPool({
      server: "localhost",
      user: "sa",
      password: PASSWORD,
      port: PORT,
      options: { encrypt: true, trustServerCertificate: true, connectTimeout: 3000 },
    })
    await pool.connect()
    await pool.close()
    return true
  },
  catch: () => false as const,
}).pipe(Effect.orElseSucceed(() => false))

const waitReady = Effect.gen(function* () {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (yield* canConnect) return
    yield* Effect.sleep("2 seconds")
  }
  return yield* Effect.fail(new Error("Timed out waiting for MSSQL"))
})

const program = Effect.gen(function* () {
  if (yield* containerRunning) {
    yield* Effect.log("MSSQL container already running")
    return
  }

  yield* removeContainer

  yield* Effect.log("Starting MSSQL container...")
  const code = yield* exec(
    "run",
    "-d",
    "--name",
    CONTAINER,
    "-p",
    `${PORT}:1433`,
    "-e",
    "ACCEPT_EULA=Y",
    "-e",
    `MSSQL_SA_PASSWORD=${PASSWORD}`,
    "mcr.microsoft.com/azure-sql-edge",
  )
  if (code !== 0) {
    return yield* Effect.fail(new Error(`docker run exited with code ${code}`))
  }

  yield* waitReady
  yield* Effect.log("MSSQL ready")
})

const run = (effect: Effect.Effect<void, unknown, ChildProcess.ChildProcessSpawner>) =>
  Effect.runPromise(Effect.provide(effect, BunChildProcessSpawner.layer))

export const start = () => run(program)

export const stop = () => run(removeContainer)
