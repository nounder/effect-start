/**
 * From:
 * https://github.com/preactjs/preact/blob/main/jsx-runtime/src/index.js
 */
import { Fragment, options } from "preact"

export interface VNode {
  type: string
  props: Record<string, any>
}

function createVNode(type: VNode["type"], props: VNode["props"]) {
  if (!props) props = {}

  const vnode: VNode = {
    type,
    props,
  }

  return vnode
}

const ENCODED_ENTITIES = /["&<]/

/** @param {string} str */
export function encodeEntities(str) {
  // Skip all work for strings with no entities needing encoding:
  if (str.length === 0 || ENCODED_ENTITIES.test(str) === false) return str

  let last = 0,
    i = 0,
    out = "",
    ch = ""

  // Seek forward in str until the next entity char:
  for (; i < str.length; i++) {
    switch (str.charCodeAt(i)) {
      case 34:
        ch = "&quot;"
        break
      case 38:
        ch = "&amp;"
        break
      case 60:
        ch = "&lt;"
        break
      default:
        continue
    }
    // Append skipped/buffered characters and the encoded entity:
    if (i !== last) out += str.slice(last, i)
    out += ch
    // Start the next seek/buffer after the entity's offset:
    last = i + 1
  }
  if (i !== last) out += str.slice(last, i)
  return out
}

export {
  createVNode as jsx,
  createVNode as jsxDEV,
  createVNode as jsxs,
  Fragment,
  jsxAttr,
  jsxEscape,
  // precompiled JSX transform
  jsxTemplate,
}
