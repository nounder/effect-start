import * as Unique from "../../Unique.ts"
import * as TowerStore from "../TowerStore.ts"

function levelColor(level: string): string {
  if (level === "DEBUG") return "#94a3b8"
  if (level === "INFO") return "#60a5fa"
  if (level === "WARNING") return "#fbbf24"
  if (level === "ERROR") return "#ef4444"
  if (level === "FATAL") return "#dc2626"
  return "#e5e7eb"
}

export function LogLine(options: { log: TowerStore.TowerLog }) {
  const color = levelColor(options.log.level)
  const time = new Date(Number(Unique.snowflake.timestamp(options.log.id))).toLocaleTimeString("en", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  return (
    <div
      id={`log-${options.log.id}`}
      style="padding:3px 8px;border-bottom:1px solid #1f2937;font-family:monospace;font-size:12px;display:flex;align-items:baseline"
    >
      <span style="color:#6b7280;white-space:nowrap">{time}</span>
      <span style={`color:${color};font-weight:600;width:56px;text-align:center;flex-shrink:0`}>
        {options.log.level}
      </span>
      <span style="color:#e5e7eb;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">
        {options.log.message}
      </span>
      <a
        href={`${TowerStore.store.prefix}/fibers/${options.log.fiberId.replace("#", "")}`}
        style="color:#6b7280;white-space:nowrap;margin-left:8px;text-decoration:none"
      >
        {options.log.fiberId}
      </a>
      {options.log.cause && (
        <div style="color:#ef4444;font-size:11px;padding:2px 0 0 0;white-space:pre-wrap;width:100%">
          {options.log.cause}
        </div>
      )}
    </div>
  )
}
