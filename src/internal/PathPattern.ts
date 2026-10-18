export type PathPattern = `/${string}`

export type Params<T extends string> = string extends T ? Record<string, string>
  : T extends `/${infer Rest}` ? Params<Rest>
  : T extends `${infer Head}/${infer Tail}` ? Params<Head> & Params<Tail>
  : T extends "*" ? { "*"?: string }
  : T extends `:${infer Name}?` ? { [K in Name]?: string }
  : T extends `:${infer Name}` ? { [K in Name]: string }
  : {}

export function validate(path: string): { ok: true } | { ok: false; error: string } {
  if (!path.startsWith("/")) return { ok: false, error: `Expected an absolute path: "${path}"` }
  const segments = path.split("/").filter(Boolean)
  const names = new Set<string>()
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]
    if (segment === "*" && index === segments.length - 1) continue
    if (segment.startsWith(":")) {
      if (segment.endsWith("?") && index !== segments.length - 1) {
        return { ok: false, error: `Optional parameter must be the last segment in "${path}"` }
      }
      const name = segment.slice(1).replace(/\?$/, "")
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && !names.has(name)) {
        names.add(name)
        continue
      }
    } else if (/^[\p{L}\p{N}._~-]+$/u.test(segment)) {
      continue
    }
    return { ok: false, error: `Invalid segment "${segment}" in "${path}"` }
  }
  return { ok: true }
}

export function params(path: string): Array<{ name: string; optional: boolean }> {
  return path.split("/").flatMap((segment) => {
    if (segment === "*") return [{ name: "*", optional: true }]
    if (!segment.startsWith(":")) return []
    return [{ name: segment.slice(1).replace(/\?$/, ""), optional: segment.endsWith("?") }]
  })
}

export function match(pattern: string, path: string): Record<string, string> | null {
  const patternSegments = pattern.split("/").filter(Boolean)
  let pathSegments: Array<string>
  try {
    pathSegments = path.split("/").filter(Boolean).map(decodeURIComponent)
  } catch {
    return null
  }

  const walk = (patternIndex: number, pathIndex: number): Record<string, string> | null => {
    if (patternIndex === patternSegments.length) return pathIndex === pathSegments.length ? {} : null
    const segment = patternSegments[patternIndex]
    if (segment === "*") {
      return pathIndex === pathSegments.length ? {} : { "*": pathSegments.slice(pathIndex).join("/") }
    }
    if (segment.startsWith(":")) {
      const optional = segment.endsWith("?")
      if (optional && patternIndex !== patternSegments.length - 1) return null
      if (pathIndex < pathSegments.length) {
        const next = walk(patternIndex + 1, pathIndex + 1)
        if (next !== null) return { [segment.slice(1, optional ? -1 : undefined)]: pathSegments[pathIndex], ...next }
      }
      return optional ? walk(patternIndex + 1, pathIndex) : null
    }
    return segment === pathSegments[pathIndex] ? walk(patternIndex + 1, pathIndex + 1) : null
  }

  return walk(0, 0)
}

export function compare(a: string, b: string): number {
  const left = a.split("/").filter(Boolean)
  const right = b.split("/").filter(Boolean)
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const leftSegment = left[index]
    const rightSegment = right[index]
    if (leftSegment === rightSegment) continue
    if (leftSegment === undefined) return -1
    if (rightSegment === undefined) return 1
    const leftPriority = leftSegment === "*" ? 3 : leftSegment.endsWith("?") ? 2 : leftSegment.startsWith(":") ? 1 : 0
    const rightPriority = rightSegment === "*"
      ? 3
      : rightSegment.endsWith("?")
      ? 2
      : rightSegment.startsWith(":")
      ? 1
      : 0
    if (leftPriority !== rightPriority) return leftPriority - rightPriority
  }
  return a.localeCompare(b)
}
