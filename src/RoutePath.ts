import type * as Route from "./Route.ts"

type ParamDelimiter = "_" | "-" | "." | "," | ";" | "!" | "@" | "~"
type ParamPrefix = `${string}${ParamDelimiter}`
type ParamSuffix = `${ParamDelimiter}${string}`

type Literal = {
  _tag: "Literal"
  value: string
}

type Param = {
  _tag: "Param"
  name: string
  optional?: boolean
  prefix?: ParamPrefix
  suffix?: ParamSuffix
}

type Rest = {
  _tag: "Rest"
  name: string
  optional?: boolean
}

type Segment =
  | Literal
  | Param
  | Rest

const PARAM_PATTERN =
  /^(?<prefix>.*[^a-zA-Z0-9])?\[(?<name>[^\]]+)\](?<suffix>[^a-zA-Z0-9].*)?$/

function parseSegment(segment: string): Segment {
  if (
    segment.startsWith("[[...")
    && segment.endsWith("]]")
  ) {
    return {
      _tag: "Rest",
      name: segment.slice(5, -2),
      optional: true,
    }
  }

  if (
    segment.startsWith("[...")
    && segment.endsWith("]")
  ) {
    return {
      _tag: "Rest",
      name: segment.slice(4, -1),
    }
  }

  if (
    segment.startsWith("[[")
    && segment.endsWith("]]")
  ) {
    return {
      _tag: "Param",
      name: segment.slice(2, -2),
      optional: true,
    }
  }

  const match = segment.match(PARAM_PATTERN)
  if (match?.groups) {
    const { prefix, name, suffix } = match.groups

    return {
      _tag: "Param",
      name,
      prefix: (prefix as ParamPrefix) ?? undefined,
      suffix: (suffix as ParamSuffix) ?? undefined,
    }
  }

  return { _tag: "Literal", value: segment }
}

function parseSegments(path: string): Segment[] {
  return path.split("/").map(parseSegment)
}

type SegmentMapper = (segment: Segment) => string

function buildPaths(
  segments: Segment[],
  mapper: SegmentMapper,
  restWildcard: string,
): string[] {
  const optionalRestIndex = segments.findIndex(
    (s) => s._tag === "Rest" && s.optional,
  )

  if (optionalRestIndex !== -1) {
    const before = segments.slice(0, optionalRestIndex)
    const beforePath = before.map(mapper).join("/")
    const basePath = beforePath || "/"
    const withWildcard = beforePath + restWildcard
    return [basePath, withWildcard]
  }

  return [segments.map(mapper).join("/")]
}

function colonParamSegment(segment: Segment): string {
  switch (segment._tag) {
    case "Literal":
      return segment.value
    case "Param": {
      const param = `:${segment.name}${segment.optional ? "?" : ""}`
      return (segment.prefix ?? "") + param + (segment.suffix ?? "")
    }
    case "Rest":
      return "*"
  }
}

/**
 * Converts to colon-style path pattern (used by Hono, Bun, itty-router).
 *
 * - `[param]` → `:param`
 * - `[[param]]` → `:param?`
 * - `[...param]` → `*`
 * - `[[...param]]` → `/`, `/*`
 * - `pk_[id]` → `pk_:id`
 */
export function toColon(path: Route.RoutePath): string[] {
  return buildPaths(parseSegments(path), colonParamSegment, "/*")
}

export const toHono = toColon

/**
 * Converts to Express path pattern.
 *
 * - `[param]` → `:param`
 * - `[[param]]` → `{/:param}`
 * - `[...param]` → `/*param`
 * - `[[...param]]` → `/`, `/*param`
 * - `pk_[id]` → `pk_:id`
 */
