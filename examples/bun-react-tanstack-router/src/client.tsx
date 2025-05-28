import "effect-bundler/client"

import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { createRoot } from "react-dom/client"
import { routeTree } from "./routes/.pages.gen.ts"

const router = createRouter({
  routeTree,
  history: createHashHistory(),
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

export function App() {
  return <RouterProvider router={router} />
}

window.addEventListener("load", () => {
  const root = createRoot(document.getElementById("app")!)
  root.render(<App />)
})
