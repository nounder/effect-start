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
    // convert it to SSE from /.bundle/events that reloads on
    // JSON-inified object where type==Change AI!
    onMount(() => {
      let prevManifest = null as string | null

      const timer = setInterval(() => {
        fetch("/.bundle/manifest.json")
          .then(v => v.text())
          .then(v => {
            if (prevManifest !== null && prevManifest !== v) {
              console.debug("Bundle manifest change detected. Reloading...")
              window.location.reload()

              return
            }

            prevManifest = v
          })
      }, 200)

      return () => {
        clearInterval(timer)
      }
    })
  }

  return (
    <Router url={props?.serverUrl}>
      {Routes}
    </Router>
  )
}
