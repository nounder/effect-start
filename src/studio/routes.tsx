import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Bundle from "../bundler/Bundle.ts"
import * as Entity from "../Entity.ts"
import * as Html from "../Html.ts"
import * as Route from "../Route.ts"
import * as RouteMap from "../RouteMap.ts"
import * as RouteSchema from "../RouteSchema.ts"
import * as SqlClient from "../sql/SqlClient.ts"
import * as Unique from "../Unique.ts"
import css from "./css.ts"
import * as Studio from "./Studio.ts"
import * as StudioStore from "./StudioStore.ts"
import * as Ui from "./ui.tsx"

export default Route.map({
  "*": Route.use(
    Route.render(function*(_, next) {
      const studio = yield* Studio.Studio
      const request = yield* Route.Request

      if (!studio.auth || studio.auth.type !== "basic") {
        return yield* next
      }

      const header = request.headers.get("authorization")
      const expected = "Basic " +
        btoa(`${studio.auth.username}:${studio.auth.password}`)
      if (header !== expected) {
        return Entity.make("Unauthorized", {
          status: 401,
          headers: {
            "www-authenticate": "Basic realm=\"Studio\", charset=\"UTF-8\"",
            "content-type": "text/plain; charset=utf-8",
          },
        })
      }

      return yield* next
    }),
    Route.filter(function*() {
      yield* Effect.annotateCurrentSpan(StudioStore.studioTraceAttribute, true)
      return { context: {} }
    }),
    Route.html(function*(_, next) {
      const studio = yield* Studio.Studio
      const bundle = yield* Bundle.ClientBundle
      const base = studio.path.endsWith("/") ? studio.path : `${studio.path}/`
      return (
        <html style="height: 100%">
          <head>
            <title>Effect Studio</title>
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
            <base href={base} />
            <style>{css}</style>
            <script
              type="module"
              src={bundle.resolve("effect-start/datastar")}
            />
          </head>
          <body>{yield* next.html}</body>
        </html>
      )
    }),
  ),

  "/": Route.get(
    Route.render(function*() {
      const studio = yield* Studio.Studio
      return Route.redirect(`${studio.path}/traces`)
    }),
  ),

  "/traces": Route.get(
    Route.html(function*() {
      const studio = yield* Studio.Studio
      const request = yield* Route.Request
      const url = new URL(request.url)
      const search = url.searchParams.get("traceSearch") || ""
      const allSpans = StudioStore.filterOutStudioSpans(
        yield* StudioStore.allSpans(),
      )
      const names = Array.from(new Set(allSpans.map((s) => s.name))).sort()
      let spans = allSpans
      if (search) {
        const lower = search.toLowerCase()
        spans = spans.filter((s) => s.name.toLowerCase().startsWith(lower))
      }

      return (
        <Ui.Shell prefix={studio.path} active="traces">
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
                data-on:input={(c) =>
                  c.actions.get(location.href, { contentType: "form" })}
              />
              <datalist id="trace-names">
                {names.map((n) => <option value={n} />)}
              </datalist>
            </div>
            <div id="traces-container" class="tab-body">
              <Ui.TraceGroups prefix={studio.path} spans={spans} />
            </div>
          </form>
          <div data-init={(c) => c.actions.get("traces")} />
        </Ui.Shell>
      )
    }),
    Route.sse(
      Effect.gen(function*() {
        const studio = yield* Studio.Studio
        const sql = yield* SqlClient.SqlClient
        return Stream.fromPubSub(studio.store.events).pipe(
          Stream.filter((e) => e._tag === "TraceEnd"),
          Stream.mapEffect((e) =>
            Effect
              .gen(function*() {
                const traceSpans = yield* StudioStore.spansByTraceId(e.traceId)
                if (StudioStore.isStudioTrace(traceSpans)) return undefined
                const traceHtml = Html.text(
                  <Ui.TraceGroup
                    prefix={studio.path}
                    id={e.traceId}
                    spans={traceSpans}
                  />,
                )
                return {
                  event: "datastar-patch-elements",
                  data:
                    `selector .tl-header\nmode after\nelements ${traceHtml}`,
                }
              })
              .pipe(Effect.provideService(SqlClient.SqlClient, sql))
          ),
          Stream.filter((event): event is { event: string; data: string } =>
            event !== undefined
          ),
        )
      }),
    ),
  ),

  "/traces/:id": Route.get(
    RouteSchema.schemaPathParams(Schema.Struct({ id: Schema.String })),
    Route.html(function*(ctx) {
      const studio = yield* Studio.Studio
      let traceId: bigint
      try {
        traceId = BigInt(ctx.pathParams.id)
      } catch {
        return (
          <Ui.Shell prefix={studio.path} active="traces">
            <div class="empty">Trace not found</div>
          </Ui.Shell>
        )
      }
      const spans = yield* StudioStore.spansByTraceId(traceId)
      return (
        <Ui.Shell prefix={studio.path} active="traces">
          <Ui.TraceDetail prefix={studio.path} spans={spans} />
        </Ui.Shell>
      )
    }),
  ),

  "/metrics": Route.get(
    Route.html(function*() {
      const studio = yield* Studio.Studio
      return (
        <Ui.Shell prefix={studio.path} active="metrics">
          <div class="tab-header">Metrics</div>
          <div id="metrics-container" class="tab-body metrics-grid">
            <Ui.MetricsGrid metrics={studio.store.metrics} />
          </div>
          <div data-init={(c) => c.actions.get("metrics")} />
        </Ui.Shell>
      )
    }),
    Route.sse(
      Effect.gen(function*() {
        const studio = yield* Studio.Studio
        return Stream.fromPubSub(studio.store.events).pipe(
          Stream.filter((e) => e._tag === "MetricsSnapshot"),
          Stream.map((e) => {
            const html = Html
              .text(<Ui.MetricsGrid metrics={e.metrics} />)
              .replace(/\n/g, "")
            return {
              event: "datastar-patch-elements",
              data: `selector #metrics-container\nmode inner\nelements ${html}`,
            }
          }),
        )
      }),
    ),
  ),

  "/logs": Route.get(
    Route.html(function*() {
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
        <Ui.Shell prefix={studio.path} active="logs">
          <form
            data-signals={{ logLevel: "", logSearch: "" }}
            style="display:flex;flex-direction:column;flex:1;overflow:hidden"
          >
            <div class="tab-header">Logs</div>
            <div class="filter-bar">
              <select
                name="logLevel"
                data-bind:logLevel
                data-on:change={(c) =>
                  c.actions.get(location.href, { contentType: "form" })}
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
                data-on:input={(c) =>
                  c.actions.get(location.href, { contentType: "form" })}
              />
            </div>
            <div id="logs-container" class="tab-body">
              {logs.map((l) => <Ui.LogLine prefix={studio.path} log={l} />)}
            </div>
            <div data-init={(c) => c.actions.get("logs")} />
          </form>
        </Ui.Shell>
      )
    }),
    Route.sse(
      Effect.gen(function*() {
        const studio = yield* Studio.Studio
        return Stream.fromPubSub(studio.store.events).pipe(
          Stream.filter((e) => e._tag === "Log"),
          Stream.map((e) => {
            const html = Html
              .text(<Ui.LogLine prefix={studio.path} log={e.log} />)
              .replace(/\n/g, "")
            return {
              event: "datastar-patch-elements",
              data: `selector #logs-container\nmode prepend\nelements ${html}`,
            }
          }),
        )
      }),
    ),
  ),

  "/errors": Route.get(
    Route.html(function*() {
      const studio = yield* Studio.Studio
      const request = yield* Route.Request
      const url = new URL(request.url)
      const search = url.searchParams.get("errorSearch") || ""
      const tag = url.searchParams.get("errorTag") || ""
      const allErrors = yield* StudioStore.allErrors()
      const tagSet = new Set<string>()
      for (const error of allErrors) {
        for (const d of error.details) {
          if (d.tag) tagSet.add(d.tag)
        }
      }
      const sortedTags = Array.from(tagSet).sort()
      let errors = allErrors
      if (tag) {
        errors = errors.filter((e) =>
          e.details.some((d) => d.tag && d.tag.startsWith(tag))
        )
      }
      if (search) {
        const lower = search.toLowerCase()
        errors = errors.filter((e) => {
          const firstLine = e.prettyPrint.split("\n")[0] ?? ""
          return firstLine.toLowerCase().includes(lower)
        })
      }
      errors = errors.reverse()

      return (
        <Ui.Shell prefix={studio.path} active="errors">
          <form
            data-signals={{ errorSearch: "", errorTag: "" }}
            style="display:flex;flex-direction:column;flex:1;overflow:hidden"
          >
            <div class="tab-header">Errors</div>
            <div class="filter-bar">
              <input
                type="text"
                name="errorSearch"
                placeholder="Search..."
                data-bind:errorSearch
                data-on:input={(c) =>
                  c.actions.get(location.href, { contentType: "form" })}
              />
              <input
                type="text"
                name="errorTag"
                placeholder="Tag..."
                list="error-tags"
                data-bind:errorTag
                data-on:input={(c) =>
                  c.actions.get(location.href, { contentType: "form" })}
              />
              <datalist id="error-tags">
                {sortedTags.map((t) => <option value={t} />)}
              </datalist>
            </div>
            <div id="errors-list" class="tab-body">
              {errors.map((e) => (
                <Ui.ErrorLine prefix={studio.path} error={e} />
              ))}
            </div>
            <div data-init={(c) => c.actions.get("errors")} />
          </form>
        </Ui.Shell>
      )
    }),
    Route.sse(
      Effect.gen(function*() {
        const studio = yield* Studio.Studio
        return Stream.fromPubSub(studio.store.events).pipe(
          Stream.filter((e) => e._tag === "Error"),
          Stream.map((e) => {
            const html = Html
              .text(<Ui.ErrorLine prefix={studio.path} error={e.error} />)
              .replace(/\n/g, "")
            return {
              event: "datastar-patch-elements",
              data: `selector #errors-list\nmode prepend\nelements ${html}`,
            }
          }),
        )
      }),
    ),
  ),

  "/fibers": Route.get(
    Route.html(function*() {
      const studio = yield* Studio.Studio
      const logs = yield* StudioStore.allLogs()
      const spans = yield* StudioStore.allSpans()
      const fibers = Ui.collectFibers(logs, spans)
      return (
        <Ui.Shell prefix={studio.path} active="fibers">
          <div style="display:flex;flex-direction:column;flex:1;overflow:hidden">
            <div class="tab-header">Fibers</div>
            <div id="fibers-container" class="tab-body">
              <Ui.FiberList fibers={fibers} prefix={studio.path} />
            </div>
            <div data-init={(c) => c.actions.get("fibers")} />
          </div>
        </Ui.Shell>
      )
    }),
    Route.sse(
      Effect.gen(function*() {
        const studio = yield* Studio.Studio
        const sql = yield* SqlClient.SqlClient
        return Stream.fromPubSub(studio.store.events).pipe(
          Stream.filter((e) =>
            e._tag === "SpanStart" || e._tag === "SpanEnd" ||
            e._tag === "Log"
          ),
          Stream.mapEffect(() =>
            Effect
              .gen(function*() {
                const logs = yield* StudioStore.allLogs()
                const spans = yield* StudioStore.allSpans()
                const fibers = Ui.collectFibers(logs, spans)
                const html = Html
                  .text(
                    <Ui.FiberList fibers={fibers} prefix={studio.path} />,
                  )
                  .replace(/\n/g, "")
                return {
                  event: "datastar-patch-elements",
                  data:
                    `selector #fibers-container\nmode inner\nelements ${html}`,
                }
              })
              .pipe(Effect.provideService(SqlClient.SqlClient, sql))
          ),
        )
      }),
    ),
  ),

  "/fibers/:id": Route.get(
    RouteSchema.schemaPathParams(Schema.Struct({ id: Schema.String })),
    Route.html(function*(ctx) {
      const studio = yield* Studio.Studio
      const fiberId = ctx.pathParams.id
      const fiberName = fiberId.startsWith("#") ? fiberId : `#${fiberId}`

      const fiberLogs = yield* StudioStore.logsByFiberId(fiberName)
      const fiberSpans = yield* StudioStore.spansByFiberId(fiberName)

      const hasRecent = fiberLogs.some(
        (l) => Date.now() - Number(Unique.snowflake.timestamp(l.id)) < 5000,
      )
      const status: "alive" | "dead" = hasRecent ? "alive" : "dead"

      const parents = yield* StudioStore.getParentChain(fiberName)
      const fiberContext = yield* StudioStore.getFiberContext(fiberName)

      return (
        <Ui.Shell prefix={studio.path} active="fibers">
          <Ui.FiberDetail
            prefix={studio.path}
            fiberId={fiberName}
            logs={fiberLogs}
            spans={fiberSpans}
            status={status}
            parents={parents}
            context={fiberContext}
          />
        </Ui.Shell>
      )
    }),
  ),

  "/routes": Route.get(
    Route.html(function*() {
      const studio = yield* Studio.Studio
      const routes = yield* Route.Routes
      const infos: Array<Ui.RouteInfo> = Array.from(
        RouteMap.walk(routes),
        (route) => {
          const desc = Route.descriptor(route)
          return {
            method: desc.method ?? "*",
            path: desc.path ?? "/",
            format: desc.format,
          }
        },
      )

      return (
        <Ui.Shell prefix={studio.path} active="routes">
          <div class="tab-header">Routes</div>
          <div class="tab-body">
            <Ui.RouteList routes={infos} />
          </div>
        </Ui.Shell>
      )
    }),
  ),

  "/system": Route.get(
    Route.html(function*() {
      const studio = yield* Studio.Studio
      const stats = studio.store.process
      return (
        <Ui.Shell prefix={studio.path} active="system">
          <div style="display:flex;flex-direction:column;flex:1;overflow:hidden">
            <div class="tab-header">System</div>
            <div id="system-container" class="tab-body">
              {stats ?
                <Ui.SystemStatsView stats={stats} /> :
                <div class="empty">Waiting for system data...</div>}
            </div>
            <div data-init={(c) => c.actions.get("system")} />
          </div>
        </Ui.Shell>
      )
    }),
    Route.sse(
      Effect.gen(function*() {
        const studio = yield* Studio.Studio
        return Stream.fromPubSub(studio.store.events).pipe(
          Stream.filter((e) => e._tag === "ProcessSnapshot"),
          Stream.map((e) => {
            const html = Html
              .text(<Ui.SystemStatsView stats={e.stats} />)
              .replace(/\n/g, "")
            return {
              event: "datastar-patch-elements",
              data: `selector #system-container\nmode inner\nelements ${html}`,
            }
          }),
        )
      }),
    ),
  ),

  "/services": Route.get(
    Route.html(function*() {
      const studio = yield* Studio.Studio
      const ctx = yield* Effect.context<never>()
      const services = Ui.collectServices(ctx.unsafeMap)
      return (
        <Ui.Shell prefix={studio.path} active="services">
          <div class="tab-header">Services ({services.length})</div>
          <div class="tab-body">
            <Ui.ServiceList services={services} />
          </div>
        </Ui.Shell>
      )
    }),
  ),
})
