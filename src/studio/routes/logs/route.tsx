import * as Stream from "effect/Stream"
import * as Route from "../../../Route.ts"
import * as HyperHtml from "../../../hyper/HyperHtml.ts"
import * as HyperRoute from "../../../hyper/HyperRoute.ts"
import * as StudioStore from "../../StudioStore.ts"
import * as Logs from "../../ui/Logs.tsx"
import * as Shell from "../../ui/Shell.tsx"

const prefix = StudioStore.store.prefix

export default Route.get(
  HyperRoute.html(function* (ctx) {
    const url = new URL(ctx.request.url)
    const level = url.searchParams.get("logLevel") || ""
    const search = url.searchParams.get("logSearch") || ""
    let logs = yield* StudioStore.allLogs(StudioStore.store.sql)
    if (level) logs = logs.filter((l) => l.level === level)
    if (search) {
      const lower = search.toLowerCase()
      logs = logs.filter((l) => l.message.toLowerCase().includes(lower))
    }
    logs = logs.reverse()

    return (
      <Shell.Shell prefix={prefix} active="logs">
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
              <Logs.LogLine log={l} />
            ))}
          </div>
        </form>
      </Shell.Shell>
    )
  }),
  Route.sse(
    Stream.fromPubSub(StudioStore.store.events).pipe(
      Stream.filter((e) => e._tag === "Log"),
      Stream.map((e) => {
        const html = HyperHtml.renderToString(<Logs.LogLine log={e.log} />).replace(/\n/g, "")
        return {
          event: "datastar-patch-elements",
          data: `selector #logs-container\nmode prepend\nelements ${html}`,
        }
      }),
    ),
  ),
)
