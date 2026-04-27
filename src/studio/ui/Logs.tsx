import * as Unique from "../../Unique.ts"
import * as StudioStore from "../StudioStore.ts"
import * as PrettyValue from "./_PrettyValue.tsx"

function levelColor(level: string): string {
  if (level === "DEBUG") return "#94a3b8"
  if (level === "INFO") return "#60a5fa"
  if (level === "WARNING") return "#fbbf24"
  if (level === "ERROR") return "#ef4444"
  if (level === "FATAL") return "#dc2626"
  return "#e5e7eb"
}

export function LogLine(props: { prefix: string; log: StudioStore.StudioLog }) {
  const color = levelColor(props.log.level)
  const time = new Date(Number(Unique.snowflake.timestamp(props.log.id))).toLocaleTimeString(
    "en",
    {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
  )

  return (
    <div
      id={`log-${props.log.id}`}
      style="padding:6px 8px;border-bottom:1px solid #1f2937;font-family:monospace;font-size:12px;display:flex;align-items:flex-start;gap:8px"
    >
      <span style="color:#6b7280;white-space:nowrap">{time}</span>
      <span style={`color:${color};font-weight:600;width:56px;text-align:center;flex-shrink:0`}>
        {props.log.level}
      </span>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
        <PrettyValue.PreformattedText
          text={props.log.message}
          style="color:#e5e7eb;margin:0;white-space:pre-wrap;word-break:break-word;font:inherit"
        />
        {props.log.cause && (
          <PrettyValue.PreformattedText
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
