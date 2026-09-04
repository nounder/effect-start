import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as PubSub from "effect/PubSub"
import * as References from "effect/References"
import * as Tracing from "../internal/Tracing.ts"
import * as Pretty from "./internal/Pretty.ts"
import * as StudioContext from "./internal/StudioContext.ts"
import * as StudioStore from "./StudioStore.ts"

const make = (store: StudioStore.State) =>
  Logger.make((logOptions) => {
    try {
      const levelMap: Record<string, StudioStore.LogEntry["level"]> = {
        Debug: "DEBUG",
        Info: "INFO",
        Warning: "WARNING",
        Error: "ERROR",
        Fatal: "FATAL",
      }
      const level = levelMap[logOptions.logLevel] ?? "INFO"
      const causeStr = logOptions.cause.reasons.length > 0
        ? Cause.pretty(logOptions.cause)
        : undefined
      const spanNames = logOptions.fiber.getRef(References.CurrentLogSpans).map(([label]) => label)
      const ann = logOptions.fiber.getRef(References.CurrentLogAnnotations)

      const log: StudioStore.LogEntry = {
        id: Tracing.nextPackedId(),
        timestamp: logOptions.date.getTime(),
        level,
        message: Pretty.formatLogMessage(logOptions.message),
        fiberId: `#${logOptions.fiber.id}`,
        cause: causeStr,
        spans: spanNames,
        annotations: ann,
      }
      StudioStore.runWrite(
        store,
        Effect.andThen(
          StudioStore.insertLog(log),
          StudioStore.evict("Log", store.logCapacity),
        ),
      )
      Effect.runSync(PubSub.publish(store.events, { _tag: "Log", log }))
    } catch {}
  })

export const layer: Layer.Layer<never, never, StudioContext.Studio> = Layer
  .unwrap(
    Effect.gen(function*() {
      const studio = yield* StudioContext.Studio
      return Logger.layer([make(studio.store)], { mergeWithExisting: true })
    }),
  )
