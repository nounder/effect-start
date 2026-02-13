import * as Schema from "effect/Schema"
import * as Route from "../../Route.ts"
import * as RouteSchema from "../../RouteSchema.ts"
import * as HyperRoute from "../../hyper/HyperRoute.ts"
import * as TowerStore from "../TowerStore.ts"
import * as Shell from "../ui/Shell.tsx"
import * as Traces from "../ui/Traces.tsx"

export default Route.get(
  RouteSchema.schemaPathParams(Schema.Struct({ id: Schema.String })),
  HyperRoute.html(function* (ctx) {
    let traceId: bigint
    try {
      traceId = BigInt(ctx.pathParams.id)
    } catch {
      return (
        <Shell.Shell prefix={TowerStore.store.prefix} active="traces">
          <div class="empty">Trace not found</div>
        </Shell.Shell>
      )
    }
    const spans = yield* TowerStore.spansByTraceId(TowerStore.store.sql, traceId)

    return (
      <Shell.Shell prefix={TowerStore.store.prefix} active="traces">
        <Traces.TraceDetail prefix={TowerStore.store.prefix} spans={spans} />
      </Shell.Shell>
    )
  }),
)
