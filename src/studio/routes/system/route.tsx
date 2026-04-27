import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Route from "../../../Route.ts"
import * as Html from "../../../Html.ts"
import * as Studio from "../../Studio.ts"
import * as System from "../../ui/System.tsx"
import * as Shell from "../../ui/Shell.tsx"

export default Route.get(
  Route.html(function* () {
    const studio = yield* Studio.Studio
    const stats = studio.store.process
    return (
      <Shell.Shell prefix={studio.prefix} active="system">
        <div style="display:flex;flex-direction:column;flex:1;overflow:hidden">
          <div class="tab-header">System</div>
          <div id="system-container" class="tab-body">
            {stats ? (
              <System.SystemStatsView stats={stats} />
            ) : (
              <div class="empty">Waiting for system data...</div>
            )}
          </div>
          <div data-init={`@get('${studio.prefix}/system')`} />
        </div>
      </Shell.Shell>
    )
  }),
  Route.sse(
    Effect.gen(function* () {
      const studio = yield* Studio.Studio
      return Stream.fromPubSub(studio.store.events).pipe(
        Stream.filter((e) => e._tag === "ProcessSnapshot"),
        Stream.map((e) => {
          const html = Html.renderToString(<System.SystemStatsView stats={e.stats} />).replace(
            /\n/g,
            "",
          )
          return {
            event: "datastar-patch-elements",
            data: `selector #system-container\nmode inner\nelements ${html}`,
          }
        }),
      )
    }),
  ),
)
