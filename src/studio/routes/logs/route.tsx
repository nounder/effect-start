import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Route from "../../../Route.ts"
import * as Html from "../../../Html.ts"
import * as Studio from "../../Studio.ts"
import * as StudioStore from "../../StudioStore.ts"
import * as Logs from "../../ui/Logs.tsx"
import * as Shell from "../../ui/Shell.tsx"

export default Route.get(
  Route.html(function* (_ctx) {
    const studio = yield* Studio.Studio
    const request = yield* Route.Request
    const url = new URL(request.url)
    const level = url.searchParams.get("logLevel") || ""
    const search = url.searchParams.get("logSearch") || ""
    let logs = yield* StudioStore.allLogs()
    if (level) logs = logs.filter((l) => l.level === level)
    if (search) {
      const lower = search.toLowerCase()
      logs = logs.filter((l) => l.message.toLowerCase().includes(lower))
    }
    logs = logs.reverse()

    return (
      <Shell.Shell prefix={studio.path} active="logs">
        <form
          data-signals={{ logLevel: "", logSearch: "" }}
          style="display:flex;flex-direction:column;flex:1;overflow:hidden"
        >
          <div class="tab-header">Logs</div>
          <div class="filter-bar">
            <select
              name="logLevel"
              data-bind:logLevel
              data-on:change={(c) => c.actions.get(location.href, { contentType: "form" })}
            >
              <option value="">All levels</option>
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
              <option value="FATAL">FATAL</option>
            </select>
            <input
              type="text"
              name="logSearch"
              placeholder="Search..."
              data-bind:logSearch
              data-on:input={(c) => c.actions.get(location.href, { contentType: "form" })}
            />
          </div>
          <div id="logs-container" class="tab-body">
            {logs.map((l) => (
              <Logs.LogLine prefix={studio.path} log={l} />
            ))}
          </div>

          <div data-init={(c) => c.actions.get(`${studio.path}/logs`)} />
        </form>
      </Shell.Shell>
    )
  }),
  Route.sse(
    Effect.gen(function* () {
      const studio = yield* Studio.Studio
      return Stream.fromPubSub(studio.store.events).pipe(
        Stream.filter((e) => e._tag === "Log"),
        Stream.map((e) => {
          const html = Html.renderToString(
            <Logs.LogLine prefix={studio.path} log={e.log} />,
          ).replace(/\n/g, "")
          return {
            event: "datastar-patch-elements",
            data: `selector #logs-container\nmode prepend\nelements ${html}`,
          }
        }),
      )
    }),
  ),
)
