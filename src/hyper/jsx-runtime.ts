import * as HyperNode from "./HyperNode.ts"
import type { JSX } from "../jsx.d.ts"

function Fragment(props: { children: JSX.Element }) {
  return props.children
}

function jsx<T extends HyperNode.Type>(
  type: T,
  props: T extends string ? HyperNode.Props
    : T extends (props: infer P) => any ? P
    : never,
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
