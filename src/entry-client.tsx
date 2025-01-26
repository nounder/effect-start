import { Route, Router } from "@solidjs/router"
import { onMount } from "solid-js"
import { render } from "solid-js/web"
import routes from "./routes.ts"

export default function Root() {
  onMount(() => {
    const eventSource = new EventSource("/.bundle/events")

    eventSource.onmessage = (event) => {
      const msg = JSON.parse(event.data)

      if (msg._tag = "Update") {
        console.log("Reloading... File updated:", msg.path)
      }

      location.reload()
    }

    eventSource.onerror = (error) => {
      console.error("SSE Error:", error)
    }

    return () => {
      eventSource.close()
    }
  })

  return (
    <Router>
      {routes.map(([path, component]) => (
        <Route path={path} component={component} />
      ))}
    </Router>
  )
}

const ssrChildren = Array.from(document.body.children)

render(Root, document.body)

ssrChildren.forEach((child) => {
  child.remove()
})
