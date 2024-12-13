// Useful links:
// https://github.com/solidjs/solid/blob/main/packages/babel-preset-solid/index.js
// https://github.com/ryansolid/dom-expressions/tree/main/packages/babel-plugin-jsx-dom-expressions
// Here's how Solid handles rendering full element:
// https://github.com/ryansolid/dom-expressions/blob/a1d24a1a4fb07c3a63919c978ec4180896de9248/packages/dom-expressions/src/server.js#L355
import type { JSX } from "solid-js"
import { escape, ssr, ssrAttribute, ssrClassList } from "solid-js/web"

/**
 * We can use it to pass data-hk for components.
 * TODO: This may fail on `jsxPrecompileSkipElements` encounter
 * because it always calls a type which in this case may be a string?
 */
function create(type, props) {
  return () => type(props || {})
}

/**
 * When a dynamic attribute is used, it will be transformed here,
 * and then passed to jsxTemplate in exprs arg.
 */
function jsxAttr(name: string, value: any) {
  if (name === "classlist") {
    return {
      classList: value,
    }
  } else {
    return ssrAttribute(name, value)
  }
}

/**
 * Hydration marks seems to be added:
 * - on elements with event listener
 * - on reactive component
 *   how do i know which one is reactive?
 *
 * this will cost a lot of time to figure out.
 * either go with dom-expr processsing (and server-side bundling)
 * or go all in bun
 *
 * best to run a simple page with hydration on and off and compare those two.
 * why not ditch hydration for now and just swap html?
 */

/**
 * There is no guarantee that a function will be called on every node,
 * except when using hyperscript.
 * TODO: If 1st template starts with < we can be sure it's html tag,
 * and inject data-hk to it and maybe even a hydration comment.
 * How do we know, however, if next this jsxTemplate will be immedietly
 * inside of a component? Will need to share state across function calls.
 */
function jsxTemplate(templates: TemplateStringsArray, ...exprs: any[]) {
  console.log("---->", templates)

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
