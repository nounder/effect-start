import * as Unique from "../../Unique.ts"
import * as TowerStore from "../TowerStore.ts"
import * as Logs from "./Logs.tsx"

function formatDuration(ms: number | undefined): string {
  if (ms == null) return "..."
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function KeyValue(options: { label: string; value: string | number | bigint | undefined | null }) {
  if (options.value == null) return null
  return (
    <div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #1e293b;font-size:12px">
      <span style="color:#64748b;min-width:120px">{options.label}</span>
      <span style="color:#e2e8f0;font-family:monospace;word-break:break-all">
        {String(options.value)}
      </span>
    </div>
  )
}

function StatusBadge(options: { status: string }) {
  const bg =
    options.status === "ok" ? "#166534" : options.status === "error" ? "#7f1d1d" : "#713f12"
  const fg =
    options.status === "ok" ? "#4ade80" : options.status === "error" ? "#fca5a5" : "#fde047"
  return (
    <span style={`font-size:11px;padding:2px 8px;border-radius:4px;background:${bg};color:${fg}`}>
      {options.status}
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
  logs: Array<TowerStore.TowerLog>,
  spans: Array<TowerStore.TowerSpan>,
): Array<FiberSummary> {
  const map = new Map<string, FiberSummary>()
  const counter = TowerStore.fiberIdCounter()
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

function FiberRow(options: { fiber: FiberSummary; prefix: string }) {
  const aliveColor =
    options.fiber.alive === "alive"
      ? "#4ade80"
      : options.fiber.alive === "dead"
        ? "#ef4444"
        : "#94a3b8"
  const aliveBg =
    options.fiber.alive === "alive"
      ? "#166534"
      : options.fiber.alive === "dead"
        ? "#7f1d1d"
        : "#334155"
  const lastSeen = options.fiber.lastSeen
    ? new Date(options.fiber.lastSeen).toLocaleTimeString("en", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—"

  return (
    <a
      href={`${options.prefix}/fibers/${options.fiber.id.replace("#", "")}`}
      style="display:flex;align-items:center;gap:12px;padding:8px 12px;border-bottom:1px solid #1e293b;text-decoration:none;transition:background .1s"
      onmouseover="this.style.background='#1e293b'"
      onmouseout="this.style.background='transparent'"
    >
      <span style="color:#e2e8f0;font-family:monospace;font-size:13px;font-weight:600;min-width:60px">
        {options.fiber.id}
      </span>
      <span
        style={`font-size:10px;padding:2px 8px;border-radius:4px;background:${aliveBg};color:${aliveColor}`}
      >
        {options.fiber.alive}
      </span>
      <span style="color:#94a3b8;font-size:12px">
        {options.fiber.spanCount} span{options.fiber.spanCount !== 1 ? "s" : ""}
      </span>
      <span style="color:#94a3b8;font-size:12px">
        {options.fiber.logCount} log{options.fiber.logCount !== 1 ? "s" : ""}
      </span>
      {options.fiber.levels.has("ERROR") && (
        <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:#7f1d1d;color:#fca5a5">
          ERROR
        </span>
      )}
      {options.fiber.levels.has("WARNING") && (
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

export function FiberList(options: { fibers: Array<FiberSummary>; prefix: string }) {
  if (options.fibers.length === 0) {
    return <div class="empty">Waiting for fibers...</div>
  }
  return (
    <>
      {options.fibers.map((f) => (
        <FiberRow fiber={f} prefix={options.prefix} />
      ))}
    </>
  )
}

export function FiberDetail(options: {
  prefix: string
  fiberId: string
  logs: Array<TowerStore.TowerLog>
  spans: Array<TowerStore.TowerSpan>
  alive: "alive" | "dead" | "unknown"
  parents: Array<string>
  context: TowerStore.FiberContext | undefined
}) {
  const aliveColor =
    options.alive === "alive" ? "#4ade80" : options.alive === "dead" ? "#ef4444" : "#94a3b8"
  const aliveBg =
    options.alive === "alive" ? "#166534" : options.alive === "dead" ? "#7f1d1d" : "#334155"

  return (
    <>
      <div class="tab-header">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <a
            href={`${options.prefix}/fibers`}
            style="color:#64748b;text-decoration:none;font-size:12px"
          >
            Fibers
          </a>
          <span style="color:#475569">/</span>
          <span style="color:#e2e8f0;font-size:13px;font-family:monospace">{options.fiberId}</span>
          <span
            style={`font-size:11px;padding:2px 8px;border-radius:4px;background:${aliveBg};color:${aliveColor}`}
          >
            {options.alive}
          </span>
        </div>
        <div style="display:flex;gap:16px;font-size:12px;color:#94a3b8">
          <span>
            {options.logs.length} log{options.logs.length !== 1 ? "s" : ""}
          </span>
          <span>
            {options.spans.length} span{options.spans.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div class="tab-body">
        {options.parents.length > 0 && (
          <div style="padding:8px 16px">
            <div style="color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:8px">
              Parents
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              {options.parents.map((id) => (
                <a
                  href={`${options.prefix}/fibers/${id.replace("#", "")}`}
                  style="color:#38bdf8;font-family:monospace;font-size:13px;text-decoration:none;padding:4px 10px;background:#111827;border:1px solid #1e293b;border-radius:6px"
                >
                  {id}
                </a>
              ))}
            </div>
          </div>
        )}

        {options.context &&
          (options.context.spanName ||
            options.context.traceId ||
            Object.keys(options.context.annotations).length > 0) && (
            <div style="padding:8px 16px">
              <div style="color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:8px">
                Context
              </div>
              <div style="background:#111827;border:1px solid #1e293b;border-radius:6px;padding:8px 12px">
                {options.context.spanName && (
                  <KeyValue label="Span" value={options.context.spanName} />
                )}
                {options.context.traceId && (
                  <div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #1e293b;font-size:12px">
                    <span style="color:#64748b;min-width:120px">Trace</span>
                    <a
                      href={`${options.prefix}/traces/${options.context.traceId}`}
                      style="color:#38bdf8;font-family:monospace;word-break:break-all;text-decoration:none"
                    >
                      {options.context.traceId}
                    </a>
                  </div>
                )}
                {Object.entries(options.context.annotations).map(([k, v]) => (
                  <KeyValue
                    label={k}
                    value={typeof v === "object" ? JSON.stringify(v) : String(v)}
                  />
                ))}
              </div>
            </div>
          )}

        {options.spans.length > 0 && (
          <div style="padding:8px 16px">
            <div style="color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:8px">Spans</div>
            {options.spans.map((s) => {
              const stacktrace = s.attributes["code.stacktrace"] as string | undefined
              return (
                <div style="margin-bottom:6px;background:#111827;border:1px solid #1e293b;border-radius:6px;padding:8px 12px">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <a
                      href={`${options.prefix}/traces/${s.traceId}`}
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
                      <KeyValue label={k} value={String(v)} />
                    ))}
                </div>
              )
            })}
          </div>
        )}

        {options.logs.length > 0 && (
          <div style="padding:8px 16px">
            <div style="color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:8px">Logs</div>
            {options.logs.map((l) => (
              <Logs.LogLine log={l} />
            ))}
          </div>
        )}

        {options.logs.length === 0 && options.spans.length === 0 && (
          <div class="empty">No data found for fiber {options.fiberId}</div>
        )}
      </div>
    </>
  )
}
