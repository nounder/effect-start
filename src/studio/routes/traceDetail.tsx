import * as Schema from "effect/Schema"
import * as Route from "../../Route.ts"
import * as RouteSchema from "../../RouteSchema.ts"
import * as HyperRoute from "../../hyper/HyperRoute.ts"
import * as StudioStore from "../StudioStore.ts"
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
        <Shell.Shell prefix={StudioStore.store.prefix} active="traces">
          <div class="empty">Trace not found</div>
        </Shell.Shell>
      )
    }
    const spans = yield* StudioStore.spansByTraceId(StudioStore.store.sql, traceId)

    return (
      <Shell.Shell prefix={StudioStore.store.prefix} active="traces">
        <Traces.TraceDetail prefix={StudioStore.store.prefix} spans={spans} />
      </Shell.Shell>
    )
  }),
)
