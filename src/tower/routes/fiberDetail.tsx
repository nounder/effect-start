import * as Schema from "effect/Schema"
import * as Route from "../../Route.ts"
import * as RouteSchema from "../../RouteSchema.ts"
import * as Unique from "../../Unique.ts"
import * as HyperRoute from "../../hyper/HyperRoute.ts"
import * as TowerStore from "../TowerStore.ts"
import * as Fibers from "../ui/Fibers.tsx"
import * as Shell from "../ui/Shell.tsx"

export default Route.get(
  RouteSchema.schemaPathParams(Schema.Struct({ id: Schema.String })),
  HyperRoute.html(function* (ctx) {
    const fiberId = ctx.pathParams.id
    const fiberName = fiberId.startsWith("#") ? fiberId : `#${fiberId}`

    const fiberLogs = yield* TowerStore.logsByFiberId(TowerStore.store.sql, fiberName)
    const fiberSpans = yield* TowerStore.spansByFiberId(TowerStore.store.sql, fiberName)

    const fiberNum = parseInt(fiberName.slice(1), 10)
    const counter = TowerStore.fiberIdCounter()
    let alive: "alive" | "dead" | "unknown" = "unknown"
    if (!isNaN(fiberNum)) {
      if (fiberNum < counter) alive = "dead"
      else alive = "unknown"
    }
    if (fiberLogs.length > 0 || fiberSpans.length > 0) {
      const hasRecent = fiberLogs.some((l) => Date.now() - Number(Unique.snowflake.timestamp(l.id)) < 5000)
      if (hasRecent) alive = "alive"
      else if (fiberNum < counter) alive = "dead"
    }

    const parents = yield* TowerStore.getParentChain(TowerStore.store.sql, fiberName)
    const fiberContext = yield* TowerStore.getFiberContext(TowerStore.store.sql, fiberName)

    return (
      <Shell.Shell prefix={TowerStore.store.prefix} active="fibers">
        <Fibers.FiberDetail
          prefix={TowerStore.store.prefix}
          fiberId={fiberName}
          logs={fiberLogs}
          spans={fiberSpans}
          alive={alive}
          parents={parents}
          context={fiberContext}
        />
      </Shell.Shell>
    )
  }),
)
