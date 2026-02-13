import * as Unique from "../../Unique.ts"
import * as TowerStore from "../TowerStore.ts"

export function ErrorLine(options: { error: TowerStore.TowerError }) {
  const time = new Date(Number(Unique.snowflake.timestamp(options.error.id))).toLocaleTimeString("en", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const firstLine = options.error.prettyPrint.split("\n")[0] ?? ""
  const tags = options.error.details.map((d) => d.tag).filter(Boolean)

  const allSpans = options.error.details.map((d) => d.span).filter(Boolean)
  const allProps = options.error.details.flatMap((d) => Object.entries(d.properties))

  return (
    <details style="border-bottom:1px solid #1e293b">
      <summary style="display:flex;align-items:center;gap:8px;padding:6px 12px;cursor:pointer;font-size:12px;font-family:monospace">
        <span style="color:#6b7280;flex-shrink:0">{time}</span>
        <span style="color:#fca5a5">{firstLine}</span>
      </summary>
      <div style="padding:4px 12px 10px;font-size:12px;font-family:monospace">
        {tags.length > 0 && (
          <div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-bottom:6px">
            {tags.map((t) => (
              <div>
                <span style="color:#64748b">tag </span>
                <span
                  style="color:#fca5a5;text-decoration:underline;cursor:copy"
                  data-on:click={`(e) => { e.signals.errorTag.value = '${t}'; e.actions.get(location.href, { contentType: 'form' }) }`}
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
                <span style="color:#64748b">span </span>
                <span style="color:#818cf8">{s}</span>
              </div>
            ))}
          </div>
        )}
        {allProps.length > 0 && (
          <div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-bottom:6px">
            {allProps.map(([k, v]) => (
              <div>
                <span style="color:#64748b">{k}</span>
                <span style="color:#4b5563">=</span>
                <span style="color:#e2e8f0">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style="margin-bottom:6px">
          <span style="color:#64748b">fiber </span>
          <a
            href={`${TowerStore.store.prefix}/fibers/${options.error.fiberId.replace("#", "")}`}
            style="color:#9ca3af;text-decoration:none"
          >
            {options.error.fiberId}
          </a>
        </div>
        <pre style="color:#9ca3af;font-size:11px;padding:0;margin:0;white-space:pre-wrap;word-break:break-all">
          {options.error.prettyPrint}
        </pre>
      </div>
    </details>
  )
}