export function toExpress(path: Route.RoutePath): string[] {
  const segments = parseSegments(path)
  const optionalRestIndex = segments.findIndex(
    (s) => s._tag === "Rest" && s.optional,
  )

  const mapper = (segment: Segment): string => {
    switch (segment._tag) {
      case "Literal":
        return segment.value
      case "Param": {
        const param = `:${segment.name}`
        return (segment.prefix ?? "") + param + (segment.suffix ?? "")
      }
      case "Rest":
        return `*${segment.name}`
    }
  }

  if (optionalRestIndex !== -1) {
    const before = segments.slice(0, optionalRestIndex)
    const restName = (segments[optionalRestIndex] as Rest).name
    const beforePath = before.map(mapper).join("/")
    const basePath = beforePath || "/"
    const withWildcard = beforePath + `/*${restName}`
    return [basePath, withWildcard]
  }

  let result = ""
  for (const segment of segments) {
    switch (segment._tag) {
      case "Literal":
        result += "/" + segment.value
        break
      case "Param":
        if (segment.optional && !segment.prefix && !segment.suffix) {
          result += `{/:${segment.name}}`
        } else {
          const param = `:${segment.name}`
          result += "/"
            + (segment.prefix ?? "")
            + param
            + (segment.suffix ?? "")
        }
        break
      case "Rest":
        result += `/*${segment.name}`
        break
    }
  }
  return [result.replace(/^\/\//, "/")]
}

/**
 * Converts to Effect HttpRouter/find-my-way path pattern.
 *
 * - `[param]` → `:param`
 * - `[[param]]` → `:param?` (must be final segment)
 * - `[...param]` → `*`
 * - `[[...param]]` → `/`, `/*`
 * - `pk_[id]` → `pk_:id`
 */
export function toEffect(path: Route.RoutePath): string[] {
  return buildPaths(parseSegments(path), colonParamSegment, "/*")
}

/**
 * Converts to URLPattern path pattern.
 *
 * - `[param]` → `:param`
 * - `[[param]]` → `:param?`
 * - `[...param]` → `:param+`
 * - `[[...param]]` → `:param*`
 * - `pk_[id]` → `pk_:id`
 */
export function toURLPattern(path: Route.RoutePath): string[] {
  const segments = parseSegments(path)
  return [
    segments
      .map((segment) => {
        switch (segment._tag) {
          case "Literal":
            return segment.value
          case "Param": {
            const param = `:${segment.name}${segment.optional ? "?" : ""}`
            return (segment.prefix ?? "") + param + (segment.suffix ?? "")
          }
          case "Rest":
            return `:${segment.name}${segment.optional ? "*" : "+"}`
        }
      })
      .join("/"),
  ]
}

/**
 * Converts to Remix path pattern.
 *
 * - `[param]` → `$param`
 * - `[[param]]` → `($param)`
 * - `[...param]` → `$`
 * - `[[...param]]` → `/`, `$`
 * - `pk_[id]` → (not supported, emits `pk_$id`)
 */
export function toRemix(path: Route.RoutePath): string[] {
  const segments = parseSegments(path)
  const optionalRestIndex = segments.findIndex(
    (s) => s._tag === "Rest" && s.optional,
  )

  const mapper = (segment: Segment): string => {
    switch (segment._tag) {
      case "Literal":
        return segment.value
      case "Param": {
        const param = segment.optional
          ? `($${segment.name})`
          : `$${segment.name}`
        return (segment.prefix ?? "") + param + (segment.suffix ?? "")
      }
      case "Rest":
        return "$"
    }
  }

  if (optionalRestIndex !== -1) {
    const before = segments.slice(0, optionalRestIndex)
    const beforePath = before.map(mapper).join("/")
    const basePath = beforePath || "/"
    const withWildcard = beforePath ? beforePath + "/$" : "$"
    return [basePath, withWildcard]
  }

  return [segments.map(mapper).join("/")]
}

export const toBun = toColon

/**
 * @deprecated Use toEffectHttpRouterPath instead
 */
export function toHttpPath(path: Route.RoutePath): string {
  return toEffect(path)[0]
}
