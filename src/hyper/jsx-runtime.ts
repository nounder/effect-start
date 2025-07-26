import * as HyperNode from "./HyperNode.ts"
import type { JSX } from "./jsx.d.ts"

function Fragment(props: { children: Element }) {
  return props.children
}

function jsx(
  type: HyperNode.Type,
  props: HyperNode.Props,
): HyperNode.HyperNode {
  return HyperNode.make(type, props)
}

export {
  Fragment,
  type JSX,
  jsx,
  jsx as jsxDEV,
  jsx as jsxs,
}
