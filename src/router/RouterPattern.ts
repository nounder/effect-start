export type RouterPattern = `/${string}`

export type ParamDelimiter = "_" | "-" | "." | "," | ";" | "!" | "@" | "~"
export type ParamPrefix = `${string}${ParamDelimiter}` | ""
export type ParamSuffix = `${ParamDelimiter}${string}` | ""

export type LiteralSegment<
  Value extends string = string,
> = {
  _tag: "LiteralSegment"
  value: Value
}

export type ParamSegment<
  Name extends string = string,
  Optional extends boolean = boolean,
  Prefix extends ParamPrefix = "",
  Suffix extends ParamSuffix = "",
> = {
  _tag: "ParamSegment"
  name: Name
  optional?: Optional
  prefix?: Prefix
  suffix?: Suffix
}

export type RestSegment<
  Name extends string = string,
  Optional extends boolean = boolean,
> = {
  _tag: "RestSegment"
  name: Name
  optional?: Optional
}

export type Segment =
  | LiteralSegment
  | ParamSegment<
    string,
    boolean,
    ParamPrefix,
    ParamSuffix
  >
  | RestSegment

/**
 * Parses a route path string into a tuple of Segment types at compile time.
 *
 * @example
 * ```ts
 * type Usage = Segments<"/users/[id]/posts/[...rest]">
 * type Expected = [
 *   LiteralSegment<"users">,
 *   ParamSegment<"id", false>,
 *   LiteralSegment<"posts">,
 *   RestSegment<"rest", false>
 * ]
 * ```
 *
 * Supports:
 * - Literals: `users` → `LiteralSegment<"users">`
 * - Params: `[id]` → `ParamSegment<"id", false>`
 * - Params (optional): `[[id]]` → `ParamSegment<"id", true>`
 * - Rest: `[...rest]` → `RestSegment<"rest", false>`
 * - Rest (optional): `[[...rest]]` → `RestSegment<"rest", true>`
 * - {Pre,Suf}fixed params: `prefix_[id]_suffix` → `ParamSegment<"id", false, "prefix_", "_suffix">`
 * - Malformed segments: `pk_[id]foo` → `undefined` (suffix must start with delimiter)
 *
 * @limit Paths with more than 48 segments in TypeScript 5.9.3 will fail with
 * `TS2589: Type instantiation is excessively deep and possibly infinite`.
 */
export type Segments<Path extends string> = Path extends `/${infer PathRest}`
  ? Segments<PathRest>
  : Path extends `${infer Head}/${infer Tail}`
    ? [ExtractSegment<Head>, ...Segments<Tail>]
  : Path extends "" ? []
  : [ExtractSegment<Path>]

const PARAM_PATTERN =
  /^(?<prefix>.*[^a-zA-Z0-9])?\[(?<name>[^\]]+)\](?<suffix>[^a-zA-Z0-9].*)?$/

export function parseSegment(segment: string): Segment | null {
  if (
    segment.startsWith("[[...")
    && segment.endsWith("]]")
  ) {
    return {
      _tag: "RestSegment",
      name: segment.slice(5, -2),
      optional: true,
    }
  }

  if (
    segment.startsWith("[...")
    && segment.endsWith("]")
  ) {
    return {
      _tag: "RestSegment",
      name: segment.slice(4, -1),
    }
  }

  if (
    segment.startsWith("[[")
    && segment.endsWith("]]")
  ) {
    return {
      _tag: "ParamSegment",
      name: segment.slice(2, -2),
      optional: true,
    }
  }

  const match = segment.match(PARAM_PATTERN)
  if (match?.groups) {
    const { prefix, name, suffix } = match.groups

    return {
      _tag: "ParamSegment",
      name,
      prefix: (prefix as ParamPrefix) || undefined,
      suffix: (suffix as ParamSuffix) || undefined,
    }
  }

  if (/^[\p{L}\p{N}._~-]+$/u.test(segment)) {
    return { _tag: "LiteralSegment", value: segment }
  }

  return null
}

export function parse(pattern: string): Segment[] {
  const segments = pattern.split("/").filter(Boolean).map(parseSegment)

  if (segments.some((seg) => seg === null)) {
    throw new Error(
      `Invalid path segment in "${pattern}": contains invalid characters or format`,
    )
  }

  return segments as Segment[]
}

export function formatSegment(seg: Segment): string {
  switch (seg._tag) {
    case "LiteralSegment":
      return seg.value
    case "ParamSegment": {
      const param = seg.optional ? `[[${seg.name}]]` : `[${seg.name}]`
      return (seg.prefix ?? "") + param + (seg.suffix ?? "")
    }
    case "RestSegment":
      return seg.optional ? `[[...${seg.name}]]` : `[...${seg.name}]`
  }
}

export function format(segments: Segment[]): `/${string}` {
  const joined = segments.map(formatSegment).join("/")
  return (joined ? `/${joined}` : "/") as `/${string}`
}

function buildPaths(
  segments: Segment[],
  mapper: (seg: Segment) => string,
  restWildcard: string,
): string[] {
  const optionalRestIndex = segments.findIndex(
    (s) => s._tag === "RestSegment" && s.optional,
  )

  if (optionalRestIndex !== -1) {
    const before = segments.slice(0, optionalRestIndex)
    const beforeJoined = before.map(mapper).join("/")
    const basePath = beforeJoined ? "/" + beforeJoined : "/"
    const withWildcard = basePath === "/"
      ? restWildcard
      : basePath + restWildcard
    return [basePath, withWildcard]
  }

  const joined = segments.map(mapper).join("/")
  return [joined ? "/" + joined : "/"]
}

