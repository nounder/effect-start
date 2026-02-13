import * as NOS from "node:os"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Schedule from "effect/Schedule"
import * as TowerStore from "./TowerStore.ts"

function snapshot(): TowerStore.ProcessStats {
  const mem = process.memoryUsage()
  const cpu = process.cpuUsage()
  const res = process.resourceUsage()
  const loadavg = NOS.loadavg() as [number, number, number]
  return {
    pid: process.pid,
    uptime: process.uptime(),
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
    },
    cpu: { user: cpu.user, system: cpu.system },
    resourceUsage: {
      maxRSS: res.maxRSS,
      minorPageFault: res.minorPageFault,
      majorPageFault: res.majorPageFault,
      fsRead: res.fsRead,
      fsWrite: res.fsWrite,
      voluntaryContextSwitches: res.voluntaryContextSwitches,
      involuntaryContextSwitches: res.involuntaryContextSwitches,
    },
    system: {
      loadavg,
      freemem: NOS.freemem(),
      totalmem: NOS.totalmem(),
      cpuCount: NOS.cpus().length,
      platform: NOS.platform(),
      arch: NOS.arch(),
    },
  }
}

export const layer: Layer.Layer<never, never, TowerStore.TowerStore> = Layer.scopedDiscard(
  Effect.gen(function* () {
    const store = yield* TowerStore.TowerStore

    yield* Effect.forkScoped(
      Effect.schedule(
        Effect.sync(() => {
          const stats = snapshot()
          store.process = stats
          Effect.runSync(PubSub.publish(store.events, { _tag: "ProcessSnapshot", stats }))
        }),
        Schedule.spaced("2 seconds"),
      ),
    )
  }),
)
