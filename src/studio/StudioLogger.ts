import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as FiberId from "effect/FiberId"
import * as HashMap from "effect/HashMap"
import * as List from "effect/List"
import * as Logger from "effect/Logger"
import * as PubSub from "effect/PubSub"
import * as StudioStore from "./StudioStore.ts"

const studioLogger = Logger.make((options) => {
  const store = StudioStore.store
  if (!store.sql) return

  try {
    const levelMap: Record<string, StudioStore.StudioLog["level"]> = {
      Debug: "DEBUG",
      Info: "INFO",
      Warning: "WARNING",
      Error: "ERROR",
      Fatal: "FATAL",
    }
    const level = levelMap[options.logLevel._tag] ?? "INFO"
    const causeStr = !Cause.isEmpty(options.cause)
      ? Cause.pretty(options.cause, { renderErrorCause: true })
      : undefined
    const spanNames: Array<string> = []
    List.forEach(options.spans, (s) => spanNames.push(s.label))
    const ann: Record<string, unknown> = {}
    HashMap.forEach(options.annotations, (v, k) => {
      ann[k] = v
    })

    const log: StudioStore.StudioLog = {
      id: StudioStore.nextLogId(),
      level,
      message: String(options.message),
      fiberId: FiberId.threadName(options.fiberId),
      cause: causeStr,
      spans: spanNames,
      annotations: ann,
    }
    StudioStore.runWrite(
      Effect.zipRight(
        StudioStore.insertLog(store.sql, log),
        StudioStore.evict(store.sql, "Log", store.logCapacity),
      ),
    )
    Effect.runSync(PubSub.publish(store.events, { _tag: "Log", log }))
  } catch (_) {}
})

export const layer = Logger.add(studioLogger)
