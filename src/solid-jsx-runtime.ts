// Useful links:
// https://github.com/solidjs/solid/blob/main/packages/babel-preset-solid/index.js
// https://github.com/ryansolid/dom-expressions/tree/main/packages/babel-plugin-jsx-dom-expressions
// Here's how Solid handles rendering full element:
// https://github.com/ryansolid/dom-expressions/blob/a1d24a1a4fb07c3a63919c978ec4180896de9248/packages/dom-expressions/src/server.js#L355
import type { JSX } from "solid-js"
import {
  escape,
  ssr,
  ssrAttribute,
  ssrClassList,
  ssrElement,
} from "solid-js/web"

/**
 * We can use it to pass data-hk for components.
 * TODO: This may fail on `jsxPrecompileSkipElements` encounter
 * because it always calls a type which in this case may be a string?
 */
function jsx(type, props) {
  return type(props || {})
}

export { Fragment, jsx, jsx as jsxDEV, jsx as jsxs }
