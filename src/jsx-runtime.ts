import * as Html from "./Html.ts"
import type { JSX } from "./jsx.d.ts"

function Fragment(props: { children: JSX.Element }) {
  return props.children
}

function jsx<T extends Html.ElementType>(
  type: T,
  props: T extends string ? Html.ElemenetProps : T extends (props: infer P) => any ? P : never,
): Html.Element {
  return Html.make(type, props)
}

export { Fragment, type JSX, jsx, jsx as jsxDEV, jsx as jsxs }
