import * as Html from "./Html.ts"
import type { HtmlElemenetProps, HtmlElement, HtmlElementType, JSX } from "./jsx.ts"

function Fragment(props: { children: JSX.Element }) {
  return props.children
}

function jsx<T extends HtmlElementType>(
  type: T,
  props: T extends string ? HtmlElemenetProps
    : T extends (props: infer P) => any ? P
    : never,
): HtmlElement {
  return Html.make(type, props)
}

export {
  Fragment,
  type JSX,
  jsx,
  jsx as jsxDEV,
  jsx as jsxs,
}
