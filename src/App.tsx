import { Route, Router } from "@solidjs/router"
import { onMount } from "solid-js"
import Home from "./Home.tsx"
import { RandomComponent } from "./ui.tsx"

const Routes = [
  {
    path: "/",
    component: Home,
  },
  {
    path: "/random",
    component: RandomComponent,
  },
  {
    path: "*404",
    component: () => {
      const msg = "Failed with RouteNotFound"

      return msg
    }
  },
]

export function App(props?: {
  serverUrl?: string
}) {
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
    <Router url={props?.serverUrl}>
      {Routes}
    </Router>
  )
}