function colonParamSegment(segment: Segment): string {
  switch (segment._tag) {
    case "LiteralSegment":
      return segment.value
    case "ParamSegment": {
      const param = `:${segment.name}${segment.optional ? "?" : ""}`
      return (segment.prefix ?? "") + param + (segment.suffix ?? "")
    }
    case "RestSegment":
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
export function toColon(path: RouterPattern): string[] {
  return buildPaths(parse(path), colonParamSegment, "/*")
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
export function toExpress(path: RouterPattern): string[] {
  const segments = parse(path)
  const optionalRestIndex = segments.findIndex(
    (s) => s._tag === "RestSegment" && s.optional,
  )

  const mapper = (segment: Segment): string => {
    switch (segment._tag) {
      case "LiteralSegment":
        return segment.value
      case "ParamSegment": {
        const param = `:${segment.name}`
        return (segment.prefix ?? "") + param + (segment.suffix ?? "")
      }
      case "RestSegment":
        return `*${segment.name}`
    }
  }

  if (optionalRestIndex !== -1) {
    const before = segments.slice(0, optionalRestIndex)
    const rest = segments[optionalRestIndex]
    if (rest._tag !== "RestSegment") throw new Error("unreachable")
    const restName = rest.name
    const beforeJoined = before.map(mapper).join("/")
    const basePath = beforeJoined ? "/" + beforeJoined : "/"
    const withWildcard = basePath === "/"
      ? `/*${restName}`
      : basePath + `/*${restName}`
    return [basePath, withWildcard]
  }

  let result = ""
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const isFirst = i === 0
    switch (segment._tag) {
      case "LiteralSegment":
        result += "/" + segment.value
        break
      case "ParamSegment":
        if (segment.optional && !segment.prefix && !segment.suffix) {
          result += isFirst
            ? "/{/:$name}".replace("$name", segment.name)
            : `{/:${segment.name}}`
        } else {
          const param = `:${segment.name}`
          result += "/"
            + (segment.prefix ?? "")
            + param
            + (segment.suffix ?? "")
        }
        break
      case "RestSegment":
        result += `/*${segment.name}`
        break
    }
  }
  return [result || "/"]
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
export function toEffect(path: RouterPattern): string[] {
  return buildPaths(parse(path), colonParamSegment, "/*")
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
export function toURLPattern(path: RouterPattern): string[] {
  const segments = parse(path)
  const joined = segments
    .map((segment) => {
      switch (segment._tag) {
        case "LiteralSegment":
          return segment.value
        case "ParamSegment": {
          const param = `:${segment.name}${segment.optional ? "?" : ""}`
          return (segment.prefix ?? "") + param + (segment.suffix ?? "")
        }
        case "RestSegment":
          return `:${segment.name}${segment.optional ? "*" : "+"}`
      }
    })
    .join("/")
  return [joined ? "/" + joined : "/"]
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
export function toRemix(path: RouterPattern): string[] {
  const segments = parse(path)
  const optionalRestIndex = segments.findIndex(
    (s) => s._tag === "RestSegment" && s.optional,
  )

  const mapper = (segment: Segment): string => {
    switch (segment._tag) {
      case "LiteralSegment":
        return segment.value
      case "ParamSegment": {
        const param = segment.optional
          ? `($${segment.name})`
          : `$${segment.name}`
        return (segment.prefix ?? "") + param + (segment.suffix ?? "")
      }
      case "RestSegment":
        return "$"
    }
  }

  if (optionalRestIndex !== -1) {
    const before = segments.slice(0, optionalRestIndex)
    const beforeJoined = before.map(mapper).join("/")
    const basePath = beforeJoined ? "/" + beforeJoined : "/"
    const withWildcard = basePath === "/" ? "$" : basePath + "/$"
    return [basePath, withWildcard]
  }

  const joined = segments.map(mapper).join("/")
  return [joined ? "/" + joined : "/"]
}

/**
 * Converts to Bun.serve path pattern.
 *
 * Since Bun doesn't support optional params (`:param?`), optional segments
 * are expanded into multiple routes recursively.
 *
 * - `[param]` → `:param`
 * - `[[param]]` → `/`, `/:param` (two routes)
 * - `[...param]` → `*`
 * - `[[...param]]` → `/`, `/*` (two routes)
 * - `pk_[id]` → `pk_:id`
 */
export function toBun(path: RouterPattern): string[] {
  const segments = parse(path)

  const optionalIndex = segments.findIndex(
    (s) =>
      (s._tag === "ParamSegment" || s._tag === "RestSegment") && s.optional,
  )

  if (optionalIndex === -1) {
    return buildPaths(segments, colonParamSegment, "/*")
  }

  const before = segments.slice(0, optionalIndex)
  const optional = { ...segments[optionalIndex], optional: false }
  const after = segments.slice(optionalIndex + 1)

  return [
    ...toBun(format(before)),
    ...toBun(format([...before, optional, ...after])),
  ]
}

type ExtractSegment<S extends string> = S extends `[[...${infer Name}]]`
  ? RestSegment<Name, true>
  : S extends `[...${infer Name}]` ? RestSegment<Name, false>
  : S extends `[[${infer Name}]]` ? ParamSegment<Name, true, "", "">
  : S extends
    `${infer Pre
      extends `${string}${ParamDelimiter}`}[${infer Name}]${infer Suf}`
    ? Suf extends `${infer Delim extends ParamDelimiter}${infer SufRest}`
      ? ParamSegment<Name, false, Pre, `${Delim}${SufRest}`>
    : Suf extends "" ? ParamSegment<Name, false, Pre, "">
    : undefined
  : S extends `[${infer Name}]${infer Suf extends `${ParamDelimiter}${string}`}`
    ? ParamSegment<Name, false, "", Suf>
  : S extends `[${infer Name}]` ? ParamSegment<Name, false, "", "">
  : LiteralSegment<S>
