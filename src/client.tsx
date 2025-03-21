import { render } from "solid-js/web"
import App from "./App.tsx"

if (globalThis.document) {
  const ssrChildren = Array.from(document.body.children)

  render(App, document.body)

  ssrChildren.forEach((child) => {
    child.remove()
  })
}
