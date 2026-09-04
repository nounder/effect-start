import { Config, Effect, Layer, type LogLevel, Option, pipe, Stream, String } from "effect"
import * as ChildProcess from "effect/unstable/process/ChildProcess"

export const start = (opts: {
  command?: string
  tunnelName: string
  tunnelUrl?: string
  cleanLogs?: false
  logLevel?: LogLevel.Severity
  logPrefix?: string
}) =>
  Effect.gen(function*() {
    const executable = opts.command ?? "cloudflared"
    if (Bun.which(executable) === null) {
      return yield* Effect.fail(new Error(`Command not found: ${executable}`))
    }
    const logPrefix = String.isString(opts.logPrefix)
      ? opts.logPrefix
      : "CloudflareTunnel: "
    const args: Array<string> = [
      "tunnel",
      "run",
      opts.tunnelUrl ? ["--url", opts.tunnelUrl] : [],
      opts.tunnelName,
    ]
      .flatMap((v) => v)

    const proc = yield* ChildProcess.make(executable, args)

    yield* Effect.logInfo(
      `Cloudflare tunnel started name=${opts.tunnelName} pid=${proc.pid} tunnelUrl=${opts.tunnelUrl ?? "<empty>"}`,
    )

    yield* pipe(
      proc.all,
      Stream.decodeText(),
      Stream.splitLines,
      (opts.cleanLogs ?? true)
        ? Stream.map((v) => v.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\s\w+\s/, ""))
        : (s) => s,
      logPrefix ? Stream.map((v) => logPrefix + v) : (s) => s,
      Stream.runForEach((v) => Effect.logWithLevel(opts.logLevel ?? "Debug")(v)),
    )
  })

export const layer = () =>
  Layer.effectDiscard(
    Effect.gen(function*() {
      const tunnelName = Option.getOrUndefined(
        yield* pipe(
          Config.string("CLOUDFLARE_TUNNEL_NAME"),
          Config.option,
        ),
      )
      const tunnelUrl = Option.getOrUndefined(
        yield* pipe(
          Config.string("CLOUDFLARE_TUNNEL_URL"),
          Config.option,
        ),
      )

      if (!tunnelName) {
        yield* Effect.logWarning(
          "CLOUDFLARE_TUNNEL_NAME not provided. Skipping.",
        )

        return
      }

      yield* Effect.forkScoped(
        start({
          tunnelName,
          tunnelUrl,
        })
          .pipe(
            Effect.catch((err) => Effect.logError("Cloudflare tunnel failed", err)),
          ),
      )
    }),
  )
