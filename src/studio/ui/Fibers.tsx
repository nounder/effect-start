import * as Unique from "../../Unique.ts"
import * as StudioStore from "../StudioStore.ts"
import * as Logs from "./Logs.tsx"
import * as PrettyValue from "./_PrettyValue.tsx"

function formatDuration(ms: number | undefined): string {
  if (ms == null) return "..."
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function KeyValue(props: { label: string; value: unknown }) {
  if (props.value == null) return null
  return (
    <div
      style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;border-bottom:1px solid #1e293b;font-size:12px"
    >
      <span style="color:#64748b;min-width:120px">{props.label}</span>
      <div style="flex:1;min-width:0">
        <PrettyValue.PrettyValue
          value={props.value}
          style="color:#e2e8f0;font-family:monospace;word-break:break-all"
          preStyle="color:#e2e8f0;font-family:monospace;word-break:break-all;white-space:pre-wrap;margin:0"
        />
      </div>
    </div>
  )
}

function StatusBadge(props: { status: string }) {
  const bg =
    props.status === "ok" ? "#166534" : props.status === "error" ? "#7f1d1d" : "#713f12"
  const fg =
    props.status === "ok" ? "#4ade80" : props.status === "error" ? "#fca5a5" : "#fde047"
  return (
    <span style={`font-size:11px;padding:2px 8px;border-radius:4px;background:${bg};color:${fg}`}>
      {props.status}
    </span>
  )
}

export interface FiberSummary {
  readonly id: string
  logCount: number
  spanCount: number
  lastSeen: number | undefined
  alive: "alive" | "dead" | "unknown"
  readonly levels: Set<string>
}

export function getParentChain(fiberId: string, fiberParents: Map<string, string>): Array<string> {
  const chain: Array<string> = []
  const visited = new Set<string>()
  let current = fiberParents.get(fiberId)
  while (current && !visited.has(current)) {
    chain.push(current)
    visited.add(current)
    current = fiberParents.get(current)
  }
  return chain.reverse()
}

export function collectFibers(
  logs: Array<StudioStore.StudioLog>,
  spans: Array<StudioStore.StudioSpan>,
): Array<FiberSummary> {
  const map = new Map<string, FiberSummary>()
  const counter = StudioStore.fiberIdCounter()
  const now = Date.now()

  for (const log of logs) {
    let fiber = map.get(log.fiberId)
    if (!fiber) {
      fiber = {
        id: log.fiberId,
        logCount: 0,
        spanCount: 0,
        lastSeen: undefined,
        alive: "unknown",
        levels: new Set(),
      }
      map.set(log.fiberId, fiber)
    }
    fiber.logCount++
    fiber.levels.add(log.level)
    const logTimestamp = Number(Unique.snowflake.timestamp(log.id))
    if (!fiber.lastSeen || logTimestamp > fiber.lastSeen) {
      fiber.lastSeen = logTimestamp
    }
  }

  for (const span of spans) {
    const fiberId = span.attributes["fiber.id"] as string | undefined
    if (!fiberId) continue
    let fiber = map.get(fiberId)
    if (!fiber) {
      fiber = {
        id: fiberId,
        logCount: 0,
        spanCount: 0,
        lastSeen: undefined,
        alive: "unknown",
        levels: new Set(),
      }
      map.set(fiberId, fiber)
    }
    fiber.spanCount++
  }

  for (const fiber of map.values()) {
    const num = parseInt(fiber.id.replace("#", ""), 10)
    if (!isNaN(num)) {
      if (fiber.lastSeen && now - fiber.lastSeen < 5000) {
        fiber.alive = "alive"
      } else if (num < counter) {
        fiber.alive = "dead"
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const na = parseInt(a.id.replace("#", ""), 10)
    const nb = parseInt(b.id.replace("#", ""), 10)
    return nb - na
  })
}

function FiberRow(props: { fiber: FiberSummary; prefix: string }) {
  const aliveColor =
    props.fiber.alive === "alive"
      ? "#4ade80"
      : props.fiber.alive === "dead"
        ? "#ef4444"
        : "#94a3b8"
  const aliveBg =
    props.fiber.alive === "alive"
      ? "#166534"
      : props.fiber.alive === "dead"
        ? "#7f1d1d"
        : "#334155"
  const lastSeen = props.fiber.lastSeen
    ? new Date(props.fiber.lastSeen).toLocaleTimeString("en", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—"

  return (
    <a
      href={`${props.prefix}/fibers/${props.fiber.id.replace("#", "")}`}
      style="display:flex;align-items:center;gap:12px;padding:8px 12px;border-bottom:1px solid #1e293b;text-decoration:none;transition:background .1s"
      onmouseover="this.style.background='#1e293b'"
      onmouseout="this.style.background='transparent'"
    >
      <span style="color:#e2e8f0;font-family:monospace;font-size:13px;font-weight:600;min-width:60px">
        {props.fiber.id}
      </span>
      <span
        style={`font-size:10px;padding:2px 8px;border-radius:4px;background:${aliveBg};color:${aliveColor}`}
      >
        {props.fiber.alive}
      </span>
      <span style="color:#94a3b8;font-size:12px">
        {props.fiber.spanCount} span{props.fiber.spanCount !== 1 ? "s" : ""}
      </span>
      <span style="color:#94a3b8;font-size:12px">
        {props.fiber.logCount} log{props.fiber.logCount !== 1 ? "s" : ""}
      </span>
      {props.fiber.levels.has("ERROR") && (
        <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:#7f1d1d;color:#fca5a5">
          ERROR
        </span>
      )}
      {props.fiber.levels.has("WARNING") && (
        <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:#713f12;color:#fde047">
          WARN
        </span>
      )}
      <span style="color:#6b7280;font-size:11px;margin-left:auto;font-family:monospace">
        {lastSeen}
      </span>
    </a>
  )
}

export function FiberList(props: { fibers: Array<FiberSummary>; prefix: string }) {
  if (props.fibers.length === 0) {
    return <div class="empty">Waiting for fibers...</div>
  }
  return (
    <>
      {props.fibers.map((f) => (
        <FiberRow fiber={f} prefix={props.prefix} />
      ))}
    </>
  )
}

export function FiberDetail(props: {
  prefix: string
  fiberId: string
  logs: Array<StudioStore.StudioLog>
  spans: Array<StudioStore.StudioSpan>
  alive: "alive" | "dead" | "unknown"
  parents: Array<string>
  context: StudioStore.FiberContext | undefined
}) {
  const aliveColor =
    props.alive === "alive" ? "#4ade80" : props.alive === "dead" ? "#ef4444" : "#94a3b8"
  const aliveBg =
    props.alive === "alive" ? "#166534" : props.alive === "dead" ? "#7f1d1d" : "#334155"

  return (
    <>
      <div class="tab-header">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <a
            href={`${props.prefix}/fibers`}
            style="color:#64748b;text-decoration:none;font-size:12px"
          >
            Fibers
          </a>
          <span style="color:#475569">/</span>
          <span style="color:#e2e8f0;font-size:13px;font-family:monospace">{props.fiberId}</span>
          <span
            style={`font-size:11px;padding:2px 8px;border-radius:4px;background:${aliveBg};color:${aliveColor}`}
          >
            {props.alive}
          </span>
        </div>
        <div style="display:flex;gap:16px;font-size:12px;color:#94a3b8">
          <span>
            {props.logs.length} log{props.logs.length !== 1 ? "s" : ""}
          </span>
          <span>
            {props.spans.length} span{props.spans.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div class="tab-body">
        {props.parents.length > 0 && (
          <div style="padding:8px 16px">
            <div style="color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:8px">
              Parents
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              {props.parents.map((id) => (
                <a
                  href={`${props.prefix}/fibers/${id.replace("#", "")}`}
                  style="color:#38bdf8;font-family:monospace;font-size:13px;text-decoration:none;padding:4px 10px;background:#111827;border:1px solid #1e293b;border-radius:6px"
                >
                  {id}
                </a>
              ))}
            </div>
          </div>
        )}

        {props.context &&
          (props.context.spanName ||
            props.context.traceId ||
            Object.keys(props.context.annotations).length > 0) && (
            <div style="padding:8px 16px">
              <div style="color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:8px">
                Context
              </div>
              <div style="background:#111827;border:1px solid #1e293b;border-radius:6px;padding:8px 12px">
                {props.context.spanName && (
                  <KeyValue label="Span" value={props.context.spanName} />
                )}
                {props.context.traceId && (
                  <div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #1e293b;font-size:12px">
                    <span style="color:#64748b;min-width:120px">Trace</span>
                    <a
                      href={`${props.prefix}/traces/${props.context.traceId}`}
                      style="color:#38bdf8;font-family:monospace;word-break:break-all;text-decoration:none"
                    >
                      {props.context.traceId}
                    </a>
                  </div>
                )}
                {Object.entries(props.context.annotations).map(([k, v]) => (
                  <KeyValue label={k} value={v} />
                ))}
              </div>
            </div>
          )}

        {props.spans.length > 0 && (
          <div style="padding:8px 16px">
            <div style="color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:8px">Spans</div>
            {props.spans.map((s) => {
              const stacktrace = s.attributes["code.stacktrace"] as string | undefined
              return (
                <div style="margin-bottom:6px;background:#111827;border:1px solid #1e293b;border-radius:6px;padding:8px 12px">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <a
                      href={`${props.prefix}/traces/${s.traceId}`}
                      style="color:#38bdf8;font-family:monospace;font-size:13px;text-decoration:none"
                    >
                      {s.name}
                    </a>
                    <StatusBadge status={s.status} />
                    <span style="color:#64748b;font-size:11px;margin-left:auto;font-family:monospace">
                      {formatDuration(s.durationMs)}
                    </span>
                  </div>
                  <KeyValue label="Trace" value={s.traceId} />
                  <KeyValue label="Kind" value={s.kind} />
                  {stacktrace && <KeyValue label="Source" value={stacktrace} />}
                  {Object.entries(s.attributes)
                    .filter(([k]) => k !== "code.stacktrace")
                    .map(([k, v]) => (
                      <KeyValue label={k} value={v} />
                    ))}
                </div>
              )
            })}
          </div>
        )}

        {props.logs.length > 0 && (
          <div style="padding:8px 16px">
            <div style="color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:8px">Logs</div>
            {props.logs.map((l) => (
              <Logs.LogLine prefix={props.prefix} log={l} />
            ))}
          </div>
        )}

        {props.logs.length === 0 && props.spans.length === 0 && (
          <div class="empty">No data found for fiber {props.fiberId}</div>
        )}
      </div>
    </>
  )
}
