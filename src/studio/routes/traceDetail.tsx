import * as Schema from "effect/Schema"
import * as Route from "../../Route.ts"
import * as RouteSchema from "../../RouteSchema.ts"
import * as Studio from "../Studio.ts"
import * as StudioStore from "../StudioStore.ts"
import * as Shell from "../ui/Shell.tsx"
import * as Traces from "../ui/Traces.tsx"

export default Route.get(
  RouteSchema.schemaPathParams(Schema.Struct({ id: Schema.String })),
  Route.html(function* (ctx) {
    const studio = yield* Studio.Studio
    let traceId: bigint
    try {
      traceId = BigInt(ctx.pathParams.id)
    } catch {
      return (
        <Shell.Shell prefix={studio.prefix} active="traces">
          <div class="empty">Trace not found</div>
        </Shell.Shell>
      )
    }
    const spans = yield* StudioStore.spansByTraceId(traceId)

    return (
      <Shell.Shell prefix={studio.prefix} active="traces">
        <Traces.TraceDetail prefix={studio.prefix} spans={spans} />
      </Shell.Shell>
    )
  }),
)
