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
import * as HyperNode from "./HyperNode.ts"
import type { JSX } from "../jsx.d.ts"
import type * as JsxRuntime from "./jsx-runtime.ts"

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

// escape an attribute
let esc = (str: any) => String(str).replace(/[&<>"']/g, (s) => `&${map[s]};`)
let map = {
  "&": "amp",
  "<": "lt",
  ">": "gt",
  "\"": "quot",
  "'": "apos",
}

export function renderToString(
  node: JSX.Children,
  hooks?: { onNode?: (node: HyperNode.HyperNode) => void },
): string {
  const stack: any[] = [node]
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
          key !== "children"
          && key !== "innerHTML" // Solid-specific
          && key !== "dangerouslySetInnerHTML" // React-specific
          && props[key] !== false
          && props[key] != null
        ) {
          if (props[key] === true) {
            result += ` ${esc(key)}`
          } else {
            const resolvedKey = key === "className" ? "class" : key

            result += ` ${esc(resolvedKey)}="${esc(props[key])}"`
          }
        }
      }

      result += ">"

      if (!EMPTY_TAGS.includes(type)) {
        stack.push(`</${type}>`)

        // React-specific
        const html = props.dangerouslySetInnerHTML?.__html
          ?? props.innerHTML

        if (html) {
          result += html
        } else {
          const children = props.children
          if (Array.isArray(children)) {
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
