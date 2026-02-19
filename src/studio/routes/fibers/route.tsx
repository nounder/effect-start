import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Route from "../../../Route.ts"
import * as HyperHtml from "../../../hyper/HyperHtml.ts"
import * as HyperRoute from "../../../hyper/HyperRoute.ts"
import * as StudioStore from "../../StudioStore.ts"
import * as Fibers from "../../ui/Fibers.tsx"
import * as Shell from "../../ui/Shell.tsx"

export default Route.get(
  HyperRoute.html(function* () {
    const logs = yield* StudioStore.allLogs(StudioStore.store.sql)
    const spans = yield* StudioStore.allSpans(StudioStore.store.sql)
    const fibers = Fibers.collectFibers(logs, spans)
    return (
      <Shell.Shell prefix={StudioStore.store.prefix} active="fibers">
        <div style="display:flex;flex-direction:column;flex:1;overflow:hidden">
          <div class="tab-header">Fibers</div>
          <div id="fibers-container" class="tab-body">
            <Fibers.FiberList fibers={fibers} prefix={StudioStore.store.prefix} />
          </div>
          <div data-init={`@get('${StudioStore.store.prefix}/fibers')`} />
        </div>
      </Shell.Shell>
    )
  }),
  Route.sse(
    Stream.fromPubSub(StudioStore.store.events).pipe(
      Stream.filter((e) => e._tag === "SpanStart" || e._tag === "SpanEnd" || e._tag === "Log"),
      Stream.mapEffect(() =>
        Effect.gen(function* () {
          const logs = yield* StudioStore.allLogs(StudioStore.store.sql)
          const spans = yield* StudioStore.allSpans(StudioStore.store.sql)
          const fibers = Fibers.collectFibers(logs, spans)
          const html = HyperHtml.renderToString(
            <Fibers.FiberList fibers={fibers} prefix={StudioStore.store.prefix} />,
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
