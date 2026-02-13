import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Route from "../../../Route.ts"
import * as HyperHtml from "../../../hyper/HyperHtml.ts"
import * as HyperRoute from "../../../hyper/HyperRoute.ts"
import * as TowerStore from "../../TowerStore.ts"
import * as Shell from "../../ui/Shell.tsx"
import * as Traces from "../../ui/Traces.tsx"

const prefix = TowerStore.store.prefix

export default Route.get(
  HyperRoute.html(function* (ctx) {
    const url = new URL(ctx.request.url)
    const search = url.searchParams.get("traceSearch") || ""
    const allSpans = yield* TowerStore.allSpans(TowerStore.store.sql)
    const names = Array.from(new Set(allSpans.map((s) => s.name))).sort()
    let spans = allSpans
    if (search) {
      const lower = search.toLowerCase()
      spans = spans.filter((s) => s.name.toLowerCase().startsWith(lower))
    }

    return (
      <Shell.Shell prefix={prefix} active="traces">
        <form
          data-signals={{ traceSearch: "" }}
          style="display:flex;flex-direction:column;flex:1;overflow:hidden"
        >
          <div class="tab-header">Traces</div>
          <div class="filter-bar">
            <input
              type="text"
              name="traceSearch"
              placeholder="Search trace name..."
              list="trace-names"
              data-bind:traceSearch
              data-on:input={(c) => c.actions.get(location.href, { contentType: "form" })}
            />
            <datalist id="trace-names">
              {names.map((n) => (
                <option value={n} />
              ))}
            </datalist>
          </div>
          <div id="traces-container" class="tab-body">
            <Traces.TraceGroups spans={spans} />
          </div>
        </form>
        <div data-init={`@get('${prefix}/traces')`} />
      </Shell.Shell>
    )
  }),
  Route.sse(
    Stream.fromPubSub(TowerStore.store.events).pipe(
      Stream.filter((e) => e._tag === "SpanStart" || e._tag === "SpanEnd"),
      Stream.mapEffect(() =>
        Effect.gen(function* () {
          const spans = yield* TowerStore.allSpans(TowerStore.store.sql)
          const html = HyperHtml.renderToString(<Traces.TraceGroups spans={spans} />).replace(
            /\n/g,
            "",
          )
          return {
            event: "datastar-patch-elements",
            data: `selector #traces-container\nmode inner\nelements ${html}`,
          }
        }),
      ),
    ),
  ),
)
