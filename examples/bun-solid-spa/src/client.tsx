import "effect-bundler/client"

import { render } from "solid-js/web"
import { App } from "./App.tsx"

/**
 * Live reload on file change in development.
 * TODO: to be externalized under `effect-bundler/client/events` import
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

window.addEventListener("load", () => {
  const root = document.getElementById("app")!

  render(App, root)
})
