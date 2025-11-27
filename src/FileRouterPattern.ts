import * as RouterPattern from "./RouterPattern.ts"

export type GroupSegment<
  Name extends string = string,
> = {
  _tag: "GroupSegment"
  name: Name
}

export type Segment =
  | RouterPattern.Segment
  | GroupSegment

export function parse(pattern: string): Segment[] {
  const trimmedPath = pattern.replace(/(^\/)|(\/$)/g, "")

  if (trimmedPath === "") {
    return []
  }

  const segmentStrings = trimmedPath
    .split("/")
    .filter(s => s !== "")

  if (segmentStrings.length === 0) {
    return []
  }

  const segments: (Segment | null)[] = segmentStrings.map(
    (s): Segment | null => {
      // (group) - Groups (FileRouter-specific)
      const groupMatch = s.match(/^\((\w+)\)$/)
      if (groupMatch) {
        return { _tag: "GroupSegment", name: groupMatch[1] }
      }

      // Delegate to RouterPattern for all other segment types
      return RouterPattern.parseSegment(s)
    },
  )

  if (segments.some((seg) => seg === null)) {
    throw new Error(
      `Invalid path segment in "${pattern}": contains invalid characters or format`,
    )
  }

  return segments as Segment[]
}

export function formatSegment(seg: Segment): string {
  if (seg._tag === "GroupSegment") return `(${seg.name})`
  return RouterPattern.formatSegment(seg)
}

export function format(segments: Segment[]): `/${string}` {
  const joined = segments.map(formatSegment).join("/")
  return (joined ? `/${joined}` : "/") as `/${string}`
}
