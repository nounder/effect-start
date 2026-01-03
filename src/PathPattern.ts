export type PathPattern = `/${string}`

export type Segments<Path extends string> = Path extends `/${infer Rest}`
  ? Segments<Rest>
  : Path extends `${infer Head}/${infer Tail}` ? [Head, ...Segments<Tail>]
  : Path extends "" ? []
  : [Path]

export type Params<T extends string> = string extends T ? Record<string, string>
  : T extends `${infer _Start}:${infer Param}?/${infer Rest}`
    ? { [K in Param]?: string } & Params<`/${Rest}`>
  : T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & Params<`/${Rest}`>
  : T extends `${infer _Start}:${infer Param}*` ? { [K in Param]?: string }
  : T extends `${infer _Start}:${infer Param}?` ? { [K in Param]?: string }
  : T extends `${infer _Start}:${infer Param}` ? { [K in Param]: string }
  : {}

export function parseSegment(segment: string): string | null {
  if (segment.startsWith(":")) {
    const rest = segment.slice(1)
    if (rest.endsWith("*")) {
      const name = rest.slice(0, -1)
      if (name && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        return segment
      }
    } else if (rest.endsWith("?")) {
      const name = rest.slice(0, -1)
      if (name && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        return segment
      }
    } else {
      if (rest && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rest)) {
        return segment
      }
    }
    return null
  }

  if (/^[\p{L}\p{N}._~-]+$/u.test(segment)) {
    return segment
  }

  return null
}

export function parse(pattern: string): string[] {
  const segments = pattern.split("/").filter(Boolean).map(parseSegment)

  if (segments.some((seg) => seg === null)) {
    throw new Error(
      `Invalid path segment in "${pattern}": contains invalid characters or format`,
    )
  }

  return segments as string[]
}

export function format(segments: readonly string[]): PathPattern {
  const joined = segments.join("/")
  return (joined ? `/${joined}` : "/") as PathPattern
}

export function match(
  patternSegments: string[],
  pathSegments: string[],
): Record<string, string> | null {
  const params: Record<string, string> = {}
  let patternIndex = 0
  let pathIndex = 0

  while (patternIndex < patternSegments.length) {
    const patternSeg = patternSegments[patternIndex]

    if (patternSeg.startsWith(":")) {
      const rest = patternSeg.slice(1)

      if (rest.endsWith("*")) {
        const name = rest.slice(0, -1)
        const remaining = pathSegments.slice(pathIndex)
        if (remaining.length > 0) {
          params[name] = remaining.join("/")
        }
        return params
      }

      if (rest.endsWith("?")) {
        const name = rest.slice(0, -1)
        if (pathIndex < pathSegments.length) {
          params[name] = pathSegments[pathIndex]
          pathIndex++
        }
        patternIndex++
        continue
      }

      if (pathIndex >= pathSegments.length) {
        return null
      }

      params[rest] = pathSegments[pathIndex]
      pathIndex++
      patternIndex++
      continue
    }

    if (pathIndex >= pathSegments.length) {
      return null
    }

    if (patternSeg !== pathSegments[pathIndex]) {
      return null
    }

    pathIndex++
    patternIndex++
  }

  if (pathIndex !== pathSegments.length) {
    return null
  }

  return params
}

export function toRegex(pattern: string): RegExp {
  const result = pattern
    .replace(/\/+(\/|$)/g, "$1")
    .replace(/\./g, "\\.")
    .replace(/(\/?):(\w+)\+/g, "($1(?<$2>*))")
    .replace(/(\/?):(\w+)\*/g, "(?:\\/(?<$2>.*))?")
    .replace(/(\/?):(\w+)/g, "($1(?<$2>[^$1/]+?))")
    .replace(/(\/?)\*/g, "($1.*)?")

  return new RegExp(`^${result}/*$`)
}
