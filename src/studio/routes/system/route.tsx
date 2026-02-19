import * as Stream from "effect/Stream"
import * as Route from "../../../Route.ts"
import * as HyperHtml from "../../../hyper/HyperHtml.ts"
import * as HyperRoute from "../../../hyper/HyperRoute.ts"
import * as StudioStore from "../../StudioStore.ts"
import * as System from "../../ui/System.tsx"
import * as Shell from "../../ui/Shell.tsx"

export default Route.get(
  HyperRoute.html(function* () {
    const stats = StudioStore.store.process
    return (
      <Shell.Shell prefix={StudioStore.store.prefix} active="system">
        <div style="display:flex;flex-direction:column;flex:1;overflow:hidden">
          <div class="tab-header">System</div>
          <div id="system-container" class="tab-body">
            {stats ? (
              <System.SystemStatsView stats={stats} />
            ) : (
              <div class="empty">Waiting for system data...</div>
            )}
          </div>
          <div data-init={`@get('${StudioStore.store.prefix}/system')`} />
        </div>
      </Shell.Shell>
    )
  }),
  Route.sse(
    Stream.fromPubSub(StudioStore.store.events).pipe(
      Stream.filter((e) => e._tag === "ProcessSnapshot"),
      Stream.map((e) => {
        const html = HyperHtml.renderToString(<System.SystemStatsView stats={e.stats} />).replace(
          /\n/g,
          "",
        )
        return {
          event: "datastar-patch-elements",
          data: `selector #system-container\nmode inner\nelements ${html}`,
        }
      }),
    ),
  ),
)
