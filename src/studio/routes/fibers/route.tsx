import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Route from "../../../Route.ts"
import * as Html from "../../../Html.ts"
import * as SqlClient from "../../../sql/SqlClient.ts"
import * as Studio from "../../Studio.ts"
import * as StudioStore from "../../StudioStore.ts"
import * as Fibers from "../../ui/Fibers.tsx"
import * as Shell from "../../ui/Shell.tsx"

export default Route.get(
  Route.html(function* () {
    const studio = yield* Studio.Studio
    const logs = yield* StudioStore.allLogs()
    const spans = yield* StudioStore.allSpans()
    const fibers = Fibers.collectFibers(logs, spans)
    return (
      <Shell.Shell prefix={studio.prefix} active="fibers">
        <div style="display:flex;flex-direction:column;flex:1;overflow:hidden">
          <div class="tab-header">Fibers</div>
          <div id="fibers-container" class="tab-body">
            <Fibers.FiberList fibers={fibers} prefix={studio.prefix} />
          </div>
          <div data-init={`@get('${studio.prefix}/fibers')`} />
        </div>
      </Shell.Shell>
    )
  }),
  Route.sse(
    Effect.gen(function* () {
      const studio = yield* Studio.Studio
      const sql = yield* SqlClient.SqlClient
      return Stream.fromPubSub(studio.store.events).pipe(
        Stream.filter((e) => e._tag === "SpanStart" || e._tag === "SpanEnd" || e._tag === "Log"),
        Stream.mapEffect(() =>
          Effect.gen(function* () {
            const logs = yield* StudioStore.allLogs()
            const spans = yield* StudioStore.allSpans()
            const fibers = Fibers.collectFibers(logs, spans)
            const html = Html.renderToString(
              <Fibers.FiberList fibers={fibers} prefix={studio.prefix} />,
            ).replace(/\n/g, "")
            return {
              event: "datastar-patch-elements",
              data: `selector #fibers-container\nmode inner\nelements ${html}`,
            }
          }).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
        ),
      )
    }),
  ),
)
