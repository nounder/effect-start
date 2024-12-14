import { createRenderer } from "solid-js/universal"
export {
  assign,
  dynamicProperty,
  generateHydrationScript,
  HydrationScript,
  renderToStream,
  renderToString,
  renderToStringAsync,
  ssrElement,
  SVGElements,
} from "npm:solid-js@^1.9.3/web"

export * from "npm:solid-js@^1.9.3/web"

export const isServer = true

export const isDev = true

// required by solid-router
export function getRequestEvent() {
  return {}
}

// defined in dom-expressions
// probably not needed on the server
export function delegateEvents(eventNames, document) {
}

// todo: does it support classList, key, directives?
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
  events: Record<string, any>
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
      events: {},
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
      node.events[name.toLowerCase()] = value
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
