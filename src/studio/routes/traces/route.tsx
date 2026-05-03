import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Route from "../../../Route.ts"
import * as Html from "../../../Html.ts"
import * as SqlClient from "../../../sql/SqlClient.ts"
import * as Studio from "../../Studio.ts"
import * as StudioStore from "../../StudioStore.ts"
import * as Shell from "../../ui/Shell.tsx"
import * as Traces from "../../ui/Traces.tsx"

export default Route.get(
  Route.html(function* (_ctx) {
    const studio = yield* Studio.Studio
    const request = yield* Route.Request
    const url = new URL(request.url)
    const search = url.searchParams.get("traceSearch") || ""
    const allSpans = StudioStore.filterOutStudioSpans(yield* StudioStore.allSpans())
    const names = Array.from(new Set(allSpans.map((s) => s.name))).sort()
    let spans = allSpans
    if (search) {
      const lower = search.toLowerCase()
      spans = spans.filter((s) => s.name.toLowerCase().startsWith(lower))
    }

    return (
      <Shell.Shell prefix={studio.path} active="traces">
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
            <Traces.TraceGroups prefix={studio.path} spans={spans} />
          </div>
        </form>
        <div data-init={(c) => c.actions.get("traces")} />
      </Shell.Shell>
    )
  }),
  Route.sse(
    Effect.gen(function* () {
      const studio = yield* Studio.Studio
      const sql = yield* SqlClient.SqlClient
      return Stream.fromPubSub(studio.store.events).pipe(
        Stream.filter((e) => e._tag === "TraceEnd"),
        Stream.mapEffect((e) =>
          Effect.gen(function* () {
            const traceSpans = yield* StudioStore.spansByTraceId(e.traceId)
            if (StudioStore.isStudioTrace(traceSpans)) {
              return undefined
            }
            const traceHtml = Html.renderToString(
              <Traces.TraceGroup prefix={studio.path} id={e.traceId} spans={traceSpans} />,
            )

            return {
              event: "datastar-patch-elements",
              data: `selector .tl-header\nmode after\nelements ${traceHtml}`,
            }
          }).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
        ),
        Stream.filter((event): event is { event: string; data: string } => event !== undefined),
      )
    }),
  ),
)
