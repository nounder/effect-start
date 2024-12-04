import { HTMLElements } from "./html.ts"
import type { JSX } from "solid-js"
import { escape, ssr, ssrAttribute, ssrClassList } from "solid-js/web"

function create(type, props) {
  return () => type(props || {})
}

function jsxAttr(name: string, value: any) {
  if (name === "classlist") {
    return {
      classList: value,
    }
  } else {
    return ssrAttribute(name, value)
  }
}

function jsxTemplate(templates: TemplateStringsArray, ...exprs: any[]) {
  for (let i = 0; i < exprs.length; i++) {
    const classList = exprs[i]?.classList
    if (classList) {
      // @ts-ignore value typing is wrong
      exprs[i] = ssrAttribute("class", ssrClassList(classList))
    }
  }

  // @ts-ignore ssr excepts writable array
  const { t } = ssr(templates, ...exprs)

  return {
    t,
    outerHTML: t,
  }
}

function jsxEscape(value): string {
  return escape(value)
}

export {
  create as jsx,
  create as jsxDEV,
  create as jsxs,
  JSX,
  jsxAttr,
  jsxEscape,
  jsxTemplate,
}
