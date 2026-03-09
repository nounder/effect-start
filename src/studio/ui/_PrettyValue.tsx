import * as Pretty from "../_Pretty.ts"

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

export function PreformattedText(options: { text: string; style?: string }) {
  return <pre style={options.style} dangerouslySetInnerHTML={{ __html: toPreHtml(options.text) }} />
}

export function PrettyValue(options: { value: unknown; style?: string; preStyle?: string }) {
  if (options.value == null) return null
  if (Pretty.isStructuredValue(options.value)) {
    return (
      <PreformattedText
        text={Pretty.prettyPrintJson(options.value)}
        style={options.preStyle}
      />
    )
  }
  return <span style={options.style}>{String(options.value)}</span>
}
