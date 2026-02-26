import type { JSX } from "./jsx.d.ts"

export const TypeId = "~effect-start/HyperNode" as const

const NoChildren: ReadonlyArray<never> = Object.freeze([])

type Primitive = string | number | boolean | null | undefined

export type ElementType = string | Component

export type ElemenetProps = {
  [key: string]:
    | Primitive
    | Element
    | Iterable<Primitive | Element>
    | Record<string, unknown>
    | ((window: Window) => void)
}

export type Component = (props: ElemenetProps) => Element | Primitive

export interface Element {
  type: ElementType
  props: ElemenetProps
}

export function make(type: ElementType, props: ElemenetProps): Element {
  return {
    type,
    props: {
      ...props,
      children: props.children ?? NoChildren,
    },
  }
}

export function isGenericJsxObject(value: unknown): value is {
  type: any
  props: any
} {
  return typeof value === "object" && value !== null && "type" in value && "props" in value
}

const EMPTY_TAGS = [
  "area",
  "base",
  "br",
  "col",
  "command",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]

let esc = (str: any) => String(str).replace(/[&<>"']/g, (s) => `&${map[s]};`)
let escSQ = (str: any) => String(str).replace(/[&<>']/g, (s) => `&${map[s]};`)
let map = {
  "&": "amp",
  "<": "lt",
  ">": "gt",
  '"': "quot",
  "'": "#39",
}

const RAW_TEXT_TAGS = ["script", "style"]

const escapeRawText = (text: string) => text.replaceAll("</", "<\\/")

export function renderToString(
  node: JSX.Children,
  hooks?: { onNode?: (node: Element) => void },
): string {
  const stack: Array<any> = [node]
  let result = ""

  while (stack.length > 0) {
    const current = stack.pop()!

    if (typeof current === "string") {
      if (current.startsWith("<") && current.endsWith(">")) {
        result += current
      } else {
        result += esc(current)
      }
      continue
    }

    if (typeof current === "number") {
      result += esc(current)
      continue
    }

    if (typeof current === "boolean") {
      continue
    }

    if (current === null || current === undefined) {
      continue
    }

    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i--) {
        stack.push(current[i])
      }
      continue
    }

    if (current && typeof current === "object" && current.type) {
      hooks?.onNode?.(current)

      if (typeof current.type === "function") {
        const componentResult = current.type(current.props)
        if (componentResult != null) {
          stack.push(componentResult)
        }
        continue
      }

      const { type, props } = current
      result += `<${type}`

      for (const key in props) {
        if (
          key !== "children" &&
          key !== "dangerouslySetInnerHTML" &&
          props[key] !== false &&
          props[key] != null
        ) {
          if (props[key] === true) {
            result += ` ${esc(key)}`
          } else {
            const resolvedKey = key === "className" ? "class" : key
            const value = props[key]

            if (key.startsWith("data-") && typeof value === "function") {
              result += ` ${esc(resolvedKey)}="${esc(value.toString())}"`
            } else if (key.startsWith("data-") && typeof value === "object") {
              result += ` ${esc(resolvedKey)}='${escSQ(JSON.stringify(value))}'`
            } else {
              result += ` ${esc(resolvedKey)}="${esc(value)}"`
            }
          }
        }
      }

      result += ">"

      if (!EMPTY_TAGS.includes(type)) {
        stack.push(`</${type}>`)

        const isRawText = RAW_TEXT_TAGS.includes(type)
        const html = props.dangerouslySetInnerHTML?.__html

        if (html) {
          result += isRawText ? escapeRawText(html) : html
        } else {
          const children = props.children

          if (type === "script" && typeof children === "function") {
            result += escapeRawText(`(${children.toString()})(window)`)
          } else if (isRawText && children != null) {
            const raw = Array.isArray(children) ? children.join("") : String(children)
            result += escapeRawText(raw)
          } else if (Array.isArray(children)) {
            for (let i = children.length - 1; i >= 0; i--) {
              stack.push(children[i])
            }
          } else if (children != null) {
            stack.push(children)
          }
        }
      }
    } else if (current && typeof current === "object") {
      continue
    }
  }
  return result
}

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

type HtmlValue =
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
