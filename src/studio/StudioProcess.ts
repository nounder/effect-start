import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Schedule from "effect/Schedule"
import * as NOS from "node:os"
import * as SqlClient from "../sql/SqlClient.ts"
import * as Studio from "./Studio.ts"
import * as StudioStore from "./StudioStore.ts"

const PERIOD_MS = 2000

export interface ProcessInfo {
  readonly pid: number
  readonly uptime: number
  readonly platform: string
  readonly arch: string
  readonly cpuCount: number
  readonly totalmem: number
}

export function processInfo(): ProcessInfo {
  return {
    pid: process.pid,
    uptime: process.uptime(),
    platform: NOS.platform(),
    arch: NOS.arch(),
    cpuCount: NOS.cpus().length,
    totalmem: NOS.totalmem(),
  }
}

function gauges(timestamp: number): Array<StudioStore.MetricSnapshot> {
  const mem = process.memoryUsage()
  const cpu = process.cpuUsage()
  const res = process.resourceUsage()
  const loadavg = NOS.loadavg()
  const values: Record<string, number> = {
    "memory.rss": mem.rss,
    "memory.heapUsed": mem.heapUsed,
    "memory.heapTotal": mem.heapTotal,
    "memory.external": mem.external,
    "memory.arrayBuffers": mem.arrayBuffers,
    "cpu.user": cpu.user,
    "cpu.system": cpu.system,
    "resourceUsage.maxRSS": res.maxRSS,
    "resourceUsage.minorPageFault": res.minorPageFault,
    "resourceUsage.majorPageFault": res.majorPageFault,
    "resourceUsage.fsRead": res.fsRead,
    "resourceUsage.fsWrite": res.fsWrite,
    "resourceUsage.voluntaryContextSwitches": res.voluntaryContextSwitches,
    "resourceUsage.involuntaryContextSwitches": res.involuntaryContextSwitches,
    "system.loadavg1": loadavg[0],
    "system.loadavg5": loadavg[1],
    "system.loadavg15": loadavg[2],
    "system.freemem": NOS.freemem(),
  }
  return Object.entries(values).map(([name, value]) => ({
    name: StudioStore.PROCESS_METRIC_PREFIX + name,
    type: "gauge" as const,
    value,
    tags: [],
    timestamp,
  }))
}

export const layer: Layer.Layer<
  never,
  never,
  Studio.Studio | SqlClient.SqlClient
> = Layer
  .scopedDiscard(
    Effect.gen(function*() {
      const { store } = yield* Studio.Studio

      const tick = Effect.gen(function*() {
        const timestamp = Math.floor(Date.now() / PERIOD_MS) * PERIOD_MS
        yield* StudioStore.insertMetrics(gauges(timestamp))
        yield* PubSub.publish(store.events, { _tag: "ProcessSnapshot" })
      })

      yield* Effect.forkScoped(
        Effect.schedule(tick, Schedule.spaced(`${PERIOD_MS} millis`)),
      )
    }),
  )
