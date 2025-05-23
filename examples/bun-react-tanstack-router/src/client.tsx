import { RouterProvider } from "@tanstack/react-router"
import { createRoot } from "react-dom/client"
import { router } from "./routes.macro.ts" with { type: "macro" }

export function App() {
  return <RouterProvider router={router} />
}

window.addEventListener("load", () => {
  const root = createRoot(document.getElementById("app")!)
  root.render(<App />)
})
