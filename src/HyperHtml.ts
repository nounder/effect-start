import * as HyperNode from "./HyperNode.ts"

/**
 * From: https://github.com/developit/vhtml
 */
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
  node: HyperNode.HyperNode,
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
          && key !== "innerHTML"
          && props[key] !== false
          && props[key] != null
        ) {
          if (props[key] === true) {
            result += ` ${esc(key)}`
          } else {
            result += ` ${esc(key)}="${esc(props[key])}"`
          }
        }
      }

      result += ">"

      if (!EMPTY_TAGS.includes(type)) {
        stack.push(`</${type}>`)

        if ("innerHTML" in props) {
          result += props.innerHTML
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
