import * as System from "../../System.ts"
import { Config, Effect, Layer, LogLevel, Option, pipe, Stream, String } from "effect"

export const start = (opts: {
  command?: string
  tunnelName: string
  tunnelUrl?: string
  cleanLogs?: false
  logLevel?: LogLevel.LogLevel
  logPrefix?: string
}) =>
  Effect.gen(function* () {
    const command = opts.command ?? "cloudflared"
    yield* System.which(command)
    const logPrefix = String.isString(opts.logPrefix) ? opts.logPrefix : "CloudflareTunnel: "
    const args: Array<string> = [
      "tunnel",
      "run",
      opts.tunnelUrl ? ["--url", opts.tunnelUrl] : [],
      opts.tunnelName,
    ].flatMap((v) => v)

    const proc = yield* System.spawn([command, ...args])

    yield* Effect.logInfo(
      `Cloudflare tunnel started name=${opts.tunnelName} pid=${proc.pid} tunnelUrl=${
        opts.tunnelUrl ?? "<empty>"
      }`,
    )

    yield* pipe(
      Stream.merge(proc.stdout, proc.stderr),
      Stream.decodeText("utf-8"),
      Stream.splitLines,
      (opts.cleanLogs ?? true)
        ? Stream.map((v) => v.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\s\w+\s/, ""))
        : (s) => s,
      logPrefix ? Stream.map((v) => logPrefix + v) : (s) => s,
      Stream.runForEach((v) => Effect.logWithLevel(opts.logLevel ?? LogLevel.Debug, v)),
    )
  })

export const layer = () =>
  Layer.scopedDiscard(
    Effect.gen(function* () {
      const tunnelName = yield* pipe(
        Config.string("CLOUDFLARE_TUNNEL_NAME"),
        Config.option,
        Effect.andThen(Option.getOrUndefined),
      )
      const tunnelUrl = yield* pipe(
        Config.string("CLOUDFLARE_TUNNEL_URL"),
        Config.option,
        Effect.andThen(Option.getOrUndefined),
      )

      if (!tunnelName) {
        yield* Effect.logWarning("CLOUDFLARE_TUNNEL_NAME not provided. Skipping.")

        return
      }

      yield* Effect.forkScoped(
        start({
          tunnelName,
          tunnelUrl,
        }).pipe(Effect.catchAll((err) => Effect.logError("Cloudflare tunnel failed", err))),
      )
    }),
  )
