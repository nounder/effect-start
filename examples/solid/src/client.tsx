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

/**
 * Live reload on file change in development.
 */
if (process.env.NODE_ENV !== "production") {
  const eventSource = new EventSource("/.bundle/events")

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === "Change") {
        console.debug("Bundle change detected. Reloading...")
        window.location.reload()
      }
    } catch (error) {
      console.error("Error parsing SSE event", {
        error,
        event,
      })
    }
  }

  eventSource.onerror = (error) => {
    console.error("SSE connection error:", error)
    eventSource.close()
  }
}
