import * as Option from "effect/Option"
import * as Html from "../Html.ts"
import type * as Tracing from "../internal/Tracing.ts"
import * as Unique from "../Unique.ts"
import * as Pretty from "./internal/Pretty.ts"
import type * as StudioStore from "./StudioStore.ts"

const htmlEscapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]!)
}

function toPreHtml(text: string): string {
  return escapeHtml(text).replaceAll("\n", "&#10;")
}

export function PreformattedText(props: { text: string; style?: string }) {
  return <pre style={props.style}>{Html.unsafe(toPreHtml(props.text))}</pre>
}

export function PrettyValue(
  props: { value: unknown; style?: string; preStyle?: string },
) {
  if (props.value == null) return null
  if (Pretty.isStructuredValue(props.value)) {
    return (
      <PreformattedText
        text={Pretty.prettyPrintJson(props.value)}
        style={props.preStyle}
      />
    )
  }
  return (
    <span style={props.style}>
      {String(props.value)}
    </span>
  )
}

export type NavTab =
  | "traces"
  | "metrics"
  | "logs"
  | "errors"
  | "fibers"
  | "routes"
  | "system"
  | "services"

function Sidebar(props: { prefix: string; active: NavTab }) {
  return (
    <div class="sidebar">
      <div class="sidebar-title">
        Effect Studio
      </div>
      <a
        href={`${props.prefix}/traces`}
        class={props.active === "traces" ? "nav-link active" : "nav-link"}
      >
        Traces
      </a>
      <a
        href={`${props.prefix}/metrics`}
        class={props.active === "metrics" ? "nav-link active" : "nav-link"}
      >
        Metrics
      </a>
      <a
        href={`${props.prefix}/logs`}
        class={props.active === "logs" ? "nav-link active" : "nav-link"}
      >
        Logs
      </a>
      <a
        href={`${props.prefix}/errors`}
        class={props.active === "errors" ? "nav-link active" : "nav-link"}
      >
        Errors
      </a>
      <a
        href={`${props.prefix}/fibers`}
        class={props.active === "fibers" ? "nav-link active" : "nav-link"}
      >
        Fibers
      </a>
      <a
        href={`${props.prefix}/routes`}
        class={props.active === "routes" ? "nav-link active" : "nav-link"}
      >
        Routes
      </a>
      <a
        href={`${props.prefix}/system`}
        class={props.active === "system" ? "nav-link active" : "nav-link"}
      >
        System
      </a>
      <a
        href={`${props.prefix}/services`}
        class={props.active === "services" ? "nav-link active" : "nav-link"}
      >
        Services
      </a>
    </div>
  )
}

export function Shell(
  props: { prefix: string; active: NavTab; children: any },
) {
  return (
    <div class="shell">
      <Sidebar prefix={props.prefix} active={props.active} />
      <div class="content">
        {props.children}
      </div>
    </div>
  )
}

function levelColor(level: string): string {
  if (level === "DEBUG") return "#94a3b8"
  if (level === "INFO") return "#60a5fa"
  if (level === "WARNING") return "#fbbf24"
  if (level === "ERROR") return "#ef4444"
  if (level === "FATAL") return "#dc2626"
  return "#e5e7eb"
}

export function LogLine(props: { prefix: string; log: StudioStore.LogEntry }) {
  const color = levelColor(props.log.level)
  const time = new Date(Number(Unique.snowflake.timestamp(props.log.id)))
    .toLocaleTimeString("en", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })

  return (
    <div
      id={`log-${props.log.id}`}
      style="padding:6px 8px;border-bottom:1px solid #1f2937;font-family:monospace;font-size:12px;display:flex;align-items:flex-start;gap:8px"
    >
      <span style="color:#6b7280;white-space:nowrap">
        {time}
      </span>
      <span
        style={`color:${color};font-weight:600;width:56px;text-align:left;flex-shrink:0`}
      >
        {props.log.level}
      </span>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
        <PreformattedText
          text={props.log.message}
          style="color:#e5e7eb;margin:0;white-space:pre-wrap;word-break:break-word;font:inherit"
        />
        {props.log.cause && (
          <PreformattedText
            text={props.log.cause}
            style="color:#ef4444;font-size:11px;margin:0;white-space:pre-wrap;word-break:break-word;font:inherit"
          />
        )}
      </div>
      <a
        href={`${props.prefix}/fibers/${props.log.fiberId.replace("#", "")}`}
        style="color:#6b7280;white-space:nowrap;text-decoration:none;flex-shrink:0"
      >
        {props.log.fiberId}
      </a>
    </div>
  )
}

