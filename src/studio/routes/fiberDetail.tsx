import * as Schema from "effect/Schema"
import * as Route from "../../Route.ts"
import * as RouteSchema from "../../RouteSchema.ts"
import * as Unique from "../../Unique.ts"
import * as HyperRoute from "../../hyper/HyperRoute.ts"
import * as StudioStore from "../StudioStore.ts"
import * as Fibers from "../ui/Fibers.tsx"
import * as Shell from "../ui/Shell.tsx"

export default Route.get(
  RouteSchema.schemaPathParams(Schema.Struct({ id: Schema.String })),
  HyperRoute.html(function* (ctx) {
    const fiberId = ctx.pathParams.id
    const fiberName = fiberId.startsWith("#") ? fiberId : `#${fiberId}`

    const fiberLogs = yield* StudioStore.logsByFiberId(StudioStore.store.sql, fiberName)
    const fiberSpans = yield* StudioStore.spansByFiberId(StudioStore.store.sql, fiberName)

    const fiberNum = parseInt(fiberName.slice(1), 10)
    const counter = StudioStore.fiberIdCounter()
    let alive: "alive" | "dead" | "unknown" = "unknown"
    if (!isNaN(fiberNum)) {
      if (fiberNum < counter) alive = "dead"
      else alive = "unknown"
    }
    if (fiberLogs.length > 0 || fiberSpans.length > 0) {
      const hasRecent = fiberLogs.some(
        (l) => Date.now() - Number(Unique.snowflake.timestamp(l.id)) < 5000,
      )
      if (hasRecent) alive = "alive"
      else if (fiberNum < counter) alive = "dead"
    }

    const parents = yield* StudioStore.getParentChain(StudioStore.store.sql, fiberName)
    const fiberContext = yield* StudioStore.getFiberContext(StudioStore.store.sql, fiberName)

    return (
      <Shell.Shell prefix={StudioStore.store.prefix} active="fibers">
        <Fibers.FiberDetail
          prefix={StudioStore.store.prefix}
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
