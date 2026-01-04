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
  : T extends `${infer _Start}:${infer Param}+` ? { [K in Param]: string }
  : T extends `${infer _Start}:${infer Param}*` ? { [K in Param]?: string }
  : T extends `${infer _Start}:${infer Param}?` ? { [K in Param]?: string }
  : T extends `${infer _Start}:${infer Param}` ? { [K in Param]: string }
  : {}

export type ValidateResult =
  | { ok: true; segments: string[] }
  | { ok: false; error: string }

function isValidSegment(segment: string): boolean {
  if (segment.startsWith(":")) {
    const rest = segment.slice(1)
    if (rest.endsWith("*") || rest.endsWith("+") || rest.endsWith("?")) {
      const name = rest.slice(0, -1)
      return name !== "" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
    }
    return rest !== "" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rest)
  }
  return /^[\p{L}\p{N}._~-]+$/u.test(segment)
}

export function validate(path: string): ValidateResult {
  const segments = path.split("/").filter(Boolean)
  for (const segment of segments) {
    if (!isValidSegment(segment)) {
      return {
        ok: false,
        error: `Invalid segment "${segment}" in "${path}"`,
      }
    }
  }
  return { ok: true, segments }
}

export function match(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternSegments = pattern.split("/").filter(Boolean)
  const pathSegments = path.split("/").filter(Boolean)
  const params: Record<string, string> = {}
  let patternIndex = 0
  let pathIndex = 0

  while (patternIndex < patternSegments.length) {
    const seg = patternSegments[patternIndex]

    if (seg.startsWith(":")) {
      const rest = seg.slice(1)

      if (rest.endsWith("+")) {
        const name = rest.slice(0, -1)
        const remaining = pathSegments.slice(pathIndex)
        if (remaining.length === 0) {
          return null
        }
        params[name] = remaining.join("/")
        return params
      }

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

    if (seg !== pathSegments[pathIndex]) {
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

export function toRegex(path: string): RegExp {
  const result = path
    .replace(/\/+(\/|$)/g, "$1")
    .replace(/\./g, "\\.")
    .replace(/(\/?):(\w+)\+/g, "($1(?<$2>*))")
    .replace(/(\/?):(\w+)\*/g, "(?:\\/(?<$2>.*))?")
    .replace(/(\/?):(\w+)/g, "($1(?<$2>[^$1/]+?))")
    .replace(/(\/?)\*/g, "($1.*)?")

  return new RegExp(`^${result}/*$`)
}

function getModifier(seg: string): "" | "?" | "*" | "+" {
  const last = seg[seg.length - 1]
  if (last === "?" || last === "*" || last === "+") return last
  return ""
}

function getParamName(seg: string): string {
  const modifier = getModifier(seg)
  return modifier ? seg.slice(1, -1) : seg.slice(1)
}

/**
 * Converts to Express path pattern.
 *
 * @see https://expressjs.com/en/guide/routing.html
 *
 * - `:param` → `:param`
 * - `:param?` → `{/:param}`
 * - `:param+` → `/*param`
 * - `:param*` → `/`, `/*param`
 */
export function toExpress(path: string): string[] {
  const segments = path.split("/").filter(Boolean)
  const optionalWildcardIndex = segments.findIndex(
    (s) => s.startsWith(":") && s.endsWith("*"),
  )

  if (optionalWildcardIndex !== -1) {
    const before = segments.slice(0, optionalWildcardIndex)
    const rest = segments[optionalWildcardIndex]
    const name = getParamName(rest)
    const beforeJoined = before
      .map((s) => (s.startsWith(":") ? `:${getParamName(s)}` : s))
      .join("/")
    const basePath = beforeJoined ? "/" + beforeJoined : "/"
    const withWildcard = basePath === "/" ? `/*${name}` : basePath + `/*${name}`
    return [basePath, withWildcard]
  }

  let result = ""
  for (const seg of segments) {
    if (!seg.startsWith(":")) {
      result += "/" + seg
    } else {
      const name = getParamName(seg)
      const modifier = getModifier(seg)
      switch (modifier) {
        case "":
          result += `/:${name}`
          break
        case "?":
          result += `{/:${name}}`
          break
        case "+":
          result += `/*${name}`
          break
        case "*":
          result += `/*${name}`
          break
      }
    }
  }
  return [result || "/"]
}

/**
 * Converts to URLPattern path pattern.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API
 *
 * - `:param` → `:param`
 * - `:param?` → `:param?`
 * - `:param+` → `:param+`
 * - `:param*` → `:param*`
 */
export function toURLPattern(path: string): string[] {
  const segments = path.split("/").filter(Boolean)
  const joined = segments
    .map((seg) => {
      if (!seg.startsWith(":")) return seg
      const name = getParamName(seg)
      const modifier = getModifier(seg)
      return `:${name}${modifier}`
    })
    .join("/")
  return [joined ? "/" + joined : "/"]
}

/**
 * Converts to React Router path pattern.
 *
 * @see https://reactrouter.com/start/framework/routing
 *
 * - `:param` → `:param`
 * - `:param?` → `:param?`
 * - `:param+` → `*` (splat, required)
 * - `:param*` → `/`, `/*` (splat, optional - two routes)
 */
export function toReactRouter(path: string): string[] {
  const segments = path.split("/").filter(Boolean)
  const optionalWildcardIndex = segments.findIndex(
    (s) => s.startsWith(":") && s.endsWith("*"),
  )

  if (optionalWildcardIndex !== -1) {
    const before = segments.slice(0, optionalWildcardIndex)
    const beforeJoined = before
      .map((s) => {
        if (!s.startsWith(":")) return s
        const name = getParamName(s)
        const modifier = getModifier(s)
        return modifier === "?" ? `:${name}?` : `:${name}`
      })
      .join("/")
    const basePath = beforeJoined ? "/" + beforeJoined : "/"
    const withWildcard = basePath === "/" ? "/*" : basePath + "/*"
    return [basePath, withWildcard]
  }

  const joined = segments
    .map((s) => {
      if (!s.startsWith(":")) return s
      const name = getParamName(s)
      const modifier = getModifier(s)
      switch (modifier) {
        case "":
          return `:${name}`
        case "?":
          return `:${name}?`
        case "+":
        case "*":
          return "*"
      }
    })
    .join("/")
  return [joined ? "/" + joined : "/"]
}

/**
 * Alias for toReactRouter.
 *
 * @see https://reactrouter.com/start/framework/routing
 */
export const toRemix = toReactRouter

/**
 * Converts to Remix file-based route naming convention.
 *
 * Returns a file path segment (without extension) for Remix's
 * flat file routing convention.
 *
 * @see https://remix.run/docs/file-conventions/routes
 *
 * - `:param` → `$param`
 * - `:param?` → `($param)`
 * - `:param+` → `$` (splat)
 * - `:param*` → `($)` (optional splat) - Note: not officially supported
 */
export function toRemixFile(path: string): string {
  const segments = path.split("/").filter(Boolean)

  const mapped = segments.map((seg) => {
    if (!seg.startsWith(":")) return seg
    const name = getParamName(seg)
    const modifier = getModifier(seg)
    switch (modifier) {
      case "":
        return `$${name}`
      case "?":
        return `($${name})`
      case "+":
        return "$"
      case "*":
        return "($)"
    }
  })

  return mapped.join(".")
}

/**
 * Converts to TanStack Router path/file pattern.
 *
 * TanStack uses the same `$param` syntax for both route paths and file names.
 * Returns a dot-separated file name (without extension).
 *
 * @see https://tanstack.com/router/v1/docs/framework/react/guide/path-params
 * @see https://tanstack.com/router/v1/docs/framework/react/routing/file-naming-conventions
 *
 * - `:param` → `$param`
 * - `:param?` → `{-$param}` (optional segment)
 * - `:param+` → `$` (splat)
 * - `:param*` → `$` (splat, optional not supported - treated as required)
 */
export function toTanStack(path: string): string {
  const segments = path.split("/").filter(Boolean)

  const mapped = segments.map((seg) => {
    if (!seg.startsWith(":")) return seg
    const name = getParamName(seg)
    const modifier = getModifier(seg)
    switch (modifier) {
      case "":
        return `$${name}`
      case "?":
        return `{-$${name}}`
      case "+":
        return "$"
      case "*":
        return "$"
    }
  })

  return mapped.join(".")
}

/**
 * Converts to Hono path pattern.
 *
 * Hono uses unnamed wildcards - they are NOT accessible via c.req.param().
 * Use c.req.path to access the matched path for wildcard routes.
 *
 * @see https://hono.dev/docs/api/routing
 *
 * - `:param` → `:param`
 * - `:param?` → `:param?`
 * - `:param+` → `*` (unnamed, required)
 * - `:param*` → `/`, `/*` (unnamed, optional - two routes)
 */
export function toHono(path: string): string[] {
  const segments = path.split("/").filter(Boolean)
  const optionalWildcardIndex = segments.findIndex(
    (s) => s.startsWith(":") && s.endsWith("*"),
  )

  if (optionalWildcardIndex !== -1) {
    const before = segments.slice(0, optionalWildcardIndex)
    const beforeJoined = before
      .map((s) => {
        if (!s.startsWith(":")) return s
        const name = getParamName(s)
        const modifier = getModifier(s)
        return modifier === "?" ? `:${name}?` : `:${name}`
      })
      .join("/")
    const basePath = beforeJoined ? "/" + beforeJoined : "/"
    const withWildcard = basePath === "/" ? "/*" : basePath + "/*"
    return [basePath, withWildcard]
  }

  const joined = segments
    .map((s) => {
      if (!s.startsWith(":")) return s
      const name = getParamName(s)
      const modifier = getModifier(s)
      switch (modifier) {
        case "":
          return `:${name}`
        case "?":
          return `:${name}?`
        case "+":
        case "*":
          return "*"
      }
    })
    .join("/")
  return [joined ? "/" + joined : "/"]
}

/**
 * Converts to Effect HttpRouter / find-my-way path pattern.
 *
 * Effect uses colon-style params with unnamed wildcards.
 *
 * @see https://effect.website/docs/platform/http-router
 *
 * - `:param` → `:param`
 * - `:param?` → `:param?`
 * - `:param+` → `*` (unnamed)
 * - `:param*` → `/`, `/*` (two routes)
 */
export function toEffect(path: string): string[] {
  return toHono(path)
}

/**
 * Converts to Bun.serve path pattern.
 *
 * Since Bun doesn't support optional params (`:param?`), optional segments
 * are expanded into multiple routes.
 *
 * @see https://bun.sh/docs/api/http#routing
 *
 * - `:param` → `:param`
 * - `:param?` → `/`, `/:param` (two routes)
 * - `:param+` → `/*`
 * - `:param*` → `/`, `/*` (two routes)
 */
export function toBun(path: string): string[] {
  const segments = path.split("/").filter(Boolean)

  const optionalIndex = segments.findIndex(
    (s) => s.startsWith(":") && (s.endsWith("?") || s.endsWith("*")),
  )

  if (optionalIndex === -1) {
    const joined = segments
      .map((s) => {
        if (!s.startsWith(":")) return s
        const modifier = getModifier(s)
        const name = getParamName(s)
        return modifier === "+" || modifier === "*" ? "*" : `:${name}`
      })
      .join("/")
    return [joined ? "/" + joined : "/"]
  }

  const before = segments.slice(0, optionalIndex)
  const optional = segments[optionalIndex]
  const after = segments.slice(optionalIndex + 1)

  const formatSegment = (s: string): string => {
    if (!s.startsWith(":")) return s
    const modifier = getModifier(s)
    const name = getParamName(s)
    switch (modifier) {
      case "":
      case "?":
        return `:${name}`
      case "+":
      case "*":
        return "*"
    }
  }

  const beforePath = before.map(formatSegment).join("/")
  const basePath = beforePath ? "/" + beforePath : "/"

  const optionalModifier = getModifier(optional)
  const optionalName = getParamName(optional)
  const requiredOptional = optionalModifier === "*"
    ? `:${optionalName}+`
    : `:${optionalName}`

  const withOptionalSegments = [...before, requiredOptional, ...after]
  const withOptionalPath = "/"
    + withOptionalSegments.map(formatSegment).join("/")

  return [...toBun(basePath), ...toBun(withOptionalPath)]
}
