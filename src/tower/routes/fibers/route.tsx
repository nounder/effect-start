import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Route from "../../../Route.ts"
import * as HyperHtml from "../../../hyper/HyperHtml.ts"
import * as HyperRoute from "../../../hyper/HyperRoute.ts"
import * as TowerStore from "../../TowerStore.ts"
import * as Fibers from "../../ui/Fibers.tsx"
import * as Shell from "../../ui/Shell.tsx"

export default Route.get(
  HyperRoute.html(function* () {
    const logs = yield* TowerStore.allLogs(TowerStore.store.sql)
    const spans = yield* TowerStore.allSpans(TowerStore.store.sql)
    const fibers = Fibers.collectFibers(logs, spans)
    return (
      <Shell.Shell prefix={TowerStore.store.prefix} active="fibers">
        <div style="display:flex;flex-direction:column;flex:1;overflow:hidden">
          <div class="tab-header">Fibers</div>
          <div id="fibers-container" class="tab-body">
            <Fibers.FiberList fibers={fibers} prefix={TowerStore.store.prefix} />
          </div>
          <div data-init={`@get('${TowerStore.store.prefix}/fibers')`} />
        </div>
      </Shell.Shell>
    )
  }),
  Route.sse(
    Stream.fromPubSub(TowerStore.store.events).pipe(
      Stream.filter((e) => e._tag === "SpanStart" || e._tag === "SpanEnd" || e._tag === "Log"),
      Stream.mapEffect(() =>
        Effect.gen(function* () {
          const logs = yield* TowerStore.allLogs(TowerStore.store.sql)
          const spans = yield* TowerStore.allSpans(TowerStore.store.sql)
          const fibers = Fibers.collectFibers(logs, spans)
          const html = HyperHtml.renderToString(
            <Fibers.FiberList fibers={fibers} prefix={TowerStore.store.prefix} />,
          ).replace(/\n/g, "")
          return {
            event: "datastar-patch-elements",
            data: `selector #fibers-container\nmode inner\nelements ${html}`,
          }
        }),
      ),
    ),
  ),
)