export function ErrorLine(
  props: { prefix: string; error: StudioStore.ErrorEntry },
) {
  const time = new Date(Number(Unique.snowflake.timestamp(props.error.id)))
    .toLocaleTimeString("en", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  const firstLine = props.error.prettyPrint.split("\n")[0] ?? ""
  const tags = props.error.details.map((d) => d.tag).filter(Boolean)
  const allSpans = props.error.details.map((d) => d.span).filter(Boolean)
  const allProps = props.error.details.flatMap((d) => Object.entries(d.properties))

  return (
    <details style="border-bottom:1px solid #1e293b">
      <summary style="display:flex;align-items:center;gap:8px;padding:6px 12px;cursor:pointer;font-size:12px;font-family:monospace">
        <span style="color:#6b7280;flex-shrink:0">
          {time}
        </span>
        <span style="color:#fca5a5">
          {firstLine}
        </span>
      </summary>
      <div style="padding:4px 12px 10px;font-size:12px;font-family:monospace">
        {tags.length > 0 && (
          <div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-bottom:6px">
            {tags.map((t) => (
              <div>
                <span style="color:#64748b">
                  tag
                </span>
                <span
                  style="color:#fca5a5;text-decoration:underline;cursor:copy"
                  data-on:click={`(e) => { e.signals.errorSearch = '${t}'; const u = new URL(location.href); u.searchParams.set('errorSearch', '${t}'); e.actions.get(u.toString(), { headers: { Accept: 'text/html' } }) }`}
                >
                  {t}
                </span>
              </div>
            ))}
          </div>
        )}
        {allSpans.length > 0 && (
          <div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-bottom:6px">
            {allSpans.map((s) => (
              <div>
                <span style="color:#64748b">
                  span
                </span>
                <span style="color:#818cf8">
                  {s}
                </span>
              </div>
            ))}
          </div>
        )}
        {allProps.length > 0 && (
          <div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-bottom:6px">
            {allProps.map(([k, v]) => (
              <div>
                <span style="color:#64748b">
                  {k}
                </span>
                <span style="color:#4b5563">
                  =
                </span>
                <span style="color:#e2e8f0">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style="margin-bottom:6px">
          <span style="color:#64748b">
            fiber
          </span>
          <a
            href={`${props.prefix}/fibers/${props.error.fiberId.replace("#", "")}`}
            style="color:#9ca3af;text-decoration:none"
          >
            {props.error.fiberId}
          </a>
        </div>
        <pre style="color:#9ca3af;font-size:11px;padding:0;margin:0;white-space:pre-wrap;word-break:break-all">
          {props.error.prettyPrint}
        </pre>
      </div>
    </details>
  )
}

function formatDuration(ms: number | undefined): string {
  if (ms == null) return "..."
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function isSpanRunning(span: Tracing.Span): boolean {
  return span.status === "started" || span.durationMs == null
}

function formatSpanDuration(span: Tracing.Span): string | null {
  if (isSpanRunning(span)) return null
  return formatDuration(span.durationMs)
}

function spanDurationMs(span: Tracing.Span, nowMs: number): number {
  if (span.durationMs != null) return span.durationMs
  return Math.max(0, nowMs - Number(span.startTime) / 1_000_000)
}

function traceTimelineMs(
  spans: Array<Tracing.Span>,
  root: Tracing.Span,
  nowMs: number,
): number {
  if (root.durationMs != null) return root.durationMs
  const rootStartMs = Number(root.startTime) / 1_000_000
  let maxEndMs = rootStartMs
  for (const span of spans) {
    const startMs = Number(span.startTime) / 1_000_000
    const endMs = span.durationMs != null
      ? startMs + span.durationMs
      : nowMs
    if (endMs > maxEndMs) maxEndMs = endMs
  }
  return Math.max(maxEndMs - rootStartMs, 0.001)
}

function tracesStatusColor(status: string): string {
  if (status === "ok") return "#22c55e"
  if (status === "error") return "#ef4444"
  return "#eab308"
}

function KeyValue(props: { label: string; value: unknown }) {
  if (props.value == null) return null
  return (
    <div style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;border-bottom:1px solid #1e293b;font-size:12px">
      <span style="color:#64748b;min-width:120px">
        {props.label}
      </span>
      <div style="flex:1;min-width:0">
        <PrettyValue
          value={props.value}
          style="color:#e2e8f0;font-family:monospace;word-break:break-all"
          preStyle="color:#e2e8f0;font-family:monospace;word-break:break-all;white-space:pre-wrap;margin:0"
        />
      </div>
    </div>
  )
}

function StatusBadge(props: { status: string }) {
  const bg = props.status === "ok"
    ? "#166534"
    : props.status === "error"
    ? "#7f1d1d"
    : "#713f12"
  const fg = props.status === "ok"
    ? "#4ade80"
    : props.status === "error"
    ? "#fca5a5"
    : "#fde047"
  return (
    <span
      style={`font-size:11px;padding:2px 8px;border-radius:4px;background:${bg};color:${fg}`}
    >
      {props.status}
    </span>
  )
}

interface TreeSpan {
  span: Tracing.Span
  depth: number
  childCount: number
  isLastChild: boolean
  ancestorHasNextSibling: Array<boolean>
}

function sortByStartTime(
  a: Tracing.Span,
  b: Tracing.Span,
): number {
  if (a.startTime < b.startTime) return -1
  if (a.startTime > b.startTime) return 1
  return 0
}

function pickRootSpan(
  spans: Array<Tracing.Span>,
): Tracing.Span {
  const spanIds = new Set(spans.map((span) => span.spanId))
  return (
    spans.find((span) => !span.parentSpanId || !spanIds.has(span.parentSpanId)) ??
      spans.slice().sort(sortByStartTime)[0]
  )
}

function buildSpanTree(spans: Array<Tracing.Span>): Array<TreeSpan> {
  const byId = new Map<string, Tracing.Span>()
  const childrenOf = new Map<string, Array<Tracing.Span>>()

  for (const s of spans) {
    byId.set(s.spanId, s)
  }

  const roots: Array<Tracing.Span> = []
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

  roots.sort(sortByStartTime)
  for (const children of childrenOf.values()) {
    children.sort(sortByStartTime)
  }

  const result: Array<TreeSpan> = []
  const visited = new Set<string>()

  function walk(
    span: Tracing.Span,
    depth: number,
    isLast: boolean,
    ancestors: Array<boolean>,
    lineage: Set<string>,
  ) {
    if (lineage.has(span.spanId) || visited.has(span.spanId)) return

    const nextLineage = new Set(lineage)
    nextLineage.add(span.spanId)

    const children = (childrenOf.get(span.spanId) ?? []).filter(
      (child) => !nextLineage.has(child.spanId) && !visited.has(child.spanId),
    )

    visited.add(span.spanId)
    result.push({
      span,
      depth,
      childCount: children.length,
      isLastChild: isLast,
      ancestorHasNextSibling: [...ancestors],
    })
    for (let i = 0; i < children.length; i++) {
      walk(children[i], depth + 1, i === children.length - 1, [
        ...ancestors,
        !isLast,
      ], nextLineage)
    }
  }

  for (let i = 0; i < roots.length; i++) {
    walk(roots[i], 0, i === roots.length - 1, [], new Set())
  }

  const remaining = spans.filter((span) => !visited.has(span.spanId)).sort(
    sortByStartTime,
  )

  for (let i = 0; i < remaining.length; i++) {
    walk(remaining[i], 0, i === remaining.length - 1, [], new Set())
  }

  return result
}

const TREE_INDENT = 16

function TreeConnectors(props: { tree: TreeSpan }) {
  if (props.tree.depth === 0) return null

  const indent = props.tree.depth * TREE_INDENT
  const elements: Array<any> = []

  for (let i = 1; i < props.tree.ancestorHasNextSibling.length; i++) {
    if (props.tree.ancestorHasNextSibling[i]) {
      elements.push(
        <div class="wf-vline" style={`left:${(i - 1) * TREE_INDENT + 4}px`} />,
      )
    }
  }

  const elbowLeft = (props.tree.depth - 1) * TREE_INDENT + 4
  if (props.tree.isLastChild) {
    elements.push(<div class="wf-elbow" style={`left:${elbowLeft}px`} />)
  } else {
    elements.push(<div class="wf-vline" style={`left:${elbowLeft}px`} />)
  }

  elements.push(<div class="wf-hline" style={`left:${elbowLeft}px`} />)

  return (
    <div class="wf-tree" style={`width:${indent}px`}>
      {elements}
    </div>
  )
}

function TimeAxis(props: { totalMs: number }) {
  const ticks = 5
  const labels: Array<string> = []
  for (let i = 0; i <= ticks; i++) {
    labels.push(formatDuration((props.totalMs / ticks) * i))
  }
  return (
    <div class="wf-axis">
      <div style="padding:4px 8px;color:#64748b;font-size:11px">
        Span
      </div>
      <div class="wf-axis-ticks">
        {labels.map((l) => (
          <span>
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}

function SpanDetailBody(props: { span: Tracing.Span }) {
  const s = props.span
  const stacktrace = s.attributes["code.stacktrace"] as string | undefined
  const customAttrs = Object.entries(s.attributes).filter(([k]) => k !== "code.stacktrace")
  return (
    <div class="wf-detail">
      <KeyValue label="Span ID" value={s.spanId} />
      <KeyValue label="Kind" value={s.kind} />
      {s.parentSpanId && <KeyValue label="Parent" value={s.parentSpanId} />}
      {stacktrace && <KeyValue label="Source" value={stacktrace} />}
      {customAttrs.map(([k, v]) => <KeyValue label={k} value={v} />)}
      {s.events.length > 0 && (
        <div style="margin-top:4px">
          <span style="color:#64748b;font-size:11px">
            Events:
          </span>
          {s.events.map((ev) => (
            <div style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;font-size:11px;color:#94a3b8;font-family:monospace">
              <span>
                {ev.name}
              </span>
              {ev.attributes && (
                <div style="flex:1;min-width:0">
                  <PreformattedText
                    text={Pretty.prettyPrintJson(ev.attributes)}
                    style="color:#64748b;white-space:pre-wrap;word-break:break-all;margin:0;font:inherit"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WaterfallRow(
  props: { tree: TreeSpan; totalMs: number; rootStart: bigint; nowMs: number },
) {
  const s = props.tree.span
  const offsetMs = Number(s.startTime - props.rootStart) / 1_000_000
  const durMs = spanDurationMs(s, props.nowMs)
  const leftPct = props.totalMs > 0
    ? Math.min(100, (offsetMs / props.totalMs) * 100)
    : 0
  const widthPct = props.totalMs > 0
    ? Math.max(0.5, Math.min(100 - leftPct, (durMs / props.totalMs) * 100))
    : 100
  const color = tracesStatusColor(s.status)
  const durationLabel = formatSpanDuration(s)
  const durLabelLeft = leftPct + widthPct + 0.5
  const nameAnchor = `--wf-n-${s.spanId}`
  const barAnchor = `--wf-b-${s.spanId}`
  const popoverId = `wf-pop-${s.spanId}`

  const enterFromName =
    `clearTimeout(window.__wfTimer_${s.spanId});var p=document.getElementById('${popoverId}');p.classList.remove('wf-popover-left');p.classList.add('wf-popover-right');p.style.positionAnchor='${nameAnchor}';p.showPopover()`
  const enterFromBar =
    `clearTimeout(window.__wfTimer_${s.spanId});var p=document.getElementById('${popoverId}');p.classList.remove('wf-popover-right');p.classList.add('wf-popover-left');p.style.positionAnchor='${barAnchor}';p.showPopover()`
  const enterFromPopover = `clearTimeout(window.__wfTimer_${s.spanId})`
  const leave =
    `window.__wfTimer_${s.spanId}=setTimeout(()=>document.getElementById('${popoverId}')?.hidePopover(),120)`

  return (
    <>
      <div class="wf-row">
        <div
          class="wf-name"
          style={`anchor-name:${nameAnchor}`}
          onmouseenter={enterFromName}
          onmouseleave={leave}
        >
          <TreeConnectors tree={props.tree} />
          <span style="overflow:hidden;text-overflow:ellipsis">
            <SpanTitle span={s} />
          </span>
          {props.tree.childCount > 0 && (
            <span class="wf-badge">
              {props.tree.childCount}
            </span>
          )}
        </div>
        <div class="wf-bar-cell">
          <div
            class="wf-bar"
            style={`left:${leftPct}%;width:${widthPct}%;background:${color};anchor-name:${barAnchor}`}
            onmouseenter={enterFromBar}
            onmouseleave={leave}
          />
          {durationLabel != null && (
            <div class="wf-dur" style={`left:${durLabelLeft}%`}>
              {durationLabel}
            </div>
          )}
        </div>
      </div>
      <div
        id={popoverId}
        popover="manual"
        class="wf-popover"
        onmouseenter={enterFromPopover}
        onmouseleave={leave}
      >
        <SpanDetailBody span={s} />
      </div>
    </>
  )
}

function MiniWaterfall(props: {
  spans: Array<Tracing.Span>
  totalMs: number
  rootStart: bigint
  nowMs: number
}) {
  if (props.totalMs <= 0) return <div class="mini-wf" />
  return (
    <div class="mini-wf">
      {props.spans.map((s) => {
        const offsetMs = Number(s.startTime - props.rootStart) / 1_000_000
        const durMs = spanDurationMs(s, props.nowMs)
        const leftPct = Math.min(100, (offsetMs / props.totalMs) * 100)
        const widthPct = Math.max(
          0.3,
          Math.min(100 - leftPct, (durMs / props.totalMs) * 100),
        )
        return (
          <div
            class="mini-wf-bar"
            style={`left:${leftPct}%;width:${widthPct}%;background:${tracesStatusColor(s.status)}`}
          />
        )
      })}
    </div>
  )
}

export function groupByTraceId(
  spans: Array<Tracing.Span>,
): Map<string, Array<Tracing.Span>> {
  const groups = new Map<string, Array<Tracing.Span>>()
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

// Maps a content-type header to the short format names used on the routes
// page: text/html -> html, text/event-stream -> sse, application/json -> json.
function formatContentType(value: string): string {
  const mime = value.split(";")[0].trim()
  if (mime === "text/event-stream") return "sse"
  if (mime === "text/plain") return "text"
  if (mime === "application/octet-stream") return "bytes"
  return mime.split("/")[1] ?? mime
}

function statusBadgeColors(status: number): { bg: string; fg: string } {
  if (status >= 500) return { bg: "#450a0a", fg: "#ef4444" }
  if (status >= 400) return { bg: "#422006", fg: "#f59e0b" }
  return { bg: "#052e16", fg: "#22c55e" }
}

function SpanTitle(props: { span: Tracing.Span }) {
  const span = props.span
  const isServer = span.name.startsWith("http.server")
  const isClient = span.name.startsWith("http.client")
  if (!isServer && !isClient) {
    return (
      <>
        {span.name}
      </>
    )
  }

  const target = span.attributes[isServer ? "url.path" : "url.full"]
  const status = span.attributes["http.response.status_code"]
  const contentType = span.attributes["http.response.header.content-type"]
  const colors = statusBadgeColors(typeof status === "number" ? status : 0)

  return (
    <>
      {span.name}
      {typeof target === "string" && ` ${target}`}
      {status !== undefined && (
        <span
          style={`font-size:10px;font-weight:700;font-family:monospace;padding:1px 6px;border-radius:3px;margin-left:6px;background:${colors.bg};color:${colors.fg}`}
        >
          {`${status}`}
        </span>
      )}
      {Array.isArray(contentType) && typeof contentType[0] === "string" && (
        <span style="font-size:10px;padding:1px 6px;border-radius:3px;margin-left:6px;background:#1e3a5f;color:#60a5fa">
          {formatContentType(contentType[0])}
        </span>
      )}
    </>
  )
}

export function TraceGroup(props: {
  prefix: string
  id?: string
  spans: Array<Tracing.Span>
}) {
  if (props.spans.length === 0) return null
  const root = pickRootSpan(props.spans)
  const traceId = props.id ?? root.traceId
  const hasError = props.spans.some((s) => s.status === "error")
  const status = hasError ? "error" : root.status
  const durationLabel = formatSpanDuration(root)

  return (
    <a
      id={`trace-${traceId}`}
      class="tl-row tl-cols"
      href={`${props.prefix}/traces/${traceId}`}
    >
      <span class="tl-cell tl-cell-status">
        <span
          style={`width:8px;height:8px;border-radius:50%;background:${tracesStatusColor(status)};display:block`}
        />
      </span>
      <span class="tl-cell tl-cell-name">
        <SpanTitle span={root} />
      </span>
      <span class="tl-cell tl-cell-spans">
        {props.spans.length}
      </span>
      <span class="tl-cell tl-cell-dur">
        {durationLabel ?? ""}
      </span>
      <span class="tl-cell tl-cell-id">
        {String(traceId).slice(0, 12)}
      </span>
    </a>
  )
}

export function TraceGroups(
  props: { prefix: string; spans: Array<Tracing.Span> },
) {
  const groups = groupByTraceId(props.spans)
  const sorted = Array
    .from(groups.values())
    .sort((a, b) => Number(b[0].startTime) - Number(a[0].startTime))
    .slice(0, 50)

  if (sorted.length === 0) {
    return (
      <div class="empty">
        Waiting for traces...
      </div>
    )
  }
  return (
    <div class="tl-grid">
      <div class="tl-header tl-cols">
        <span class="tl-cell tl-cell-status" />
        <span class="tl-cell tl-cell-name">
          Name
        </span>
        <span class="tl-cell tl-cell-spans">
          Spans
        </span>
        <span class="tl-cell tl-cell-dur">
          Duration
        </span>
        <span class="tl-cell tl-cell-id">
          Trace
        </span>
      </div>
      {sorted.map((group) => <TraceGroup prefix={props.prefix} spans={group} />)}
    </div>
  )
}

export function TraceDetail(
  props: {
    prefix: string
    spans: Array<Tracing.Span>
    logs: Array<StudioStore.LogEntry>
  },
) {
  if (props.spans.length === 0) {
    return (
      <div class="empty">
        Trace not found
      </div>
    )
  }
  const root = pickRootSpan(props.spans)
  const traceId = root.traceId
  const nowMs = Date.now()
  const totalMs = traceTimelineMs(props.spans, root, nowMs)
  const rootStart = root.startTime
  const startDate = new Date(Number(rootStart) / 1_000_000)
  const tree = buildSpanTree(props.spans)
  const durationLabel = formatSpanDuration(root)

  return (
    <div class="tab-body">
      <div style="padding:12px 16px;border-bottom:1px solid #1e293b">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <a
            href={`${props.prefix}/traces`}
            style="color:#64748b;text-decoration:none;font-size:12px"
          >
            Traces
          </a>
          <span style="color:#475569">
            /
          </span>
          <span style="color:#e2e8f0;font-size:13px;font-family:monospace">
            <SpanTitle span={root} />
          </span>
        </div>
        <div style="display:flex;gap:16px;font-size:12px;color:#94a3b8;align-items:center">
          <StatusBadge status={root.status} />
          <span>
            {props.spans.length} span{props.spans.length !== 1 ? "s" : ""}
          </span>
          <span>
            {props.logs.length} log{props.logs.length !== 1 ? "s" : ""}
          </span>
          {durationLabel != null && (
            <span>
              {durationLabel}
            </span>
          )}
          <span>
            {startDate.toLocaleTimeString("en", { hour12: false })}
          </span>
          <span style="color:#475569;font-family:monospace;font-size:10px">
            {traceId}
          </span>
        </div>
      </div>

      <div style="padding:8px 16px">
        <MiniWaterfall
          spans={props.spans}
          totalMs={totalMs}
          rootStart={rootStart}
          nowMs={nowMs}
        />
      </div>

      <div style="padding:0 8px 8px">
        <TimeAxis totalMs={totalMs} />
        <div class="wf-grid">
          {tree.map((t) => (
            <WaterfallRow
              tree={t}
              totalMs={totalMs}
              rootStart={rootStart}
              nowMs={nowMs}
            />
          ))}
        </div>
      </div>

      {props.logs.length > 0 && (
        <div style="padding:8px 16px">
          <div style="color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:8px">
            Logs
          </div>
          {props.logs.map((l) => <LogLine prefix={props.prefix} log={l} />)}
        </div>
      )}
    </div>
  )
}

export interface FiberSummary {
  readonly id: string
  logCount: number
  spanCount: number
  lastSeen: number | undefined
  status: "alive" | "dead"
  readonly levels: Set<string>
}

export function getParentChain(
  fiberId: string,
  fiberParents: Map<string, string>,
): Array<string> {
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
  logs: Array<StudioStore.LogEntry>,
  spans: Array<Tracing.Span>,
): Array<FiberSummary> {
  const map = new Map<string, FiberSummary>()
  const now = Date.now()

  for (const log of logs) {
    let fiber = map.get(log.fiberId)
    if (!fiber) {
      fiber = {
        id: log.fiberId,
        logCount: 0,
        spanCount: 0,
        lastSeen: undefined,
        status: "dead",
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
        status: "dead",
        levels: new Set(),
      }
      map.set(fiberId, fiber)
    }
    fiber.spanCount++
  }

  for (const fiber of map.values()) {
    if (fiber.lastSeen && now - fiber.lastSeen < 5000) {
      fiber.status = "alive"
    } else {
      fiber.status = "dead"
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const na = parseInt(a.id.replace("#", ""), 10)
    const nb = parseInt(b.id.replace("#", ""), 10)
    return nb - na
  })
}

function FiberRow(props: { fiber: FiberSummary; prefix: string }) {
  const statusColor = props.fiber.status === "alive" ? "#4ade80" : "#ef4444"
  const statusBg = props.fiber.status === "alive" ? "#166534" : "#7f1d1d"
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
      id={`fiber-row-${props.fiber.id.replace("#", "")}`}
      href={`${props.prefix}/fibers/${props.fiber.id.replace("#", "")}`}
      style="display:flex;align-items:center;gap:12px;padding:8px 12px;border-bottom:1px solid #1e293b;text-decoration:none;transition:background .1s"
      onmouseover="this.style.background='#1e293b'"
      onmouseout="this.style.background='transparent'"
    >
      <span style="color:#e2e8f0;font-family:monospace;font-size:13px;font-weight:600;min-width:60px">
        {props.fiber.id}
      </span>
      <span
        style={`font-size:10px;padding:2px 8px;border-radius:4px;background:${statusBg};color:${statusColor}`}
      >
        {props.fiber.status}
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

export function FiberList(
  props: { fibers: Array<FiberSummary>; prefix: string },
) {
  if (props.fibers.length === 0) {
    return (
      <div class="empty">
        Waiting for fibers...
      </div>
    )
  }
  return (
    <>
      {props.fibers.map((f) => <FiberRow fiber={f} prefix={props.prefix} />)}
    </>
  )
}

export function FiberDetail(props: {
  prefix: string
  fiberId: string
  logs: Array<StudioStore.LogEntry>
  spans: Array<Tracing.Span>
  status: "alive" | "dead"
  parents: Array<string>
  context: StudioStore.FiberContext | undefined
}) {
  const statusColor = props.status === "alive" ? "#4ade80" : "#ef4444"
  const statusBg = props.status === "alive" ? "#166534" : "#7f1d1d"

  return (
    <>
      <div class="tab-header" style="height:auto;padding:8px 16px;flex-direction:column;align-items:flex-start;gap:4px">
        <div style="display:flex;align-items:center;gap:8px">
          <a
            href={`${props.prefix}/fibers`}
            style="color:#64748b;text-decoration:none;font-size:12px"
          >
            Fibers
          </a>
          <span style="color:#475569">
            /
          </span>
          <span style="color:#e2e8f0;font-size:13px;font-family:monospace">
            {props.fiberId}
          </span>
          <span
            style={`font-size:11px;padding:2px 8px;border-radius:4px;background:${statusBg};color:${statusColor}`}
          >
            {props.status}
          </span>
        </div>
        <div style="display:flex;gap:16px;font-size:12px;color:#94a3b8;font-weight:400">
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
            Object.keys(props.context.annotations).length > 0) &&
          (
            <div style="padding:8px 16px">
              <div style="color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:8px">
                Context
              </div>
              <div style="background:#111827;border:1px solid #1e293b;border-radius:6px;padding:8px 12px">
                {props.context.spanName && <KeyValue label="Span" value={props.context.spanName} />}
                {props.context.traceId && (
                  <div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #1e293b;font-size:12px">
                    <span style="color:#64748b;min-width:120px">
                      Trace
                    </span>
                    <a
                      href={`${props.prefix}/traces/${props.context.traceId}`}
                      style="color:#38bdf8;font-family:monospace;word-break:break-all;text-decoration:none"
                    >
                      {props.context.traceId}
                    </a>
                  </div>
                )}
                {Object.entries(props.context.annotations).map(([k, v]) => <KeyValue label={k} value={v} />)}
              </div>
            </div>
          )}

        {props.spans.length > 0 && (
          <div style="padding:8px 16px">
            <div style="color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:8px">
              Spans
            </div>
            {props.spans.map((s) => {
              const stacktrace = s.attributes["code.stacktrace"] as
                | string
                | undefined
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
                    {formatSpanDuration(s) != null && (
                      <span style="color:#64748b;font-size:11px;margin-left:auto;font-family:monospace">
                        {formatSpanDuration(s)}
                      </span>
                    )}
                  </div>
                  <KeyValue label="Trace" value={s.traceId} />
                  <KeyValue label="Kind" value={s.kind} />
                  {stacktrace && <KeyValue label="Source" value={stacktrace} />}
                  {Object
                    .entries(s.attributes)
                    .filter(([k]) => k !== "code.stacktrace")
                    .map(([k, v]) => <KeyValue label={k} value={v} />)}
                </div>
              )
            })}
          </div>
        )}

        {props.logs.length > 0 && (
          <div style="padding:8px 16px">
            <div style="color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:8px">
              Logs
            </div>
            {props.logs.map((l) => <LogLine prefix={props.prefix} log={l} />)}
          </div>
        )}

        {props.logs.length === 0 && props.spans.length === 0 && (
          <div class="empty">
            No data found for fiber {props.fiberId}
          </div>
        )}
      </div>
    </>
  )
}

function formatCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2)
}

function HistogramRange(
  props: { min: number; max: number; avg: number },
) {
  const span = props.max - props.min
  const avgPct = span === 0 ? 50 : ((props.avg - props.min) / span) * 100
  return (
    <div style="padding:0 8px 8px 8px">
      <div style="position:relative;height:6px;background:#1f2937;border-radius:3px">
        <div style="position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;background:linear-gradient(to right,#1e40af,#60a5fa);border-radius:1px" />
        <div
          style={`position:absolute;top:-2px;width:2px;height:10px;background:#f8fafc;left:${avgPct.toFixed(1)}%`}
        />
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#6b7280;font-family:monospace;margin-top:3px">
        <span>
          {formatCompact(props.min)}
        </span>
        <span style="color:#94a3b8">
          avg {formatCompact(props.avg)}
        </span>
        <span>
          {formatCompact(props.max)}
        </span>
      </div>
    </div>
  )
}

function MetricValue(
  props: {
    metric: StudioStore.MetricSnapshot
    subtitle?: string
  },
) {
  if (props.metric.type === "counter" || props.metric.type === "gauge") {
    return (
      <div style="margin:1em 0;text-align:center">
        <div style="font-size:32px;font-weight:700;color:#e5e7eb;font-family:monospace;line-height:1.1">
          {formatCompact(props.metric.value as number)}
        </div>
        {props.subtitle && (
          <div style="font-size:11px;color:#34d399;font-family:monospace;margin-top:4px">
            {props.subtitle}
          </div>
        )}
      </div>
    )
  }
  if (props.metric.type === "histogram") {
    const h = props.metric.value as {
      count: number
      sum: number
      min: number
      max: number
    }
    const avg = h.count === 0 ? 0 : h.sum / h.count
    return (
      <div style="margin:1em 0;text-align:center">
        <div style="font-size:32px;font-weight:700;color:#e5e7eb;font-family:monospace;line-height:1.1">
          {formatCompact(avg)}
        </div>
        <div style="font-size:11px;color:#6b7280;font-family:monospace;margin-top:4px">
          avg · n={formatCompact(h.count)}
        </div>
      </div>
    )
  }
  if (props.metric.type === "frequency") {
    const occ = props.metric.value as Record<string, number>
    return (
      <div style="display:grid;grid-template-columns:auto auto;gap:2px 12px;font-size:12px;font-family:monospace">
        {Object
          .entries(occ)
          .slice(0, 10)
          .map(([k, v]) => (
            <>
              <span style="color:#6b7280">
                {k}
              </span>
              <span style="color:#e5e7eb">
                {v}
              </span>
            </>
          ))}
      </div>
    )
  }
  return (
    <pre style="font-size:11px;color:#9ca3af;margin:0;white-space:pre-wrap">
      {JSON.stringify(props.metric.value, null, 2)}
    </pre>
  )
}

const SPARKLINE_SLOTS = 42
const SPARKLINE_VIEW_W = 100
const SPARKLINE_VIEW_H = 32

export function BarChart(props: {
  data: ReadonlyArray<{ value: number; timestamp: number }>
  format?: (value: number) => string
  max?: number
}) {
  const recent = props.data.slice(-SPARKLINE_SLOTS)
  const max = props.max ?? recent.reduce((m, d) => Math.max(m, d.value), 0)
  const padding = Math.max(0, SPARKLINE_SLOTS - recent.length)
  const slots: Array<{ value: number; timestamp: number } | null> = [
    ...Array.from({ length: padding }, () => null),
    ...recent,
  ]
  const fmt = props.format ?? String
  const slotW = SPARKLINE_VIEW_W / SPARKLINE_SLOTS
  const linePts = slots.map((slot, i) => {
    const value = slot === null ? 0 : slot.value
    const x = (i + 0.5) * slotW
    const ratio = max === 0 ? 0 : Math.min(1, value / max)
    const y = SPARKLINE_VIEW_H - ratio * (SPARKLINE_VIEW_H - 1) - 0.5
    return { x, y }
  })
  const linePath = linePts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ")
  const areaPath = linePts.length < 2
    ? ""
    : `${linePath} L${linePts[linePts.length - 1].x},${SPARKLINE_VIEW_H} L${linePts[0].x},${SPARKLINE_VIEW_H} Z`
  return (
    <div class="sparkline">
      <svg
        class="sparkline-svg"
        viewBox={`0 0 ${SPARKLINE_VIEW_W} ${SPARKLINE_VIEW_H}`}
        preserveAspectRatio="none"
      >
        {areaPath && <path d={areaPath} fill="#60a5fa" fill-opacity="0.18" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#60a5fa"
            stroke-width="1.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        )}
      </svg>
      <div class="sparkline-slots">
        {slots.map((slot) => {
          if (slot === null) return <div class="sparkline-slot" />
          return (
            <div class="sparkline-slot">
              <div class="sparkline-marker" style="left:50%" />
              <div class="sparkline-popover">
                <div>
                  {fmt(slot.value)}
                </div>
                <div class="sparkline-popover-time">
                  {new Date(slot.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CounterSparkline(
  props: { history: ReadonlyArray<StudioStore.MetricSnapshot> },
) {
  const deltas = props.history.slice(1).map((curr, i) => ({
    value: Math.max(
      0,
      (curr.value as number) - (props.history[i].value as number),
    ),
    timestamp: curr.timestamp,
  }))
  return <BarChart data={deltas} />
}

function GaugeSparkline(
  props: { history: ReadonlyArray<StudioStore.MetricSnapshot> },
) {
  const data = props.history.map((s) => ({
    value: s.value as number,
    timestamp: s.timestamp,
  }))
  return <BarChart data={data} format={formatCompact} />
}

function counterRatePerSec(
  history: ReadonlyArray<StudioStore.MetricSnapshot>,
): number | undefined {
  if (history.length < 2) return undefined
  const first = history[0]
  const last = history[history.length - 1]
  const dt = (last.timestamp - first.timestamp) / 1000
  if (dt <= 0) return undefined
  const delta = Math.max(0, (last.value as number) - (first.value as number))
  return delta / dt
}

function MetricCard(props: { series: StudioStore.MetricSeries }) {
  const metric = props.series.latest
  const rate = metric.type === "counter"
    ? counterRatePerSec(props.series.history)
    : undefined
  return (
    <div
      class="metric-card"
      style="background:#111827;border:1px solid #374151;border-radius:6px;min-width:200px;display:flex;flex-direction:column"
    >
      <div style="padding:8px 10px 4px 10px;flex:1">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="color:#d1d5db;font-size:12px;font-weight:600">
            {metric.name}
          </span>
          <span
            class="metric-type"
            style="font-size:10px;padding:1px 6px;border-radius:4px;background:#1e3a5f;color:#60a5fa"
          >
            {metric.type}
          </span>
        </div>
        <MetricValue
          metric={metric}
          subtitle={rate !== undefined && rate > 0
            ? `${formatCompact(rate)}/s`
            : undefined}
        />
        {(() => {
          const tags = metric.type === "histogram"
            ? metric.tags.filter((t) => t.key !== "time_unit")
            : metric.tags
          if (tags.length === 0) return null
          return (
            <div style="font-size:10px;color:#6b7280;margin-top:4px">
              {tags.map((t) => `${t.key}=${t.value}`).join(" ")}
            </div>
          )
        })()}
      </div>
      {metric.type === "counter" && <CounterSparkline history={props.series.history} />}
      {metric.type === "gauge" && <GaugeSparkline history={props.series.history} />}
      {metric.type === "histogram" && (() => {
        const h = metric.value as {
          count: number
          sum: number
          min: number
          max: number
        }
        const avg = h.count === 0 ? 0 : h.sum / h.count
        return <HistogramRange min={h.min} max={h.max} avg={avg} />
      })()}
    </div>
  )
}

export function MetricsGrid(
  props: { series: Array<StudioStore.MetricSeries> },
) {
  if (props.series.length === 0) {
    return (
      <div class="empty">
        Waiting for metrics...
      </div>
    )
  }
  const sorted = [...props.series].sort((a, b) => a.latest.name.localeCompare(b.latest.name))
  return (
    <>
      {sorted.map((s) => <MetricCard series={s} />)}
    </>
  )
}

export interface RouteInfo {
  readonly method: string
  readonly path: string
  readonly format: string | undefined
}

const methodOrder = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "*",
]

function groupByPath(
  routes: Array<RouteInfo>,
): Array<{ path: string; routes: Array<RouteInfo> }> {
  const byPath = new Map<string, Array<RouteInfo>>()
  for (const r of routes) {
    let group = byPath.get(r.path)
    if (!group) {
      group = []
      byPath.set(r.path, group)
    }
    group.push(r)
  }
  return Array
    .from(byPath, ([path, routes]) => ({
      path,
      routes: routes.sort((a, b) => methodOrder.indexOf(a.method) - methodOrder.indexOf(b.method)),
    }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

function methodColor(method: string): string {
  if (method === "GET") return "#22c55e"
  if (method === "POST") return "#3b82f6"
  if (method === "PUT") return "#f59e0b"
  if (method === "DELETE") return "#ef4444"
  if (method === "PATCH") return "#a855f7"
  if (method === "*") return "#6b7280"
  return "#94a3b8"
}

function methodBg(method: string): string {
  if (method === "GET") return "#052e16"
  if (method === "POST") return "#172554"
  if (method === "PUT") return "#422006"
  if (method === "DELETE") return "#450a0a"
  if (method === "PATCH") return "#3b0764"
  return "#1e293b"
}

function MethodBadge(props: { method: string }) {
  return (
    <span
      style={`font-size:10px;font-weight:700;font-family:monospace;padding:2px 6px;border-radius:3px;background:${
        methodBg(props.method)
      };color:${methodColor(props.method)};min-width:48px;text-align:center;display:inline-block`}
    >
      {props.method}
    </span>
  )
}

function FormatBadge(props: { format: string }) {
  return (
    <span style="font-size:10px;padding:1px 6px;border-radius:3px;background:#1e3a5f;color:#60a5fa">
      {props.format}
    </span>
  )
}

function ColoredPath(props: { path: string }) {
  const segments = props.path.split("/").filter(Boolean)
  return (
    <span style="font-family:monospace;font-size:13px">
      {segments.length === 0 ?
        (
          <span style="color:#e2e8f0">
            /
          </span>
        ) :
        (
          segments.map((seg) => {
            const isParam = seg.startsWith(":")
            return (
              <>
                <span style="color:#475569">
                  /
                </span>
                <span style={isParam ? "color:#c084fc" : "color:#e2e8f0"}>
                  {seg}
                </span>
              </>
            )
          })
        )}
    </span>
  )
}

function PathGroup(props: { path: string; routes: Array<RouteInfo> }) {
  return (
    <div style="padding:8px 12px;border-bottom:1px solid #1e293b">
      <div style="margin-bottom:4px">
        <ColoredPath path={props.path} />
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        {props.routes.map((r) => (
          <div style="display:flex;align-items:center;gap:6px">
            <MethodBadge method={r.method} />
            {r.format && <FormatBadge format={r.format} />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function RouteList(props: { routes: Array<RouteInfo> }) {
  if (props.routes.length === 0) {
    return (
      <div class="empty">
        No routes registered
      </div>
    )
  }

  const groups = groupByPath(props.routes)
  const routeCount = props.routes.length
  const pathCount = groups.length

  return (
    <>
      <div style="padding:8px 12px;border-bottom:1px solid #1e293b;display:flex;gap:16px;font-size:12px;color:#64748b">
        <span>
          {pathCount} path{pathCount !== 1 ? "s" : ""}
        </span>
        <span>
          {routeCount} route{routeCount !== 1 ? "s" : ""}
        </span>
      </div>
      {groups.map((g) => <PathGroup path={g.path} routes={g.routes} />)}
    </>
  )
}

const EffectTypeIds: Record<symbol, string> = {
  [Symbol.for("effect/Ref")]: "Ref",
  [Symbol.for("effect/SynchronizedRef")]: "SynchronizedRef",
  [Symbol.for("effect/QueueDequeue")]: "Dequeue",
  [Symbol.for("effect/QueueEnqueue")]: "Enqueue",
  [Symbol.for("effect/Pool")]: "Pool",
  [Symbol.for("effect/Deferred")]: "Deferred",
  [Symbol.for("effect/FiberRef")]: "FiberRef",
  [Symbol.for("effect/Scope")]: "Scope",
  [Symbol.for("effect/Tracer")]: "Tracer",
  [Symbol.for("effect/Request/Cache")]: "RequestCache",
  [Symbol.for("effect/Logger")]: "Logger",
  [Symbol.for("effect/Supervisor")]: "Supervisor",
  [Symbol.for("effect/Clock")]: "Clock",
  [Symbol.for("effect/Random")]: "Random",
  [Symbol.for("effect/KeyValueStore")]: "KeyValueStore",
  [Symbol.for("effect/RateLimiter")]: "RateLimiter",
}

function detectEffectType(value: unknown): string | undefined {
  if (value === null || value === undefined || typeof value !== "object") {
    return undefined
  }
  if ("publish" in value && "subscribe" in value && "offer" in value) {
    return "PubSub"
  }
  for (const sym of Object.getOwnPropertySymbols(value)) {
    const name = EffectTypeIds[sym]
    if (name) return name
  }
  return undefined
}

function inspectEffectValue(type: string, value: any): Record<string, unknown> {
  const info: Record<string, unknown> = { _type: type }
  try {
    switch (type) {
      case "PubSub": {
        if (typeof value.capacity === "function") {
          info.capacity = value.capacity()
        }
        if (typeof value.isActive === "function") info.active = value.isActive()
        if (typeof value.unsafeSize === "function") {
          const size = value.unsafeSize()
          info.size = Option.isSome(size) ? size.value : "shutdown"
        }
        if (value.pubsub && typeof value.pubsub.subscriberCount === "number") {
          info.subscribers = value.pubsub.subscriberCount
        }
        break
      }
      case "Enqueue":
      case "Dequeue": {
        if (typeof value.capacity === "function") {
          info.capacity = value.capacity()
        }
        if (typeof value.isActive === "function") info.active = value.isActive()
        if (typeof value.unsafeSize === "function") {
          const size = value.unsafeSize()
          info.size = Option.isSome(size) ? size.value : "shutdown"
        }
        break
      }
      case "Ref":
      case "SynchronizedRef": {
        if (value.ref && "current" in value.ref) {
          const current = value.ref.current
          info.value = safeSerialize(current)
        }
        break
      }
      case "Pool": {
        if (typeof value.minSize === "number") info.minSize = value.minSize
        if (typeof value.maxSize === "number") info.maxSize = value.maxSize
        if (typeof value.concurrency === "number") {
          info.concurrency = value.concurrency
        }
        if (value.items instanceof Set) info.items = value.items.size
        if (value.available instanceof Set) {
          info.available = value.available.size
        }
        if (value.invalidated instanceof Set) {
          info.invalidated = value.invalidated.size
        }
        if (typeof value.waiters === "number") info.waiters = value.waiters
        break
      }
      case "FiberRef": {
        if ("initial" in value) info.initial = safeSerialize(value.initial)
        break
      }
      case "Deferred": {
        if ("state" in value && value.state) {
          const state = value.state
          if (typeof state === "object" && "_tag" in state) {
            info.status = state._tag
          }
        }
        break
      }
    }
  } catch {
    // ignore introspection errors
  }
  return info
}

function safeSerialize(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === "bigint") return `${value}n`
  if (typeof value === "function") return "<function>"
  if (typeof value === "symbol") return value.toString()
  if (typeof value !== "object") return value
  if (detectEffectType(value)) return `<${detectEffectType(value)}>`
  if (Array.isArray(value)) return value.map(safeSerialize)
  const proto = Object.getPrototypeOf(value)
  if (proto !== null && proto !== Object.prototype) {
    return `<${proto.constructor?.name ?? "object"}>`
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "function") continue
    out[k] = safeSerialize(v)
  }
  return out
}

export interface ServiceEntry {
  readonly key: string
  readonly kind: string
  readonly display: string
  readonly type: "config" | "value" | "effect"
}

function isJsonPrimitive(value: unknown): boolean {
  if (value === null) return true
  const t = typeof value
  return t === "string" || t === "number" || t === "boolean" || t === "bigint"
}

function isPlainJson(value: unknown): boolean {
  if (isJsonPrimitive(value)) return true
  if (Array.isArray(value)) return value.every(isPlainJson)
  if (typeof value === "object" && value !== null) {
    const proto = Object.getPrototypeOf(value)
    if (proto !== null && proto !== Object.prototype) return false
    return Object.values(value).every(isPlainJson)
  }
  return false
}

function jsonReplacer(_key: string, v: unknown): unknown {
  if (typeof v === "bigint") return `${v}n`
  return v
}

function collectDisplayValues(
  obj: unknown,
  prefix: string,
  out: Record<string, unknown>,
): void {
  if (typeof obj === "function") return
  if (isJsonPrimitive(obj) || Array.isArray(obj)) {
    out[prefix] = safeSerialize(obj)
    return
  }
  if (typeof obj === "object" && obj !== null) {
    const et = detectEffectType(obj)
    if (et) {
      out[prefix || et] = inspectEffectValue(et, obj)
      return
    }
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "function") continue
      const path = prefix ? `${prefix}.${k}` : k
      if (isPlainJson(v)) {
        out[path] = safeSerialize(v)
      } else if (typeof v === "object" && v !== null) {
        collectDisplayValues(v, path, out)
      }
    }
  }
}

function kindColor(kind: string): { bg: string; fg: string } {
  if (kind === "config") return { bg: "#2d1f0e", fg: "#fbbf24" }
  if (kind === "effect") return { bg: "#2d1a3e", fg: "#c084fc" }
  if (kind === "empty") return { bg: "#1f2937", fg: "#64748b" }
  if (kind === "function") return { bg: "#1a2e1a", fg: "#4ade80" }
  return { bg: "#1e3a5f", fg: "#60a5fa" }
}

function ServiceRow(props: { entry: ServiceEntry }) {
  const colors = kindColor(props.entry.type)
  return (
    <details class="tl-row">
      <summary class="tl-summary tl-cols">
        <span class="tl-cell tl-cell-status">
          <span
            style={`width:8px;height:8px;border-radius:50%;background:${colors.fg};display:block`}
          />
        </span>
        <span class="tl-cell tl-cell-name">
          {props.entry.key}
        </span>
        <span class="tl-cell tl-cell-dur">
          <span
            style={`font-size:10px;padding:1px 6px;border-radius:4px;background:${colors.bg};color:${colors.fg}`}
          >
            {props.entry.kind}
          </span>
        </span>
      </summary>
      <div class="tl-body">
        {props.entry.display ?
          (
            <pre style="color:#e2e8f0;font-family:monospace;font-size:12px;margin:0;padding:8px;white-space:pre-wrap;word-break:break-all">
            {props.entry.display}
            </pre>
          ) :
          (
            <div style="padding:4px 8px;color:#64748b;font-size:12px">
              No inspectable values
            </div>
          )}
      </div>
    </details>
  )
}

export function ServiceList(props: { services: Array<ServiceEntry> }) {
  if (props.services.length === 0) {
    return (
      <div class="empty">
        No services registered
      </div>
    )
  }
  return (
    <div class="tl-grid">
      <div class="tl-header tl-cols">
        <span class="tl-cell tl-cell-status" />
        <span class="tl-cell tl-cell-name">
          Service
        </span>
        <span class="tl-cell tl-cell-dur">
          Kind
        </span>
      </div>
      {props.services.map((s) => <ServiceRow entry={s} />)}
    </div>
  )
}

const HIDDEN_SERVICES = new Set([
  "effect/ParentSpan",
  "effect/Scope",
  "effect/Layer/CurrentMemoMap",
])

export function collectServices(
  unsafeMap: Map<string, any>,
): Array<ServiceEntry> {
  const entries: Array<ServiceEntry> = []
  for (const [key, value] of unsafeMap) {
    if (HIDDEN_SERVICES.has(key)) continue
    const isConfig = key.toLowerCase().includes("config") ||
      key.toLowerCase().includes("configuration")

    const effectType = typeof value === "object" && value !== null
      ? detectEffectType(value)
      : undefined
    if (effectType) {
      const info = inspectEffectValue(effectType, value)
      entries.push({
        key,
        kind: effectType,
        display: JSON.stringify(info, jsonReplacer, 2),
        type: "effect",
      })
      continue
    }

    if (typeof value === "function") {
      entries.push({ key, kind: "function", display: "", type: "value" })
      continue
    }

    if (value === null || value === undefined) {
      entries.push({ key, kind: "empty", display: "", type: "value" })
      continue
    }

    const type = isConfig ? ("config" as const) : ("value" as const)
    const plain: Record<string, unknown> = {}
    collectDisplayValues(value, "", plain)
    const display = Object.keys(plain).length > 0
      ? JSON.stringify(plain, jsonReplacer, 2)
      : ""

    let kind = "object"
    if (typeof value !== "object") {
      kind = typeof value
    } else {
      const proto = Object.getPrototypeOf(value)
      if (proto && proto.constructor && proto.constructor.name !== "Object") {
        kind = proto.constructor.name
      }
    }

    entries.push({ key, kind: isConfig ? "config" : kind, display, type })
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key))
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function StatCard(props: { label: string; value: string; sub?: string }) {
  return (
    <div style="background:#111827;border:1px solid #374151;border-radius:6px;padding:12px;min-width:180px">
      <div style="color:#9ca3af;font-size:11px;margin-bottom:4px">
        {props.label}
      </div>
      <div style="color:#f3f4f6;font-size:22px;font-weight:700;font-family:monospace">
        {props.value}
      </div>
      {props.sub && (
        <div style="color:#6b7280;font-size:10px;margin-top:2px">
          {props.sub}
        </div>
      )}
    </div>
  )
}

function BarMeter(props: {
  label: string
  history: ReadonlyArray<{ value: number; timestamp: number }>
  total: number
}) {
  const used = props.history.length > 0
    ? props.history[props.history.length - 1].value
    : 0
  const pct = props.total > 0 ? (used / props.total) * 100 : 0
  return (
    <div style="background:#111827;border:1px solid #374151;border-radius:6px;display:flex;flex-direction:column;justify-content:space-between">
      <div style="padding:12px">
        <div style="display:flex;justify-content:space-between">
          <span style="color:#9ca3af;font-size:11px">
            {props.label}
          </span>
          <span style="color:#e5e7eb;font-size:11px;font-family:monospace">
            {formatBytes(used)} / {formatBytes(props.total)} ({pct.toFixed(1)}%)
          </span>
        </div>
      </div>
      <BarChart
        data={props.history}
        max={props.total}
        format={formatBytes}
      />
    </div>
  )
}

export interface SystemStatsProps {
  readonly info: {
    readonly pid: number
    readonly uptime: number
    readonly platform: string
    readonly arch: string
    readonly cpuCount: number
    readonly totalmem: number
  }
  readonly series: StudioStore.ProcessSeries
}

function gaugeAt(series: StudioStore.ProcessSeries, key: string): number {
  return series.latest[key] ?? 0
}

function gaugeHistory(series: StudioStore.ProcessSeries, key: string) {
  return series.history[key] ?? []
}

export function SystemStatsView(props: SystemStatsProps) {
  const { series, info } = props
  const cpuUser = gaugeAt(series, "cpu.user")
  const cpuSystem = gaugeAt(series, "cpu.system")
  const cpuTotal = cpuUser + cpuSystem
  const load1 = gaugeAt(series, "system.loadavg1")
  const load5 = gaugeAt(series, "system.loadavg5")
  const load15 = gaugeAt(series, "system.loadavg15")
  const freemem = gaugeAt(series, "system.freemem")
  const heapHistory = gaugeHistory(series, "memory.heapUsed")
  const heapTotal = gaugeAt(series, "memory.heapTotal")
  const sysUsedHistory = gaugeHistory(series, "system.freemem").map((p) => ({
    timestamp: p.timestamp,
    value: info.totalmem - p.value,
  }))
  return (
    <>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding:12px">
        <StatCard
          label="PID"
          value={String(info.pid)}
          sub={`${info.platform} ${info.arch}`}
        />
        <StatCard label="Uptime" value={formatUptime(info.uptime)} />
        <StatCard
          label="CPU Time"
          value={`${(cpuTotal / 1_000_000).toFixed(2)}s`}
          sub={`user ${(cpuUser / 1_000_000).toFixed(2)}s / sys ${(cpuSystem / 1_000_000).toFixed(2)}s`}
        />
        <StatCard
          label="Load Average"
          value={load1.toFixed(2)}
          sub={`${load1.toFixed(2)} / ${load5.toFixed(2)} / ${load15.toFixed(2)}  (${info.cpuCount} cores)`}
        />
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;padding:0 12px 12px">
        <BarMeter
          label="Heap Memory"
          history={heapHistory}
          total={heapTotal}
        />
        <BarMeter
          label="System Memory"
          history={sysUsedHistory}
          total={info.totalmem}
        />
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding:0 12px 12px">
        <StatCard
          label="RSS"
          value={formatBytes(gaugeAt(series, "memory.rss"))}
        />
        <StatCard
          label="Peak RSS"
          value={formatBytes(gaugeAt(series, "resourceUsage.maxRSS"))}
        />
        <StatCard
          label="External"
          value={formatBytes(gaugeAt(series, "memory.external"))}
        />
        <StatCard
          label="Array Buffers"
          value={formatBytes(gaugeAt(series, "memory.arrayBuffers"))}
        />
        <StatCard
          label="Free Memory"
          value={formatBytes(freemem)}
        />
      </div>
      <div style="padding:0 12px 12px">
        <div style="background:#111827;border:1px solid #374151;border-radius:6px;padding:12px">
          <div style="color:#9ca3af;font-size:11px;margin-bottom:8px">
            Resource Usage
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:4px">
            <ResourceRow
              label="Page Faults (minor)"
              value={gaugeAt(series, "resourceUsage.minorPageFault")}
            />
            <ResourceRow
              label="Page Faults (major)"
              value={gaugeAt(series, "resourceUsage.majorPageFault")}
            />
            <ResourceRow
              label="FS Reads"
              value={gaugeAt(series, "resourceUsage.fsRead")}
            />
            <ResourceRow
              label="FS Writes"
              value={gaugeAt(series, "resourceUsage.fsWrite")}
            />
            <ResourceRow
              label="Context Switches (vol)"
              value={gaugeAt(series, "resourceUsage.voluntaryContextSwitches")}
            />
            <ResourceRow
              label="Context Switches (invol)"
              value={gaugeAt(
                series,
                "resourceUsage.involuntaryContextSwitches",
              )}
            />
          </div>
        </div>
      </div>
    </>
  )
}

function ResourceRow(props: { label: string; value: number }) {
  return (
    <div style="display:flex;justify-content:space-between;font-size:12px">
      <span style="color:#6b7280">
        {props.label}
      </span>
      <span style="color:#e5e7eb;font-family:monospace">
        {props.value}
      </span>
    </div>
  )
}
