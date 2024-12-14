import type { JSX } from "solid-js"
import { ssrElement } from "solid-js/web"

function Fragment(props: {
  children: JSX.Element
}) {
  return props.children
}

function jsx(type: any, props: any) {
  // wrap in function so component is called after its parents
  if (typeof type === "function") {
    return () => type(props)
  }

  const { children, ...baseProps } = props

  return ssrElement(type, baseProps, children, true)
}

export { Fragment, JSX, jsx, jsx as jsxDEV, jsx as jsxs }
