import * as Schema from "effect/Schema"
import * as Route from "../../Route.ts"
import * as RouteSchema from "../../RouteSchema.ts"
import * as Unique from "../../Unique.ts"
import * as Studio from "../Studio.ts"
import * as StudioStore from "../StudioStore.ts"
import * as Fibers from "../ui/Fibers.tsx"
import * as Shell from "../ui/Shell.tsx"

export default Route.get(
  RouteSchema.schemaPathParams(Schema.Struct({ id: Schema.String })),
  Route.html(function* (ctx) {
    const studio = yield* Studio.Studio
    const fiberId = ctx.pathParams.id
    const fiberName = fiberId.startsWith("#") ? fiberId : `#${fiberId}`

    const fiberLogs = yield* StudioStore.logsByFiberId(fiberName)
    const fiberSpans = yield* StudioStore.spansByFiberId(fiberName)

    const hasRecent = fiberLogs.some(
      (l) => Date.now() - Number(Unique.snowflake.timestamp(l.id)) < 5000,
    )
    const status: "alive" | "dead" = hasRecent ? "alive" : "dead"

    const parents = yield* StudioStore.getParentChain(fiberName)
    const fiberContext = yield* StudioStore.getFiberContext(fiberName)

    return (
      <Shell.Shell prefix={studio.path} active="fibers">
        <Fibers.FiberDetail
          prefix={studio.path}
          fiberId={fiberName}
          logs={fiberLogs}
          spans={fiberSpans}
          status={status}
          parents={parents}
          context={fiberContext}
        />
      </Shell.Shell>
    )
  }),
)
