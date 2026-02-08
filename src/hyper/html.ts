const HtmlStringSymbol = Symbol.for("HtmlString")

export interface HtmlString {
  readonly [HtmlStringSymbol]: true
  readonly value: string
}

const makeHtmlString = (value: string): HtmlString => ({
  [HtmlStringSymbol]: true,
  value,
})

const isHtmlString = (value: unknown): value is HtmlString =>
  typeof value === "object" && value !== null && HtmlStringSymbol in value

export type HtmlValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | HtmlString
  | Function
  | Record<string, unknown>
  | ReadonlyArray<HtmlValue>

const resolveValue = (value: HtmlValue): string => {
  if (value === null || value === undefined || value === false || value === true) return ""
  if (isHtmlString(value)) return value.value
  if (Array.isArray(value)) return (value as Array<HtmlValue>).map(resolveValue).join("")
  if (typeof value === "function") return value.toString()
  if (typeof value === "object") return JSON.stringify(value)
  if (typeof value === "string") return value
  return String(value)
}

export const html = (strings: TemplateStringsArray, ...values: Array<HtmlValue>): HtmlString => {
  let result = strings[0]
  for (let i = 0; i < values.length; i++) {
    result += resolveValue(values[i])
    result += strings[i + 1]
  }
  return makeHtmlString(result)
}

html.raw = (value: string): HtmlString => makeHtmlString(value)
