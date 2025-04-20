import { Router } from "@solidjs/router"
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
      return <div innerHTML={`<!--ssr-not-found-->`}></div>
    },
  },
]

export function App(props?: {
  serverUrl?: string
}) {
  if (process.env.NODE_ENV !== "production") {
    onMount(() => {
      const eventSource = new EventSource("/.bundle/events")
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === "Change") {
            console.debug("Bundle change detected. Reloading...")
            window.location.reload()
          }
        } catch (error) {
          console.error("Error parsing SSE event:", error)
        }
      }
      
      eventSource.onerror = (error) => {
        console.error("SSE connection error:", error)
        eventSource.close()
      }

      return () => {
        eventSource.close()
      }
    })
  }

  return (
    <Router url={props?.serverUrl}>
      {Routes}
    </Router>
  )
}
