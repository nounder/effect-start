import type * as Route from "../Route.ts"

export function toBunPath(path: Route.RoutePath): string {
  return path
    .split("/")
    .map(transformSegment)
    .join("/")
}

function transformSegment(segment: string): string {
  if (segment.startsWith("[[...") && segment.endsWith("]]")) {
    return "*"
  }

  if (segment.startsWith("[...") && segment.endsWith("]")) {
    return "*"
  }

  if (segment.startsWith("[[") && segment.endsWith("]]")) {
    const param = segment.slice(2, -2)
    return `:${param}`
  }

  if (segment.startsWith("[") && segment.endsWith("]")) {
    const param = segment.slice(1, -1)
    return `:${param}`
  }

  return segment
}

