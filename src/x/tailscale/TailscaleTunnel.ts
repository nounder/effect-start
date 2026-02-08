import * as BunServer from "../../bun/BunServer.ts"
import * as PlatformError from "../../PlatformError.ts"
import * as System from "../../System.ts"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as LogLevel from "effect/LogLevel"
import * as Stream from "effect/Stream"
import * as Function from "effect/Function"

interface TailscaleStatus {
  readonly BackendState: string
  readonly Self?: {
    readonly DNSName?: string
    readonly TailscaleIPs?: ReadonlyArray<string>
  }
}

const getStatus = (command: string) =>
  Effect.gen(function* () {
    const proc = yield* System.spawn(command, ["status", "--json"])
    const exitCode = yield* proc.exitCode

    if (exitCode !== 0) {
      const stderr = yield* proc.stderr.pipe(Stream.decodeText("utf-8"), Stream.mkString)
      return yield* new PlatformError.SystemError({
        reason: "Unknown",
        module: "TailscaleTunnel",
        method: "getStatus",
        description: `tailscale status exited with code ${exitCode}: ${stderr}`,
      })
    }

    const stdout = yield* proc.stdout.pipe(Stream.decodeText("utf-8"), Stream.mkString)
    const json: TailscaleStatus = JSON.parse(stdout)

    if (json.BackendState !== "Running") {
      return yield* new PlatformError.SystemError({
        reason: "Unknown",
        module: "TailscaleTunnel",
        method: "getStatus",
        description: `tailscale is in state "${json.BackendState}", expected "Running"`,
      })
    }

    return json
  })

const serve = (opts: {
  command: string
  port: number
  dnsName?: string
  public?: boolean
  logLevel?: LogLevel.LogLevel
  logPrefix?: string
}) =>
  Effect.gen(function* () {
    const logPrefix = opts.logPrefix ?? "TailscaleTunnel: "
    const args = [opts.public ? "funnel" : "serve", String(opts.port)]

    const proc = yield* System.spawn(opts.command, args)

    yield* Function.pipe(
      Stream.merge(proc.stdout, proc.stderr),
      Stream.decodeText("utf-8"),
      Stream.splitLines,
      logPrefix ? Stream.map((v) => logPrefix + v) : (s) => s,
      Stream.runForEach((v) => Effect.logWithLevel(opts.logLevel ?? LogLevel.Debug, v)),
    )
  })

export const start = (opts: {
  command?: string
  port: number
  public?: boolean
  logLevel?: LogLevel.LogLevel
  logPrefix?: string
}) =>
  Effect.gen(function* () {
    const command = opts.command ?? "tailscale"
    yield* System.which(command)
    const status = yield* getStatus(command)
    const dnsName = status.Self?.DNSName?.replace(/\.$/, "")
    yield* serve({ ...opts, command, dnsName })
  })

export const layer = (opts?: {
  public?: boolean
}) =>
  Layer.scopedDiscard(
    Effect.gen(function* () {
      const { server } = yield* BunServer.BunServer
      const port = server.port!
      const command = "tailscale"
      const ready = yield* Deferred.make<void>()

      const fiber = yield* Effect.forkScoped(
        Effect.gen(function* () {
          yield* System.which(command)
          const status = yield* getStatus(command)
          const dnsName = status.Self?.DNSName?.replace(/\.$/, "")

          const serveUrl = dnsName ? `https://${dnsName}` : undefined
          yield* Effect.logInfo(
            `Tailscale ${opts?.public ? "funnel" : "serve"}${serveUrl ? ` url=${serveUrl}` : ""}`,
          )
          yield* Deferred.succeed(ready, void 0)

          yield* serve({
            command,
            port,
            dnsName,
            public: opts?.public,
          })
        }).pipe(Effect.orDie),
      )

      yield* Fiber.join(fiber).pipe(Effect.raceFirst(Deferred.await(ready)))
    }),
  )
