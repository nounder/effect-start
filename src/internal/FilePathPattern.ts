import * as Result from "effect/Result"
import type * as PathPattern from "./PathPattern.ts"

type FilePathPatternError = {
  _tag: "FilePathPatternError"
  pattern: string
  message: string
}

function isValidFileParamName(name: string): boolean {
  return name.length > 0 && /^[a-zA-Z0-9_]+$/.test(name)
}

export function toPathPattern(
  filePath: string,
): Result.Result<PathPattern.PathPattern, FilePathPatternError> {
  const parts = filePath.split("/").filter(Boolean)
  const pathParts: Array<string> = []
  let sawRest = false

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]

    if (/^\(\w+\)$/.test(part)) {
      continue
    }

    if (part.startsWith("[[") && part.endsWith("]]")) {
      const name = part.slice(2, -2)
      if (!isValidFileParamName(name)) {
        return Result.fail({
          _tag: "FilePathPatternError",
          pattern: filePath,
          message: `Invalid segment: "${part}"`,
        })
      }
      if (index !== parts.length - 1) {
        return Result.fail({
          _tag: "FilePathPatternError",
          pattern: filePath,
          message: "Rest segment must be the last segment",
        })
      }
      pathParts.push("*")
      sawRest = true
      continue
    }

    if (part.startsWith("[") && part.endsWith("]")) {
      const name = part.slice(1, -1)
      if (!isValidFileParamName(name)) {
        return Result.fail({
          _tag: "FilePathPatternError",
          pattern: filePath,
          message: `Invalid segment: "${part}"`,
        })
      }
      if (sawRest) {
        return Result.fail({
          _tag: "FilePathPatternError",
          pattern: filePath,
          message: "Rest segment must be the last segment",
        })
      }
      pathParts.push(`:${name}`)
      continue
    }

    if (/^[\p{L}\p{N}._~-]+$/u.test(part)) {
      if (sawRest) {
        return Result.fail({
          _tag: "FilePathPatternError",
          pattern: filePath,
          message: "Rest segment must be the last segment",
        })
      }
      pathParts.push(part)
      continue
    }

    return Result.fail({
      _tag: "FilePathPatternError",
      pattern: filePath,
      message: `Invalid segment: "${part}"`,
    })
  }

  const path = (pathParts.length > 0 ? `/${pathParts.join("/")}` : "/") as PathPattern.PathPattern
  return Result.succeed(path)
}
