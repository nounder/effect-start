import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import {
  createRoot,
} from "react-dom/client"
import {
  routeTree,
} from "./routes/routes.gen.ts"

const router = createRouter({
  routeTree,
  history: createHashHistory(),
})

export function App() {
  return <RouterProvider router={router} />
}

window.addEventListener("load", () => {
  const root = createRoot(document.getElementById("app")!)
  root.render(<App />)
})
