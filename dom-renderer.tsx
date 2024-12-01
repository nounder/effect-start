import { createRenderer } from "solid-js/universal"
import { document } from "@litejs/dom"

const PROPERTIES = new Set(["className", "textContent"])

const renderer = createRenderer({
  createElement(string) {
    return document.createElement(string)
  },
  createTextNode(value) {
    return document.createTextNode(value)
  },
  replaceText(textNode, value) {
    textNode.data = value
  },
  setProperty(node, name, value) {
    if (name === "style") {
      Object.assign(node.style, value)
    } else if (name === "classList") {
      const classes = Object.entries(value)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(" ")

      if (classes) {
        node.className += " " + classes
      }
    }
    else if (name.startsWith("on")) {
      node[name.toLowerCase()] = value
    }
    else if (PROPERTIES.has(name)) {
      node[name] = value
    }
    else {
      node.setAttribute(name, value)
    }
  },
  insertNode(parent, node, anchor) {
    parent.insertBefore(node, anchor)
  },
  isTextNode(node) {
    return node.type === 3
  },
  removeNode(parent, node) {
    parent.removeChild(node)
  },
  getParentNode(node) {
    return node.parentNode
  },
  getFirstChild(node) {
    return node.firstChild
  },
  getNextSibling(node) {
    return node.nextSibling
  },
})

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
} = renderer

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

export { ssr } from "solid-js/web"
