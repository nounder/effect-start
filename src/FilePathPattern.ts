import * as Either from "effect/Either"
import type * as PathPattern from "./PathPattern.ts"

export type FilePathPattern = string

export type Segment =
  | { _tag: "GroupSegment"; name: string }
  | { _tag: "RestSegment"; name: string }
  | { _tag: "ParamSegment"; name: string }
  | { _tag: "LiteralSegment"; value: string }
  | { _tag: "InvalidSegment"; value: string }

export function segments(pattern: string): Array<Segment> {
  const parts = pattern.split("/").filter(Boolean)
  const result: Array<Segment> = []

  for (const part of parts) {
    if (/^\(\w+\)$/.test(part)) {
      result.push({ _tag: "GroupSegment", name: part.slice(1, -1) })
    } else if (part.startsWith("[[") && part.endsWith("]]")) {
      result.push({ _tag: "RestSegment", name: part.slice(2, -2) })
    } else if (part.startsWith("[") && part.endsWith("]")) {
      result.push({ _tag: "ParamSegment", name: part.slice(1, -1) })
    } else if (/^[\p{L}\p{N}._~-]+$/u.test(part)) {
      result.push({ _tag: "LiteralSegment", value: part })
    } else {
      result.push({ _tag: "InvalidSegment", value: part })
    }
  }

  return result
}

export type ValidationError = {
  _tag: "FilePathPatternError"
  pattern: string
  message: string
}

export type ValidationResult = Either.Either<Array<Segment>, ValidationError>

export function validate(pattern: string): ValidationResult {
  const segs = segments(pattern)

  const invalid = segs.find((s) => s._tag === "InvalidSegment")
  if (invalid) {
    return Either.left({
      _tag: "FilePathPatternError",
      pattern,
      message: `Invalid segment: "${invalid.value}"`,
    })
  }

  const restIndex = segs.findIndex((s) => s._tag === "RestSegment")
  if (restIndex !== -1 && restIndex !== segs.length - 1) {
    return Either.left({
      _tag: "FilePathPatternError",
      pattern,
      message: "Rest segment must be the last segment",
    })
  }

  return Either.right(segs)
}

export function format(segs: Array<Segment>): `/${string}` {
  const parts = segs.map((seg) => {
    switch (seg._tag) {
      case "GroupSegment":
        return `(${seg.name})`
      case "RestSegment":
        return `[[${seg.name}]]`
      case "ParamSegment":
        return `[${seg.name}]`
      case "LiteralSegment":
        return seg.value
      case "InvalidSegment":
        return seg.value
    }
  })
  const joined = parts.join("/")
  return (joined ? `/${joined}` : "/") as `/${string}`
}

export function toPathPattern(
  pattern: string,
): Either.Either<PathPattern.PathPattern, ValidationError> {
  const result = validate(pattern)

  if (Either.isLeft(result)) {
    return Either.left(result.left)
  }

  const segs = result.right
  const pathParts: Array<string> = []

  for (const seg of segs) {
    switch (seg._tag) {
      case "GroupSegment":
        continue
      case "RestSegment":
        pathParts.push(`:${seg.name}*`)
        break
      case "ParamSegment":
        pathParts.push(`:${seg.name}`)
        break
      case "LiteralSegment":
        pathParts.push(seg.value)
        break
    }
  }

  const joined = pathParts.join("/")
  return Either.right((joined ? `/${joined}` : "/") as PathPattern.PathPattern)
}
