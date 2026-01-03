export type PathTuple = ReadonlyArray<
  string | [string, string?, string?] | [[string]]
>

export function format(tuple: PathTuple): `/${string}` {
  return "/" + tuple
    .map((el) => {
      if (typeof el === "string") return el
      if (Array.isArray(el[0])) return "[[" + el[0][0] + "]]"
      const [name, suffix, prefix] = el
      return (prefix ?? "") + "[" + name + "]" + (suffix ?? "")
    })
    .join("/") as `/${string}`
}

export function toColon(tuple: PathTuple): string {
  return "/" + tuple
    .map((el) => {
      if (typeof el === "string") return el
      if (Array.isArray(el[0])) return "*"
      const [name, suffix, prefix] = el
      return (prefix ?? "") + ":" + name + (suffix ?? "")
    })
    .join("/")
}

export const toHono = toColon

export function toExpress(tuple: PathTuple): string {
  return "/" + tuple
    .map((el) => {
      if (typeof el === "string") return el
      if (Array.isArray(el[0])) return "*" + el[0][0]
      const [name, suffix, prefix] = el
      return (prefix ?? "") + ":" + name + (suffix ?? "")
    })
    .join("/")
}

export const toEffect = toColon

export function toURLPattern(tuple: PathTuple): string {
  return "/" + tuple
    .map((el) => {
      if (typeof el === "string") return el
      if (Array.isArray(el[0])) return ":" + el[0][0] + "+"
      const [name, suffix, prefix] = el
      return (prefix ?? "") + ":" + name + (suffix ?? "")
    })
    .join("/")
}

export function toRemix(tuple: PathTuple): string {
  return "/" + tuple
    .map((el) => {
      if (typeof el === "string") return el
      if (Array.isArray(el[0])) return "$"
      const [name, suffix, prefix] = el
      return (prefix ?? "") + "$" + name + (suffix ?? "")
    })
    .join("/")
}

export const toBun = toColon
