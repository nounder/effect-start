import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as FiberId from "effect/FiberId"
import * as HashMap from "effect/HashMap"
import * as Layer from "effect/Layer"
import * as List from "effect/List"
import * as Logger from "effect/Logger"
import * as PubSub from "effect/PubSub"
import * as SqlClient from "../sql/SqlClient.ts"
import * as Pretty from "./_Pretty.ts"
import * as Studio from "./Studio.ts"
import * as StudioStore from "./StudioStore.ts"

const make = (store: StudioStore.State, sql: SqlClient.SqlClient) =>
  Logger.make((logOptions) => {
    try {
      const levelMap: Record<string, StudioStore.LogEntry["level"]> = {
        Debug: "DEBUG",
        Info: "INFO",
        Warning: "WARNING",
        Error: "ERROR",
        Fatal: "FATAL",
      }
      const level = levelMap[logOptions.logLevel._tag] ?? "INFO"
      const causeStr = !Cause.isEmpty(logOptions.cause)
        ? Cause.pretty(logOptions.cause, { renderErrorCause: true })
        : undefined
      const spanNames: Array<string> = []
      List.forEach(logOptions.spans, (s) => spanNames.push(s.label))
      const ann: Record<string, unknown> = {}
      HashMap.forEach(logOptions.annotations, (v, k) => {
        ann[k] = v
      })

      const log: StudioStore.LogEntry = {
        id: StudioStore.nextLogId(),
        level,
        message: Pretty.formatLogMessage(logOptions.message),
        fiberId: FiberId.threadName(logOptions.fiberId),
        cause: causeStr,
        spans: spanNames,
        annotations: ann,
      }
      StudioStore.runWrite(
        sql,
        Effect.zipRight(StudioStore.insertLog(log), StudioStore.evict("Log", store.logCapacity)),
      )
      Effect.runSync(PubSub.publish(store.events, { _tag: "Log", log }))
    } catch (_) {}
  })

export const layer: Layer.Layer<
  never,
  never,
  Studio.Studio | SqlClient.SqlClient
> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const studio = yield* Studio.Studio
    const sql = yield* SqlClient.SqlClient
    return Logger.add(make(studio.store, sql))
  }),
)
