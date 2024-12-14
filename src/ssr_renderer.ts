import { createRenderer } from "solid-js/universal"

const PROPERTIES = new Set([
  "className",
  "textContent",
])

type Text = {
  tag: "_text"
  value: string
}

type Element = {
  tag: string
  attrs: Record<string, any>
  style: Record<string, string>
}

type Node = (Text | Element) & {
  parent?: Node
  children?: Node[]
}

export const {
  render,
  effect,
  memo,
  createComponent,
  createElement,
  createTextNode,
  insertNode,
  insert,
  spread,
  setProp,
  mergeProps,
} = createRenderer<Node>({
  createElement(string): Element {
    return {
      tag: string,
      attrs: {},
      style: {},
    }
  },
  createTextNode(value): Text {
    return {
      tag: "_text",
      value: value,
    }
  },
  replaceText(textNode: Text, value) {
    textNode.value = value
  },
  setProperty(node: Element, name, value) {
    if (name === "style") {
      Object.assign(node.style, value)
    } else if (name.startsWith("on")) {
      node[name.toLowerCase()] = value
    } else if (PROPERTIES.has(name)) {
      node[name] = value
    } else {
      node.attrs[name] = value
    }
  },
  insertNode(parent, node, anchor) {
    if (parent.children) {
      if (!anchor) {
        parent.children = [
          ...parent.children,
          node,
        ]
      } else {
        const anchorIdx = parent.children.indexOf(anchor)

        parent.children = [
          ...parent.children.slice(0, anchorIdx - 1),
          anchor,
          ...parent.children.slice(anchorIdx + 1),
        ]
      }
    } else {
      parent.children = [node]
    }
  },
  isTextNode(node) {
    return node.tag === "_text"
  },
  removeNode(parent, node) {
    if (parent.children) {
      parent.children = parent.children.filter((v) => v !== node)
    }
  },
  getParentNode(node) {
    return node.parent
  },
  getFirstChild(node) {
    return node.children?.[0]
  },
  // todo: will it work with root fragments?
  getNextSibling(node) {
    const c = node.children

    if (!c) {
      return undefined
    }

    const idx = c.findIndex((v) => v === node)

    return c[idx + 1]
  },
})

export {
  ErrorBoundary,
  For,
  Index,
  Match,
  Show,
  Suspense,
  SuspenseList,
  Switch,
} from "solid-js"
