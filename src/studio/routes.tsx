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
import * as StudioProcess from "./StudioProcess.ts"
import * as StudioStore from "./StudioStore.ts"
import * as Ui from "./ui.tsx"

const METRICS_HISTORY_MS = 120_000

export default Route.map({
  "*": Route.use(
    Route.handle(function*(_, next) {
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
      const request = yield* Route.Request
      if (request.headers.get("datastar-request") === "true") {
        return yield* next.html
      }
      const bundle = yield* Bundle.Bundle
      const base = studio.path.endsWith("/") ? studio.path : `${studio.path}/`
      return (
        <html style="height: 100%">
          <head>
            <title>
              Effect Studio
            </title>
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
            <base href={base} />
            <style>
              {css}
            </style>
            <script
              type="module"
              src={bundle.resolve("effect-start/datastar")}
            />
          </head>
          <body>
            {yield* next.html}
          </body>
        </html>
      )
    }),
  ),

  "/": Route.get(
    Route.handle(function*() {
      const studio = yield* Studio.Studio
      return Route.redirect(`${studio.path}/traces`)
    }),
  ),

  "/traces": Route.get(
    Route.schemaSearchParams(
      Schema.Struct({
        traceSearch: Schema.optional(Schema.String),
      }),
    ),
    Route.html(function*(ctx) {
      const studio = yield* Studio.Studio
      const request = yield* Route.Request
      const search = ctx.searchParams.traceSearch ?? ""
      const allSpans = StudioStore.filterOutStudioSpans(
        yield* StudioStore.allSpans(),
      )
      const names = Array.from(new Set(allSpans.map((s) => s.name))).sort()
      let spans = allSpans
      if (search) {
        const lower = search.toLowerCase()
        spans = spans.filter((s) => s.name.toLowerCase().startsWith(lower))
      }

      const body = (
        <form
          id="page-traces"
          data-signals={{ traceSearch: search }}
          style="display:flex;flex-direction:column;flex:1;overflow:hidden;min-width:0"
        >
          <div class="tab-header">
            Traces
          </div>
          <div class="filter-bar">
            <input
              type="text"
              name="traceSearch"
              placeholder="Search..."
              list="trace-names"
              value={search}
              data-bind="traceSearch"
              {...{
                "data-on:input__debounce.400ms": (c: any) => {
                  const url = new URL(location.href)
                  url.searchParams.set(
                    "traceSearch",
                    c.signals.traceSearch ?? "",
                  )
                  return c.actions.get(url.toString(), {
                    headers: { Accept: "text/html" },
                  })
                },
              }}
            />
            <datalist id="trace-names">
              {names.map((n) => <option value={n} />)}
            </datalist>
          </div>
          <div id="traces-container" class="tab-body">
            <Ui.TraceGroups prefix={studio.path} spans={spans} />
          </div>
          <div
            data-effect={(c) => {
              const u = new URL("traces", location.href)
              u.searchParams.set("traceSearch", c.signals.traceSearch ?? "")
              c.actions.get(u.pathname + u.search)
            }}
          />
        </form>
      )

      if (request.headers.get("datastar-request") === "true") {
        return body
      }
      return (
        <Ui.Shell prefix={studio.path} active="traces">
          {body}
        </Ui.Shell>
      )
    }),
    Route.sse((ctx) =>
      Effect.gen(function*() {
        const studio = yield* Studio.Studio
        const sql = yield* SqlClient.SqlClient
        const search = (ctx.searchParams.traceSearch ?? "").toLowerCase()
        return Stream.fromPubSub(studio.store.events).pipe(
          Stream.filter((e) => e._tag === "TraceEnd"),
          Stream.mapEffect((e) =>
            Effect
              .gen(function*() {
                const traceSpans = yield* StudioStore.spansByTraceId(e.traceId)
                if (StudioStore.isStudioTrace(traceSpans)) return undefined
                const root = traceSpans.find((s) => !s.parentSpanId) ??
                  traceSpans[0]
                if (search && !root.name.toLowerCase().startsWith(search)) {
                  return undefined
                }
                const traceHtml = Html.text(
                  <Ui.TraceGroup
                    prefix={studio.path}
                    id={e.traceId}
                    spans={traceSpans}
                  />,
                )
                return {
                  event: "datastar-patch-elements",
                  data: `selector .tl-header\nmode after\nelements ${traceHtml}`,
                }
              })
              .pipe(Effect.provideService(SqlClient.SqlClient, sql))
          ),
          Stream.filter((event): event is { event: string; data: string } => event !== undefined),
        )
      })
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
            <div class="empty">
              Trace not found
            </div>
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
      const series = yield* StudioStore.latestMetricsWithHistory(METRICS_HISTORY_MS)
      return (
        <Ui.Shell prefix={studio.path} active="metrics">
          <div class="tab-header">
            Metrics
          </div>
          <div id="metrics-container" class="tab-body metrics-grid">
            <Ui.MetricsGrid series={series} />
          </div>
          <div data-init={(c) => c.actions.get("metrics")} />
        </Ui.Shell>
      )
    }),
    Route.sse(
      Effect.gen(function*() {
        const studio = yield* Studio.Studio
        const sql = yield* SqlClient.SqlClient
        return Stream.fromPubSub(studio.store.events).pipe(
          Stream.filter((e) => e._tag === "MetricsSnapshot"),
          Stream.mapEffect(() =>
            StudioStore
              .latestMetricsWithHistory(METRICS_HISTORY_MS)
              .pipe(
                Effect.map((series) => {
                  const html = Html
                    .text(<Ui.MetricsGrid series={series} />)
                    .replace(/\n/g, "")
                  return {
                    event: "datastar-patch-elements",
                    data: `selector #metrics-container\nmode inner\nelements ${html}`,
                  }
                }),
                Effect.provideService(SqlClient.SqlClient, sql),
              )
          ),
        )
      }),
    ),
  ),

  "/logs": Route.get(
    Route.schemaSearchParams(
      Schema.Struct({
        logLevel: Schema.optional(Schema.String),
        logSearch: Schema.optional(Schema.String),
      }),
    ),
    Route.html(function*(ctx) {
      const studio = yield* Studio.Studio
      const request = yield* Route.Request
      const level = ctx.searchParams.logLevel ?? ""
      const search = ctx.searchParams.logSearch ?? ""
      let logs = yield* StudioStore.allLogs()
      if (level) logs = logs.filter((l) => l.level === level)
      if (search) {
        const lower = search.toLowerCase()
        logs = logs.filter((l) => l.message.toLowerCase().includes(lower))
      }
      logs = logs.reverse()

      const body = (
        <form
          id="page-logs"
          data-signals={{ logLevel: level, logSearch: search }}
          style="display:flex;flex-direction:column;flex:1;overflow:hidden;min-width:0"
        >
          <div class="tab-header">
            Logs
          </div>
          <div class="filter-bar">
            <select
              name="logLevel"
              data-bind="logLevel"
              data-on:change={(c) => {
                const url = new URL(location.href)
                url.searchParams.set("logLevel", c.signals.logLevel ?? "")
                url.searchParams.set("logSearch", c.signals.logSearch ?? "")
                return c.actions.get(url.toString(), {
                  headers: { Accept: "text/html" },
                })
              }}
            >
              <option value="" selected={level === ""}>
                All levels
              </option>
              <option value="DEBUG" selected={level === "DEBUG"}>
                DEBUG
              </option>
              <option value="INFO" selected={level === "INFO"}>
                INFO
              </option>
              <option value="WARNING" selected={level === "WARNING"}>
                WARNING
              </option>
              <option value="ERROR" selected={level === "ERROR"}>
                ERROR
              </option>
              <option value="FATAL" selected={level === "FATAL"}>
                FATAL
              </option>
            </select>
            <input
              type="text"
              name="logSearch"
              placeholder="Search..."
              value={search}
              data-bind="logSearch"
              {...{
                "data-on:input__debounce.400ms": (c: any) => {
                  const url = new URL(location.href)
                  url.searchParams.set("logLevel", c.signals.logLevel ?? "")
                  url.searchParams.set("logSearch", c.signals.logSearch ?? "")
                  return c.actions.get(url.toString(), {
                    headers: { Accept: "text/html" },
                  })
                },
              }}
            />
          </div>
          <div id="logs-container" class="tab-body">
            {logs.map((l) => <Ui.LogLine prefix={studio.path} log={l} />)}
          </div>
          <div
            data-effect={(c) => {
              const u = new URL("logs", location.href)
              u.searchParams.set("logLevel", c.signals.logLevel ?? "")
              u.searchParams.set("logSearch", c.signals.logSearch ?? "")
              c.actions.get(u.pathname + u.search)
            }}
          />
        </form>
      )

      if (request.headers.get("datastar-request") === "true") {
        return body
      }
      return (
        <Ui.Shell prefix={studio.path} active="logs">
          {body}
        </Ui.Shell>
      )
    }),
    Route.sse((ctx) =>
      Effect.gen(function*() {
        const studio = yield* Studio.Studio
        const level = ctx.searchParams.logLevel ?? ""
        const search = (ctx.searchParams.logSearch ?? "").toLowerCase()
        return Stream.fromPubSub(studio.store.events).pipe(
          Stream.filter((e) => e._tag === "Log"),
          Stream.filter((e) => !level || e.log.level === level),
          Stream.filter((e) => !search || e.log.message.toLowerCase().includes(search)),
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
      })
    ),
  ),

  "/errors": Route.get(
    Route.schemaSearchParams(
      Schema.Struct({
        errorSearch: Schema.optional(Schema.String),
      }),
    ),
    Route.html(function*(ctx) {
      const studio = yield* Studio.Studio
      const request = yield* Route.Request
      const search = ctx.searchParams.errorSearch ?? ""
      const allErrors = yield* StudioStore.allErrors()
      const tagSet = new Set<string>()
      for (const error of allErrors) {
        for (const d of error.details) {
          if (d.tag) tagSet.add(d.tag)
        }
      }
      const sortedTags = Array.from(tagSet).sort()
      let errors = allErrors
      if (search) {
        const lower = search.toLowerCase()
        const isTag = tagSet.has(search)
        errors = errors.filter((e) => {
          if (
            isTag && e.details.some((d) => d.tag && d.tag === search)
          ) return true
          const firstLine = e.prettyPrint.split("\n")[0] ?? ""
          return firstLine.toLowerCase().includes(lower)
        })
      }
      errors = errors.reverse()

      const body = (
        <form
          id="page-errors"
          data-signals={{ errorSearch: search }}
          style="display:flex;flex-direction:column;flex:1;overflow:hidden;min-width:0"
        >
          <div class="tab-header">
            Errors
          </div>
          <div class="filter-bar">
            <input
              type="text"
              name="errorSearch"
              placeholder="Search..."
              list="error-tags"
              value={search}
              data-bind="errorSearch"
              {...{
                "data-on:input__debounce.400ms": (c: any) => {
                  const url = new URL(location.href)
                  url.searchParams.set(
                    "errorSearch",
                    c.signals.errorSearch ?? "",
                  )
                  return c.actions.get(url.toString(), {
                    headers: { Accept: "text/html" },
                  })
                },
              }}
            />
            <datalist id="error-tags">
              {sortedTags.map((t) => <option value={t} />)}
            </datalist>
          </div>
          <div id="errors-list" class="tab-body">
            {errors.map((e) => <Ui.ErrorLine prefix={studio.path} error={e} />)}
          </div>
          <div
            data-effect={(c) => {
              const u = new URL("errors", location.href)
              u.searchParams.set("errorSearch", c.signals.errorSearch ?? "")
              c.actions.get(u.pathname + u.search)
            }}
          />
        </form>
      )

      if (request.headers.get("datastar-request") === "true") {
        return body
      }
      return (
        <Ui.Shell prefix={studio.path} active="errors">
          {body}
        </Ui.Shell>
      )
    }),
    Route.sse((ctx) =>
      Effect.gen(function*() {
        const studio = yield* Studio.Studio
        const rawSearch = ctx.searchParams.errorSearch ?? ""
        const search = rawSearch.toLowerCase()
        return Stream.fromPubSub(studio.store.events).pipe(
          Stream.filter((e) => e._tag === "Error"),
          Stream.filter((e) => {
            if (!search) return true
            if (e.error.details.some((d) => d.tag && d.tag === rawSearch)) {
              return true
            }
            const firstLine = e.error.prettyPrint.split("\n")[0] ?? ""
            return firstLine.toLowerCase().includes(search)
          }),
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
      })
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
            <div class="tab-header">
              Fibers
            </div>
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
          Stream.filter((e) => e._tag === "SpanStart" || e._tag === "SpanEnd" || e._tag === "Log"),
          Stream.debounce("500 millis"),
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
                  data: `selector #fibers-container\nmode inner\nelements ${html}`,
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
          <div class="tab-header">
            Routes
          </div>
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
      const series = yield* StudioStore.processSeries(METRICS_HISTORY_MS)
      const info = StudioProcess.processInfo()
      const hasData = Object.keys(series.latest).length > 0
      return (
        <Ui.Shell prefix={studio.path} active="system">
          <div style="display:flex;flex-direction:column;flex:1;overflow:hidden">
            <div class="tab-header">
              System
            </div>
            <div id="system-container" class="tab-body">
              {hasData ?
                <Ui.SystemStatsView info={info} series={series} /> :
                (
                  <div class="empty">
                    Waiting for system data...
                  </div>
                )}
            </div>
            <div data-init={(c) => c.actions.get("system")} />
          </div>
        </Ui.Shell>
      )
    }),
    Route.sse(
      Effect.gen(function*() {
        const studio = yield* Studio.Studio
        const sql = yield* SqlClient.SqlClient
        return Stream.fromPubSub(studio.store.events).pipe(
          Stream.filter((e) => e._tag === "ProcessSnapshot"),
          Stream.mapEffect(() =>
            StudioStore
              .processSeries(METRICS_HISTORY_MS)
              .pipe(
                Effect.map((series) => {
                  const info = StudioProcess.processInfo()
                  const html = Html
                    .text(<Ui.SystemStatsView info={info} series={series} />)
                    .replace(/\n/g, "")
                  return {
                    event: "datastar-patch-elements",
                    data: `selector #system-container\nmode inner\nelements ${html}`,
                  }
                }),
                Effect.provideService(SqlClient.SqlClient, sql),
              )
          ),
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
          <div class="tab-header">
            Services ({services.length})
          </div>
          <div class="tab-body">
            <Ui.ServiceList services={services} />
          </div>
        </Ui.Shell>
      )
    }),
  ),
})
