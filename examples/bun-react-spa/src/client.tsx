import { createRoot } from "react-dom/client"

export function App() {
  return <div>Hello, Effect Bundler.</div>
}

window.addEventListener("load", () => {
  const root = createRoot(document.getElementById("app")!)
  root.render(<App />)
})
