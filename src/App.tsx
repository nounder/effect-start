import { Route, Router } from "@solidjs/router"
import { onMount } from "solid-js"
import Home from "./Home.tsx"
import { RandomComponent } from "./ui.tsx"

export default () => {
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
      <Route path="/" component={Home} />
      <Route path="/random" component={RandomComponent} />
    </Router>
  )
}
