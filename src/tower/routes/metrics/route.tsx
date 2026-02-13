import * as Stream from "effect/Stream"
import * as Route from "../../../Route.ts"
import * as HyperHtml from "../../../hyper/HyperHtml.ts"
import * as HyperRoute from "../../../hyper/HyperRoute.ts"
import * as TowerStore from "../../TowerStore.ts"
import * as Metrics from "../../ui/Metrics.tsx"
import * as Shell from "../../ui/Shell.tsx"

export default Route.get(
  HyperRoute.html(function* () {
    return (
      <Shell.Shell prefix={TowerStore.store.prefix} active="metrics">
        <div class="tab-header">Metrics</div>
        <div id="metrics-container" class="tab-body metrics-grid">
          <Metrics.MetricsGrid metrics={TowerStore.store.metrics} />
        </div>
        <div data-init={`@get('${TowerStore.store.prefix}/metrics')`} />
      </Shell.Shell>
    )
  }),
  Route.sse(
    Stream.fromPubSub(TowerStore.store.events).pipe(
      Stream.filter((e) => e._tag === "MetricsSnapshot"),
      Stream.map((e) => {
        const html = HyperHtml.renderToString(<Metrics.MetricsGrid metrics={e.metrics} />).replace(
          /\n/g,
          "",
        )
        return {
          event: "datastar-patch-elements",
          data: `selector #metrics-container\nmode inner\nelements ${html}`,
        }
      }),
    ),
  ),
)
