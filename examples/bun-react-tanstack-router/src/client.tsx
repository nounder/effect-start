import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"
import { router } from "./routes"

export function App() {
  return <RouterProvider router={router} />
}

window.addEventListener("load", () => {
  const root = createRoot(document.getElementById("app")!)
  root.render(<App />)
})
