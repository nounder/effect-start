import { render } from "solid-js/web"
import { App } from "./App.tsx"

export default function renderApp(root: HTMLElement) {
  const ssrChildren = Array.from(root.children)

  render(App, root)

  ssrChildren.forEach((child) => {
    child.remove()
  })
}

if (globalThis.document) {
  renderApp(document.body)
}
