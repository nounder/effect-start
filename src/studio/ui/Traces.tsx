import * as StudioStore from "../StudioStore.ts"

function formatDuration(ms: number | undefined): string {
  if (ms == null) return "..."
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function statusColor(status: string): string {
  if (status === "ok") return "#22c55e"
  if (status === "error") return "#ef4444"
  return "#eab308"
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

// --- Tree building ---

interface TreeSpan {
  span: StudioStore.StudioSpan
  depth: number
  childCount: number
  isLastChild: boolean
  ancestorHasNextSibling: Array<boolean>
}

function buildSpanTree(spans: Array<StudioStore.StudioSpan>): Array<TreeSpan> {
  const byId = new Map<bigint, StudioStore.StudioSpan>()
  const childrenOf = new Map<bigint, Array<StudioStore.StudioSpan>>()

  for (const s of spans) {
    byId.set(s.spanId, s)
  }

  const roots: Array<StudioStore.StudioSpan> = []
  for (const s of spans) {
    if (s.parentSpanId && byId.has(s.parentSpanId)) {
      let children = childrenOf.get(s.parentSpanId)
      if (!children) {
        children = []
        childrenOf.set(s.parentSpanId, children)
      }
      children.push(s)
    } else {
      roots.push(s)
    }
  }

  const sortByStart = (a: StudioStore.StudioSpan, b: StudioStore.StudioSpan) =>
    Number(a.startTime - b.startTime)

  roots.sort(sortByStart)
  for (const children of childrenOf.values()) {
    children.sort(sortByStart)
  }

  const result: Array<TreeSpan> = []

  function walk(
    span: StudioStore.StudioSpan,
    depth: number,
    isLast: boolean,
    ancestors: Array<boolean>,
  ) {
    const children = childrenOf.get(span.spanId) ?? []
    result.push({
      span,
      depth,
      childCount: children.length,
      isLastChild: isLast,
      ancestorHasNextSibling: [...ancestors],
    })
    for (let i = 0; i < children.length; i++) {
      walk(children[i], depth + 1, i === children.length - 1, [...ancestors, !isLast])
    }
  }

  for (let i = 0; i < roots.length; i++) {
    walk(roots[i], 0, i === roots.length - 1, [])
  }

  return result
}

// --- Components ---

function TreeConnectors(options: { tree: TreeSpan }) {
  if (options.tree.depth === 0) return null

  const indent = options.tree.depth * 20
  const elements: Array<any> = []

  for (let i = 0; i < options.tree.ancestorHasNextSibling.length; i++) {
    if (options.tree.ancestorHasNextSibling[i]) {
      elements.push(<div class="wf-vline" style={`left:${i * 20 + 6}px`} />)
    }
  }

  if (options.tree.isLastChild) {
    elements.push(<div class="wf-elbow" style={`left:${(options.tree.depth - 1) * 20 + 6}px`} />)
  } else {
    elements.push(<div class="wf-vline" style={`left:${(options.tree.depth - 1) * 20 + 6}px`} />)
  }

  elements.push(
    <div class="wf-hline" style={`left:${(options.tree.depth - 1) * 20 + 6}px;top:50%`} />,
  )

  return (
    <div class="wf-tree" style={`width:${indent}px;position:relative`}>
      {elements}
    </div>
  )
}

function TimeAxis(options: { totalMs: number }) {
  const ticks = 5
  const labels: Array<string> = []
  for (let i = 0; i <= ticks; i++) {
    labels.push(formatDuration((options.totalMs / ticks) * i))
  }
  return (
    <div class="wf-axis">
      <div style="padding:4px 8px;color:#64748b;font-size:11px">Span</div>
      <div class="wf-axis-ticks">
        {labels.map((l) => (
          <span>{l}</span>
        ))}
      </div>
    </div>
  )
}

function WaterfallRow(options: { tree: TreeSpan; totalMs: number; rootStart: bigint }) {
  const s = options.tree.span
  const offsetMs = Number(s.startTime - options.rootStart) / 1_000_000
  const durMs = s.durationMs ?? 0
  const leftPct = options.totalMs > 0 ? Math.min(100, (offsetMs / options.totalMs) * 100) : 0
  const widthPct =
    options.totalMs > 0
      ? Math.max(0.5, Math.min(100 - leftPct, (durMs / options.totalMs) * 100))
      : 100
  const color = statusColor(s.status)

  const durLabelLeft = leftPct + widthPct + 0.5

  return (
    <div class="wf-row">
      <div class="wf-name">
        <TreeConnectors tree={options.tree} />
        <span style="overflow:hidden;text-overflow:ellipsis">{s.name}</span>
        {options.tree.childCount > 0 && <span class="wf-badge">{options.tree.childCount}</span>}
      </div>
      <div class="wf-bar-cell">
        <div class="wf-bar" style={`left:${leftPct}%;width:${widthPct}%;background:${color}`} />
        <div class="wf-dur" style={`left:${durLabelLeft}%`}>
          {formatDuration(s.durationMs)}
        </div>
      </div>
    </div>
  )
}

function MiniWaterfall(options: {
  spans: Array<StudioStore.StudioSpan>
  totalMs: number
  rootStart: bigint
}) {
  if (options.totalMs <= 0) return <div class="mini-wf" />
  return (
    <div class="mini-wf">
      {options.spans.map((s) => {
        const offsetMs = Number(s.startTime - options.rootStart) / 1_000_000
        const durMs = s.durationMs ?? 0
        const leftPct = Math.min(100, (offsetMs / options.totalMs) * 100)
        const widthPct = Math.max(0.3, Math.min(100 - leftPct, (durMs / options.totalMs) * 100))
        return (
          <div
            class="mini-wf-bar"
            style={`left:${leftPct}%;width:${widthPct}%;background:${statusColor(s.status)}`}
          />
        )
      })}
    </div>
  )
}

// --- Exports ---

export function groupByTraceId(
  spans: Array<StudioStore.StudioSpan>,
): Map<bigint, Array<StudioStore.StudioSpan>> {
  const groups = new Map<bigint, Array<StudioStore.StudioSpan>>()
  for (const span of spans) {
    let group = groups.get(span.traceId)
    if (!group) {
      group = []
      groups.set(span.traceId, group)
    }
    group.push(span)
  }
  return groups
}

export function TraceGroup(options: { spans: Array<StudioStore.StudioSpan> }) {
  if (options.spans.length === 0) return null
  const root = options.spans.find((s) => !s.parentSpanId) ?? options.spans[0]
  const traceId = root.traceId
  const totalMs = root.durationMs ?? 0
  const rootStart = root.startTime
  const hasError = options.spans.some((s) => s.status === "error")
  const status = hasError ? "error" : root.status

  return (
    <details class="tl-row">
      <summary class="tl-summary tl-cols">
        <span class="tl-cell tl-cell-status">
          <span
            style={`width:8px;height:8px;border-radius:50%;background:${statusColor(status)};display:block`}
          />
        </span>
        <span class="tl-cell tl-cell-name">{root.name}</span>
        <span class="tl-cell tl-cell-spans">{options.spans.length}</span>
        <span class="tl-cell tl-cell-dur">{formatDuration(totalMs)}</span>
        <span class="tl-cell tl-cell-id">{String(traceId).slice(0, 12)}</span>
      </summary>
      <div class="tl-body">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
          <a
            href={`${StudioStore.store.prefix}/traces/${traceId}`}
            style="color:#38bdf8;font-size:12px;text-decoration:none"
          >
            Full trace view
          </a>
          <StatusBadge status={status} />
          <span style="color:#64748b;font-size:11px">
            {options.spans.length} span{options.spans.length !== 1 ? "s" : ""}
          </span>
          <span style="color:#64748b;font-size:11px;font-family:monospace">
            {formatDuration(totalMs)}
          </span>
          <span style="color:#475569;font-size:10px;font-family:monospace">{traceId}</span>
        </div>
        {options.spans.map((s) => {
          const offsetMs = Number(s.startTime - rootStart) / 1_000_000
          const leftPct = totalMs > 0 ? Math.min(100, (offsetMs / totalMs) * 100) : 0
          const widthPct =
            totalMs > 0
              ? Math.max(0.5, Math.min(100 - leftPct, ((s.durationMs ?? 0) / totalMs) * 100))
              : 100
          return (
            <div style="display:flex;align-items:center;gap:8px;padding:2px 0;font-size:11px;font-family:monospace">
              <span style={`color:${statusColor(s.status)};min-width:10px`}>
                {s.parentSpanId ? "  " : ""}
              </span>
              <span style="color:#d1d5db;min-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {s.name}
              </span>
              <div style="flex:1;height:10px;background:#1f2937;border-radius:2px;position:relative;overflow:hidden">
                <div
                  style={`position:absolute;height:100%;border-radius:2px;background:${statusColor(s.status)};left:${leftPct}%;width:${widthPct}%`}
                />
              </div>
              <span style="color:#9ca3af;min-width:60px;text-align:right">
                {formatDuration(s.durationMs)}
              </span>
            </div>
          )
        })}
      </div>
    </details>
  )
}

export function TraceGroups(options: { spans: Array<StudioStore.StudioSpan> }) {
  const groups = groupByTraceId(options.spans)
  const sorted = Array.from(groups.values())
    .sort((a, b) => Number(b[0].startTime) - Number(a[0].startTime))
    .slice(0, 50)

  if (sorted.length === 0) {
    return <div class="empty">Waiting for traces...</div>
  }
  return (
    <div class="tl-grid">
      <div class="tl-header tl-cols">
        <span class="tl-cell tl-cell-status" />
        <span class="tl-cell tl-cell-name">Name</span>
        <span class="tl-cell tl-cell-spans">Spans</span>
        <span class="tl-cell tl-cell-dur">Duration</span>
        <span class="tl-cell tl-cell-id">Trace</span>
      </div>
      {sorted.map((group) => (
        <TraceGroup spans={group} />
      ))}
    </div>
  )
}

export function TraceDetail(options: { prefix: string; spans: Array<StudioStore.StudioSpan> }) {
  if (options.spans.length === 0) {
    return <div class="empty">Trace not found</div>
  }
  const root = options.spans.find((s) => !s.parentSpanId) ?? options.spans[0]
  const traceId = root.traceId
  const totalMs = root.durationMs ?? 0
  const rootStart = root.startTime
  const startDate = new Date(Number(rootStart) / 1_000_000)
  const tree = buildSpanTree(options.spans)

  return (
    <>
      <div style="padding:12px 16px;border-bottom:1px solid #1e293b">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <a
            href={`${options.prefix}/traces`}
            style="color:#64748b;text-decoration:none;font-size:12px"
          >
            Traces
          </a>
          <span style="color:#475569">/</span>
          <span style="color:#e2e8f0;font-size:13px;font-family:monospace">{root.name}</span>
        </div>
        <div style="display:flex;gap:16px;font-size:12px;color:#94a3b8;align-items:center">
          <StatusBadge status={root.status} />
          <span>
            {options.spans.length} span{options.spans.length !== 1 ? "s" : ""}
          </span>
          <span>{formatDuration(totalMs)}</span>
          <span>{startDate.toLocaleTimeString("en", { hour12: false })}</span>
          <span style="color:#475569;font-family:monospace;font-size:10px">{traceId}</span>
        </div>
      </div>

      <div style="padding:8px 16px">
        <MiniWaterfall spans={options.spans} totalMs={totalMs} rootStart={rootStart} />
      </div>

      <div style="padding:0 8px">
        <TimeAxis totalMs={totalMs} />
        <div class="wf-grid">
          {tree.map((t) => (
            <WaterfallRow tree={t} totalMs={totalMs} rootStart={rootStart} />
          ))}
        </div>
      </div>

      <div style="padding:8px">
        {tree.map((t) => {
          const s = t.span
          const stacktrace = s.attributes["code.stacktrace"] as string | undefined
          const customAttrs = Object.entries(s.attributes).filter(([k]) => k !== "code.stacktrace")

          return (
            <details class="span-panel" style="margin-bottom:4px">
              <summary class="span-panel-header">
                <span
                  style={`width:8px;height:8px;border-radius:50%;background:${statusColor(s.status)};flex-shrink:0`}
                />
                <span style="color:#e2e8f0;font-family:monospace;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">
                  {s.name}
                </span>
                <StatusBadge status={s.status} />
                <span style="color:#64748b;font-size:11px;font-family:monospace;margin-left:auto">
                  {formatDuration(s.durationMs)}
                </span>
              </summary>
              <div class="span-panel-body">
                <KeyValue label="Span ID" value={s.spanId} />
                <KeyValue label="Kind" value={s.kind} />
                {s.parentSpanId && <KeyValue label="Parent" value={s.parentSpanId} />}
                {stacktrace && <KeyValue label="Source" value={stacktrace} />}
                {customAttrs.map(([k, v]) => (
                  <KeyValue label={k} value={String(v)} />
                ))}
                {s.events.length > 0 && (
                  <div style="margin-top:4px">
                    <span style="color:#64748b;font-size:11px">Events:</span>
                    {s.events.map((ev) => (
                      <div style="padding:2px 0;font-size:11px;color:#94a3b8;font-family:monospace">
                        {ev.name}
                        {ev.attributes && (
                          <span style="color:#64748b"> {JSON.stringify(ev.attributes)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )
        })}
      </div>
    </>
  )
}
