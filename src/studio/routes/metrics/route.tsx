import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Route from "../../../Route.ts"
import * as Html from "../../../Html.ts"
import * as Studio from "../../Studio.ts"
import * as Metrics from "../../ui/Metrics.tsx"
import * as Shell from "../../ui/Shell.tsx"

export default Route.get(
  Route.html(function* () {
    const studio = yield* Studio.Studio
    return (
      <Shell.Shell prefix={studio.prefix} active="metrics">
        <div class="tab-header">Metrics</div>
        <div id="metrics-container" class="tab-body metrics-grid">
          <Metrics.MetricsGrid metrics={studio.store.metrics} />
        </div>
        <div data-init={`@get('${studio.prefix}/metrics')`} />
      </Shell.Shell>
    )
  }),
  Route.sse(
    Effect.gen(function* () {
      const studio = yield* Studio.Studio
      return Stream.fromPubSub(studio.store.events).pipe(
        Stream.filter((e) => e._tag === "MetricsSnapshot"),
        Stream.map((e) => {
          const html = Html.renderToString(<Metrics.MetricsGrid metrics={e.metrics} />).replace(
            /\n/g,
            "",
          )
          return {
            event: "datastar-patch-elements",
            data: `selector #metrics-container\nmode inner\nelements ${html}`,
          }
        }),
      )
    }),
  ),
)
