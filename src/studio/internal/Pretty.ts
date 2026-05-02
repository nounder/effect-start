function jsonReplacer() {
  const seen = new WeakSet<object>()

  return (_key: string, value: unknown): unknown => {
    if (typeof value === "bigint") return String(value)
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      }
    }
    if (value !== null && typeof value === "object") {
      if (seen.has(value)) return "[Circular]"
      seen.add(value)
    }
    return value
  }
}

export function isStructuredValue(value: unknown): value is object {
  return value !== null && typeof value === "object"
}

export function prettyPrintJson(value: unknown): string {
  try {
    const json = JSON.stringify(value, jsonReplacer(), 2)
    return json ?? String(value)
  } catch {
    return String(value)
  }
}

export function formatLogMessage(message: unknown): string {
  if (!Array.isArray(message)) {
    return isStructuredValue(message) ? prettyPrintJson(message) : String(message)
  }

  const lines: Array<string> = []
  let inlineParts: Array<string> = []

  for (const part of message) {
    if (isStructuredValue(part)) {
      if (inlineParts.length > 0) {
        lines.push(inlineParts.join(" "))
        inlineParts = []
      }
      lines.push(prettyPrintJson(part))
    } else {
      inlineParts.push(String(part))
    }
  }

  if (inlineParts.length > 0) {
    lines.push(inlineParts.join(" "))
  }

  return lines.join("\n")
}
