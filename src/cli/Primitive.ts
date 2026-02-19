import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"

export interface Primitive<out A> {
  readonly _tag: string
  readonly parse: (value: string) => Effect.Effect<A, string>
}

export const make = <A>(
  tag: string,
  parse: (value: string) => Effect.Effect<A, string>,
): Primitive<A> => ({ _tag: tag, parse })

export const isTrueValue = (v: string) => ["true", "1", "y", "yes", "on"].includes(v.toLowerCase())
export const isFalseValue = (v: string) =>
  ["false", "0", "n", "no", "off"].includes(v.toLowerCase())
export const isBooleanLiteral = (v: string) => isTrueValue(v) || isFalseValue(v)
export const isBoolean = (p: Primitive<unknown>): p is Primitive<boolean> => p._tag === "Boolean"

export const boolean: Primitive<boolean> = make("Boolean", (value) => {
  if (isTrueValue(value)) return Effect.succeed(true)
  if (isFalseValue(value)) return Effect.succeed(false)
  return Effect.fail(`Expected boolean (true/false/yes/no/on/off/1/0), got "${value}"`)
})

export const string: Primitive<string> = make("String", Effect.succeed)

export const integer: Primitive<number> = make("Integer", (value) => {
  const n = Number(value)
  if (!Number.isInteger(n)) return Effect.fail(`Expected integer, got "${value}"`)
  return Effect.succeed(n)
})

export const float: Primitive<number> = make("Float", (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return Effect.fail(`Expected number, got "${value}"`)
  return Effect.succeed(n)
})

export const date: Primitive<Date> = make("Date", (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return Effect.fail(`Expected valid date, got "${value}"`)
  return Effect.succeed(d)
})

export const redacted: Primitive<Redacted.Redacted<string>> = make("Redacted", (value) =>
  Effect.succeed(Redacted.make(value)),
)

export const keyValuePair: Primitive<Record<string, string>> = make("KeyValuePair", (value) => {
  const idx = value.indexOf("=")
  if (idx <= 0 || idx === value.length - 1)
    return Effect.fail(`Expected key=value format, got "${value}"`)
  return Effect.succeed({ [value.slice(0, idx)]: value.slice(idx + 1) })
})

export const choice = <A>(choices: ReadonlyArray<readonly [string, A]>): Primitive<A> => {
  const map = new Map(choices)
  const valid = choices.map(([k]) => k).join(" | ")
  return make("Choice", (value) =>
    map.has(value)
      ? Effect.succeed(map.get(value)!)
      : Effect.fail(`Expected ${valid}, got "${value}"`),
  )
}

export const none: Primitive<never> = make("None", () =>
  Effect.fail("This option does not accept values"),
)

export const getTypeName = <A>(p: Primitive<A>): string => {
  switch (p._tag) {
    case "Boolean":
      return "boolean"
    case "String":
      return "string"
    case "Integer":
      return "integer"
    case "Float":
      return "number"
    case "Date":
      return "date"
    case "Choice":
      return "choice"
    case "Redacted":
      return "string"
    case "KeyValuePair":
      return "key=value"
    case "None":
      return "none"
    default:
      return "value"
  }
}
