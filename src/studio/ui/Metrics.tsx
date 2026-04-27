import type * as StudioStore from "../StudioStore.ts"

function MetricValue(props: { metric: StudioStore.StudioMetricSnapshot }) {
  if (props.metric.type === "counter" || props.metric.type === "gauge") {
    return (
      <div style="font-size:32px;font-weight:700;color:#e5e7eb;font-family:monospace;line-height:1.1">
        {String(props.metric.value)}
      </div>
    )
  }
  if (props.metric.type === "histogram") {
    const h = props.metric.value as { count: number; sum: number; min: number; max: number }
    return (
      <div style="display:grid;grid-template-columns:auto auto;gap:2px 12px;font-size:12px;font-family:monospace">
        <span style="color:#6b7280">count</span>
        <span style="color:#e5e7eb">{h.count}</span>
        <span style="color:#6b7280">sum</span>
        <span style="color:#e5e7eb">{h.sum.toFixed(2)}</span>
        <span style="color:#6b7280">min</span>
        <span style="color:#e5e7eb">{h.min.toFixed(2)}</span>
        <span style="color:#6b7280">max</span>
        <span style="color:#e5e7eb">{h.max.toFixed(2)}</span>
      </div>
    )
  }
  if (props.metric.type === "frequency") {
    const occ = props.metric.value as Record<string, number>
    return (
      <div style="display:grid;grid-template-columns:auto auto;gap:2px 12px;font-size:12px;font-family:monospace">
        {Object.entries(occ)
          .slice(0, 10)
          .map(([k, v]) => (
            <>
              <span style="color:#6b7280">{k}</span>
              <span style="color:#e5e7eb">{v}</span>
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

function MetricCard(props: { metric: StudioStore.StudioMetricSnapshot }) {
  return (
    <div style="background:#111827;border:1px solid #374151;border-radius:6px;padding:12px;min-width:200px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="color:#d1d5db;font-size:13px;font-weight:600">{props.metric.name}</span>
        <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:#1e3a5f;color:#60a5fa">
          {props.metric.type}
        </span>
      </div>
      <MetricValue metric={props.metric} />
      {props.metric.tags.length > 0 && (
        <div style="font-size:10px;color:#6b7280;margin-top:4px">
          {props.metric.tags.map((t) => `${t.key}=${t.value}`).join(" ")}
        </div>
      )}
    </div>
  )
}

export function MetricsGrid(props: { metrics: Array<StudioStore.StudioMetricSnapshot> }) {
  if (props.metrics.length === 0) {
    return <div class="empty">Waiting for metrics...</div>
  }
  return (
    <>
      {props.metrics.map((m) => (
        <MetricCard metric={m} />
      ))}
    </>
  )
}
