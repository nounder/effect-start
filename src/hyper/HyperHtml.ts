/**
 * Renders Hyper JSX nodes to HTML.
 *
 * Effect Start comes with {@link Hyper} and {@link JsxRuntime} to enable
 * JSX support. The advantage of using JSX over HTML strings or templates
 * is type safety and better editor support.
 *
 * JSX nodes are compatible with React's and Solid's.

 * You can enable JSX support by updating `tsconfig.json`:
 *
 * {
 *   compilerOptions: {
 *     jsx: "react-jsx",
 *     jsxImportSource: "effect-start" | "react" | "praect" // etc.
 *   }
 * }
 */

import type * as Hyper from "./Hyper.ts"
import type * as HyperNode from "./HyperNode.ts"
import type * as JsxRuntime from "./jsx-runtime.ts"
import type { JSX } from "./jsx.d.ts"

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

// Prevents closing html tags in embedded css/js source
const escapeRawText = (text: string) => text.replaceAll("</", "<\\/")

export function renderToString(
  node: JSX.Children,
  hooks?: { onNode?: (node: HyperNode.HyperNode) => void },
): string {
  const stack: Array<any> = [node]
  let result = ""

  while (stack.length > 0) {
    const current = stack.pop()!

    if (typeof current === "string") {
      if (current.startsWith("<") && current.endsWith(">")) {
        // This is a closing tag, don't escape it
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
      // React-like behavior: booleans render nothing
      continue
    }

    if (current === null || current === undefined) {
      // React-like behavior: null/undefined render nothing
      continue
    }

    if (Array.isArray(current)) {
      // Handle arrays by pushing all items to stack in reverse order
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
      // Handle objects without type property - convert to string or ignore
      // This prevents [object Object] from appearing
      continue
    }
  }
  return result
}
