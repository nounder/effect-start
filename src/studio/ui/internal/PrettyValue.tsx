import * as Pretty from "../../internal/Pretty.ts"

const htmlEscapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]!)
}

function toPreHtml(text: string): string {
  return escapeHtml(text).replaceAll("\n", "&#10;")
}

export function PreformattedText(props: { text: string; style?: string }) {
  return <pre style={props.style} dangerouslySetInnerHTML={{ __html: toPreHtml(props.text) }} />
}

export function PrettyValue(props: { value: unknown; style?: string; preStyle?: string }) {
  if (props.value == null) return null
  if (Pretty.isStructuredValue(props.value)) {
    return (
      <PreformattedText
        text={Pretty.prettyPrintJson(props.value)}
        style={props.preStyle}
      />
    )
  }
  return <span style={props.style}>{String(props.value)}</span>
}
