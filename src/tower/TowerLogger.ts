import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as FiberId from "effect/FiberId"
import * as HashMap from "effect/HashMap"
import * as List from "effect/List"
import * as Logger from "effect/Logger"
import * as PubSub from "effect/PubSub"
import * as TowerStore from "./TowerStore.ts"

const towerLogger = Logger.make((options) => {
  const store = TowerStore.store
  if (!store.sql) return

  try {
    const levelMap: Record<string, TowerStore.TowerLog["level"]> = {
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

    const log: TowerStore.TowerLog = {
      id: crypto.randomUUID(),
      date: options.date,
      level,
      message: String(options.message),
      fiberId: FiberId.threadName(options.fiberId),
      cause: causeStr,
      spans: spanNames,
      annotations: ann,
    }
    TowerStore.runWrite(
      Effect.zipRight(
        TowerStore.insertLog(store.sql, log),
        TowerStore.evict(store.sql, "Log", store.logCapacity),
      ),
    )
    Effect.runSync(PubSub.publish(store.events, { _tag: "Log", log }))
  } catch (_) {}
})

export const layer = Logger.add(towerLogger)
